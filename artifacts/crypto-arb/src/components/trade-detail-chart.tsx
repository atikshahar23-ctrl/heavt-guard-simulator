import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  ColorType,
  LineStyle,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type UTCTimestamp,
  type Time,
  type SeriesMarker,
} from "lightweight-charts";
import { useGetStockKlines, getGetStockKlinesQueryKey } from "@workspace/api-client-react";
import type { ClosedTrade } from "@/contexts/portfolio-context";

const SYMBOL_MAP: Record<string, string> = {
  BTC: "BTCUSDT", ETH: "ETHUSDT", SOL: "SOLUSDT", BNB: "BNBUSDT",
};
function toBinanceSymbol(asset: string): string {
  return SYMBOL_MAP[asset] ?? `${asset.toUpperCase()}USDT`;
}

/** Choose a Binance kline interval so the trade window spans ~120 bars with context. */
function cryptoIntervalFor(spanMs: number): string {
  const secPerBar = Math.max(spanMs, 60_000) / 1000 / 120;
  const candidates: [number, string][] = [
    [60, "1m"], [180, "3m"], [300, "5m"], [900, "15m"], [1800, "30m"],
    [3600, "1h"], [7200, "2h"], [14400, "4h"], [21600, "6h"], [43200, "12h"], [86400, "1d"],
  ];
  for (const [sec, label] of candidates) if (sec >= secPerBar) return label;
  return "1d";
}

/** Choose a stock kline range that reaches back far enough to COVER the trade.
 *  Yahoo ranges always end "now", so the range must span the trade's *age*
 *  (now → entry), not just the holding duration, or an old trade would be
 *  charted against the wrong recent slice. */
function stockRangeFor(openedMs: number): "1d" | "5d" | "1mo" | "6mo" | "1y" {
  const ageDays = (Date.now() - openedMs) / 86_400_000;
  if (ageDays <= 3.5) return "5d";
  if (ageDays <= 24) return "1mo";
  if (ageDays <= 150) return "6mo";
  return "1y";
}

/** Fetch crypto candles bounded to the trade window (+ context padding) so the
 *  entry/exit markers attach to the real bars from when the trade was live,
 *  rather than the latest N bars. Falls back to recent bars if the window is
 *  empty (e.g. symbol missing on the mirror). */
async function fetchCryptoKlines(
  asset: string,
  interval: string,
  startMs?: number,
  endMs?: number,
  limit = 1000,
): Promise<CandlestickData<UTCTimestamp>[]> {
  const sym = toBinanceSymbol(asset);
  const parse = (raw: [number, string, string, string, string, ...unknown[]][]) =>
    raw.map(([t, o, h, l, c]) => ({
      time: Math.floor(t / 1000) as UTCTimestamp,
      open: parseFloat(o), high: parseFloat(h), low: parseFloat(l), close: parseFloat(c),
    }));

  let url = `https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=${interval}&limit=${limit}`;
  if (startMs != null) url += `&startTime=${Math.floor(startMs)}`;
  if (endMs != null) url += `&endTime=${Math.floor(endMs)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Klines ${res.status}`);
  const windowed = parse((await res.json()) as [number, string, string, string, string, ...unknown[]][]);
  if (windowed.length > 0) return windowed;

  // Fallback: no data in the requested window — show recent bars instead.
  const fb = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=${interval}&limit=300`);
  if (!fb.ok) throw new Error(`Klines ${fb.status}`);
  return parse((await fb.json()) as [number, string, string, string, string, ...unknown[]][]);
}

/** Nearest candle time to a target timestamp (seconds), so markers attach to a real bar. */
function snapTime(candles: CandlestickData<UTCTimestamp>[], targetSec: number): UTCTimestamp | null {
  if (candles.length === 0) return null;
  let best = candles[0].time as number;
  let bestDiff = Math.abs(best - targetSec);
  for (const c of candles) {
    const d = Math.abs((c.time as number) - targetSec);
    if (d < bestDiff) { best = c.time as number; bestDiff = d; }
  }
  return best as UTCTimestamp;
}

interface Props {
  trade: ClosedTrade;
}

export function TradeDetailChart({ trade }: Props) {
  const isStock = trade.type === "STOCK";
  const isCrypto = trade.type === "BINANCE";
  const isPoly = trade.type === "POLYMARKET";

  const openedMs = trade.openedAt ? new Date(trade.openedAt).getTime() : new Date(trade.closedAt).getTime();
  const closedMs = new Date(trade.closedAt).getTime();
  const spanMs = Math.max(closedMs - openedMs, 60_000);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [cryptoCandles, setCryptoCandles] = useState<CandlestickData<UTCTimestamp>[]>([]);
  const [loading, setLoading] = useState(isCrypto || isStock);
  const [err, setErr] = useState(false);

  const stockRange = stockRangeFor(openedMs);
  const { data: stockData, isError: stockError, isLoading: stockLoading } = useGetStockKlines(
    { symbol: trade.symbol ?? "", range: stockRange },
    {
      query: {
        queryKey: getGetStockKlinesQueryKey({ symbol: trade.symbol ?? "", range: stockRange }),
        enabled: isStock && !!trade.symbol,
        staleTime: 60_000,
      },
    },
  );

  // Crypto klines (keyless binance.vision).
  useEffect(() => {
    if (!isCrypto || !trade.symbol) return;
    let cancelled = false;
    setLoading(true);
    setErr(false);
    const pad = Math.max(spanMs * 0.5, 60_000);
    const startMs = openedMs - pad;
    const endMs = Math.min(closedMs + pad, Date.now());
    fetchCryptoKlines(trade.symbol, cryptoIntervalFor(spanMs), startMs, endMs)
      .then((c) => { if (!cancelled) { setCryptoCandles(c); setLoading(false); } })
      .catch(() => { if (!cancelled) { setErr(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, [isCrypto, trade.symbol, spanMs]);

  const candles = useMemo<CandlestickData<UTCTimestamp>[]>(() => {
    if (isStock) {
      return (stockData ?? []).map((c) => ({
        time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close,
      }));
    }
    return cryptoCandles;
  }, [isStock, stockData, cryptoCandles]);

  useEffect(() => {
    if (isStock) { setLoading(stockLoading); setErr(stockError); }
  }, [isStock, stockLoading, stockError]);

  // Build the chart.
  useEffect(() => {
    if (isPoly) return;
    const el = containerRef.current;
    if (!el || candles.length === 0) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "hsl(0 0% 4%)" },
        textColor: "hsl(0 0% 50%)",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "hsl(0 0% 9%)" },
        horzLines: { color: "hsl(0 0% 9%)" },
      },
      rightPriceScale: { borderColor: "hsl(0 0% 13%)" },
      timeScale: {
        borderColor: "hsl(0 0% 13%)",
        timeVisible: spanMs < 5 * 86_400_000,
        secondsVisible: false,
      },
      crosshair: { mode: 1 },
      width: el.clientWidth,
      height: el.clientHeight,
    });
    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981", downColor: "#ef4444",
      borderUpColor: "#10b981", borderDownColor: "#ef4444",
      wickUpColor: "#10b981", wickDownColor: "#ef4444",
    });
    seriesRef.current = series;
    series.setData(candles);

    const won = trade.pnl >= 0;
    if (Number.isFinite(trade.entryPrice)) {
      series.createPriceLine({
        price: trade.entryPrice as number,
        color: "#38bdf8", lineWidth: 1, lineStyle: LineStyle.Dashed,
        axisLabelVisible: true, title: "כניסה",
      });
    }
    if (Number.isFinite(trade.exitPrice)) {
      series.createPriceLine({
        price: trade.exitPrice as number,
        color: won ? "#22c55e" : "#ef4444", lineWidth: 1, lineStyle: LineStyle.Dashed,
        axisLabelVisible: true, title: "יציאה",
      });
    }

    const markers: SeriesMarker<Time>[] = [];
    const entrySnap = snapTime(candles, Math.floor(openedMs / 1000));
    const exitSnap = snapTime(candles, Math.floor(closedMs / 1000));
    if (entrySnap !== null) {
      markers.push({
        time: entrySnap as Time,
        position: trade.direction === "SHORT" || trade.direction === "NO" ? "aboveBar" : "belowBar",
        color: "#38bdf8", shape: trade.direction === "SHORT" || trade.direction === "NO" ? "arrowDown" : "arrowUp",
        text: "כניסה",
      });
    }
    if (exitSnap !== null && exitSnap !== entrySnap) {
      markers.push({
        time: exitSnap as Time,
        position: "aboveBar",
        color: won ? "#22c55e" : "#ef4444", shape: "circle",
        text: "יציאה",
      });
    }
    markers.sort((a, b) => (a.time as number) - (b.time as number));
    const markersApi = createSeriesMarkers(series, markers);

    // Pin the view to the trade window (+ context) so entry/exit are centered,
    // rather than showing the whole fetched range. Fall back if out of bounds.
    const firstSec = candles[0].time as number;
    const lastSec = candles[candles.length - 1].time as number;
    const padSec = Math.max((spanMs * 0.3) / 1000, 60);
    const fromSec = Math.max(Math.floor(openedMs / 1000) - padSec, firstSec);
    const toSec = Math.min(Math.floor(closedMs / 1000) + padSec, lastSec);
    if (toSec > fromSec) {
      try {
        chart.timeScale().setVisibleRange({ from: fromSec as Time, to: toSec as Time });
      } catch {
        chart.timeScale().fitContent();
      }
    } else {
      chart.timeScale().fitContent();
    }

    let disposed = false;
    const ro = new ResizeObserver(() => {
      if (disposed || !el) return;
      try { chart.applyOptions({ width: el.clientWidth, height: el.clientHeight }); } catch { /* noop */ }
    });
    ro.observe(el);

    return () => {
      disposed = true;
      ro.disconnect();
      try { markersApi.setMarkers([]); markersApi.detach(); } catch { /* noop */ }
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [candles, isPoly, openedMs, closedMs, spanMs, trade.entryPrice, trade.exitPrice, trade.direction, trade.pnl]);

  // Polymarket has no candle feed — render an entry→exit probability strip instead.
  if (isPoly) {
    const entry = trade.entryPrice ?? 0;
    const exit = trade.exitPrice ?? entry;
    const won = trade.pnl >= 0;
    return (
      <div className="rounded-lg border bg-card p-4 space-y-3" dir="rtl">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          הסתברות שוק (אין גרף נרות לשוקי חיזוי)
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="text-center">
            <div className="text-[10px] text-muted-foreground">כניסה</div>
            <div className="font-mono text-lg font-black text-sky-400">{(entry * 100).toFixed(1)}%</div>
          </div>
          <div className="flex-1 h-2 rounded-full bg-secondary/60 relative overflow-hidden">
            <div
              className="absolute inset-y-0 right-0 rounded-full"
              style={{ width: `${Math.min(100, Math.max(entry, exit) * 100)}%`, background: won ? "#22c55e55" : "#ef444455" }}
            />
          </div>
          <div className="text-center">
            <div className="text-[10px] text-muted-foreground">יציאה</div>
            <div className="font-mono text-lg font-black" style={{ color: won ? "#22c55e" : "#ef4444" }}>
              {(exit * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ height: 280 }}>
      <div ref={containerRef} className="w-full h-full rounded-lg border bg-card overflow-hidden" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground" dir="rtl">
          טוען גרף…
        </div>
      )}
      {err && !loading && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground" dir="rtl">
          הגרף לא זמין כרגע.
        </div>
      )}
    </div>
  );
}
