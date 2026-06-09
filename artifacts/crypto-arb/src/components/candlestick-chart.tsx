import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  ColorType,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type CandlestickData,
  type UTCTimestamp,
} from "lightweight-charts";
import { applyTAOverlays, type TAHandle, autoAnalyze, type AnalysisResult } from "../lib/ta";
import { israelTickMarkFormatter, israelTimeFormatter } from "../lib/timezone";
import { TradingViewAdvancedChart } from "./tradingview-advanced-chart";
import type { BinancePosition } from "@/contexts/portfolio-context";
import { useLanguage } from "@/contexts/language-context";
import { t } from "@/lib/i18n";

const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1D"] as const;
type Interval = typeof INTERVALS[number];

const SYMBOL_MAP: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  SOL: "SOLUSDT",
  BNB: "BNBUSDT",
};

function toBinanceSymbol(asset: string): string {
  return SYMBOL_MAP[asset] ?? `${asset.toUpperCase()}USDT`;
}

async function fetchKlines(
  asset: string,
  interval: string,
  limit = 300
): Promise<CandlestickData<UTCTimestamp>[]> {
  const sym = toBinanceSymbol(asset);
  const url = `https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Klines ${res.status}`);
  const raw = (await res.json()) as [number, string, string, string, string, ...unknown[]][];
  return raw.map(([t, o, h, l, c]) => ({
    time: Math.floor(t / 1000) as UTCTimestamp,
    open: parseFloat(o),
    high: parseFloat(h),
    low: parseFloat(l),
    close: parseFloat(c),
  }));
}

interface Props {
  symbol: string;
  /** Open positions for this asset — drawn as price lines + overlay cards. */
  positions?: BinancePosition[];
  /** Live mark price used to compute P&L in the overlay cards. */
  currentPrice?: number;
  /** Called when the user clicks the close button on an overlay card. */
  onClosePosition?: (id: string, currentPrice: number) => void;
}

type PriceLineHandles = { entry: IPriceLine; sl?: IPriceLine; tp?: IPriceLine };

export function CandlestickChart({ symbol, positions, currentPrice, onClosePosition }: Props) {
  const { lang } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const taRef = useRef<TAHandle | null>(null);
  const candlesRef = useRef<CandlestickData<UTCTimestamp>[]>([]);
  const priceLineMapRef = useRef<Map<string, PriceLineHandles>>(new Map());

  const [period, setPeriod] = useState<Interval>("5m");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [live, setLive] = useState(false);
  const [ta, setTa] = useState(true);
  const [bars, setBars] = useState(0);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [mode, setMode] = useState<"live" | "pro">("live");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

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
      localization: { timeFormatter: israelTimeFormatter },
      timeScale: {
        borderColor: "hsl(0 0% 13%)",
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: israelTickMarkFormatter,
      },
      crosshair: { mode: 1 },
      width: el.clientWidth,
      height: el.clientHeight,
    });
    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });
    seriesRef.current = series;

    let disposed = false;
    const ro = new ResizeObserver(() => {
      if (disposed || !el) return;
      try {
        chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
      } catch {
        // chart was disposed between the resize event and this callback
      }
    });
    ro.observe(el);

    return () => {
      disposed = true;
      ro.disconnect();
      priceLineMapRef.current.clear();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) return;
    setLoading(true);
    setErr(false);
    const restInterval = period === "1D" ? "1d" : period;
    fetchKlines(symbol, restInterval)
      .then((data) => {
        seriesRef.current?.setData(data);
        chartRef.current?.timeScale().fitContent();
        candlesRef.current = data;
        setBars((b) => b + 1);
        setLoading(false);
      })
      .catch(() => {
        setErr(true);
        setLoading(false);
      });
  }, [symbol, period]);

  // TA overlays
  useEffect(() => {
    taRef.current?.remove();
    taRef.current = null;
    if (!ta || !chartRef.current || !seriesRef.current || candlesRef.current.length === 0) return;
    taRef.current = applyTAOverlays(chartRef.current, seriesRef.current, candlesRef.current);
    return () => {
      taRef.current?.remove();
      taRef.current = null;
    };
  }, [bars, ta]);

  // ── Position price lines ─────────────────────────────────────────────────────
  // Draws entry / SL / TP horizontal price lines on the chart for every open
  // position on this asset. Lines are recreated from scratch whenever the
  // positions array changes or the chart mode switches.
  useEffect(() => {
    const series = seriesRef.current;

    // Remove all existing lines
    for (const h of priceLineMapRef.current.values()) {
      try { series?.removePriceLine(h.entry); } catch { /* disposed */ }
      if (h.sl) try { series?.removePriceLine(h.sl); } catch { /* disposed */ }
      if (h.tp) try { series?.removePriceLine(h.tp); } catch { /* disposed */ }
    }
    priceLineMapRef.current.clear();

    if (!series || mode === "pro" || !positions?.length) return;

    for (const pos of positions) {
      const isLong = pos.direction === "LONG";
      const entryColor = isLong ? "#10b981" : "#ef4444";
      const shortLabel = (pos.source ?? (pos.auto ? "Bot" : "Manual")).slice(0, 14);

      const entry = series.createPriceLine({
        price: pos.entryPrice,
        color: entryColor,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `${pos.direction} ${pos.leverage}x · ${shortLabel}`,
      });

      let sl: IPriceLine | undefined;
      if (pos.slPrice != null) {
        sl = series.createPriceLine({
          price: pos.slPrice,
          color: "#ef4444",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: "SL",
        });
      }

      let tp: IPriceLine | undefined;
      if (pos.tpPrice != null) {
        tp = series.createPriceLine({
          price: pos.tpPrice,
          color: "#22c55e",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: "TP",
        });
      }

      priceLineMapRef.current.set(pos.id, { entry, sl, tp });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, mode, bars]);

  // Live WebSocket / polling
  useEffect(() => {
    if (mode === "pro") {
      setLive(false);
      return;
    }
    const sym = toBinanceSymbol(symbol).toLowerCase();
    const wsInterval = period === "1D" ? "1d" : period;
    let ws: WebSocket | null = null;
    let pollId: number | null = null;
    let reconnectId: number | null = null;
    let closed = false;
    setLive(false);

    const startPolling = () => {
      if (pollId != null) return;
      const ms = period === "1m" ? 12000 : period === "5m" ? 30000 : 60000;
      pollId = window.setInterval(() => {
        fetchKlines(symbol, wsInterval, 2)
          .then((data) => data.forEach((c) => seriesRef.current?.update(c)))
          .catch(() => {});
      }, ms);
    };
    const stopPolling = () => {
      if (pollId != null) {
        window.clearInterval(pollId);
        pollId = null;
      }
    };

    const connect = () => {
      if (closed || typeof WebSocket === "undefined") {
        startPolling();
        return;
      }
      try {
        ws = new WebSocket(
          `wss://data-stream.binance.vision/ws/${sym}@kline_${wsInterval}`,
        );
      } catch {
        startPolling();
        return;
      }
      ws.onopen = () => {
        stopPolling();
        setLive(true);
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as {
            k?: { t: number; o: string; h: string; l: string; c: string };
          };
          const k = msg.k;
          if (!k) return;
          seriesRef.current?.update({
            time: Math.floor(k.t / 1000) as UTCTimestamp,
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
          });
        } catch {
          /* ignore malformed frame */
        }
      };
      ws.onclose = () => {
        setLive(false);
        if (closed) return;
        startPolling();
        reconnectId = window.setTimeout(connect, 3000);
      };
      ws.onerror = () => {
        try {
          ws?.close();
        } catch {
          /* noop */
        }
      };
    };

    connect();

    return () => {
      closed = true;
      stopPolling();
      if (reconnectId != null) window.clearTimeout(reconnectId);
      try {
        ws?.close();
      } catch {
        /* noop */
      }
    };
  }, [symbol, period, mode]);

  const markPrice = currentPrice ?? 0;

  return (
    <div className="flex flex-col h-full bg-[hsl(0_0%_4%)]">
      <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-border shrink-0 bg-card/20">
        <span className="text-[10px] font-mono text-muted-foreground mr-2 uppercase tracking-widest">Chart</span>
        {mode === "live" && (
          <span
            className={`flex items-center gap-1 mr-2 text-[9px] font-mono font-bold uppercase tracking-wider ${
              live ? "text-emerald-400" : "text-muted-foreground"
            }`}
            title={live ? "Live WebSocket stream" : "Polling fallback"}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${live ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/50"}`} />
            {live ? "LIVE" : "···"}
          </span>
        )}
        <div className="flex items-center gap-0.5 mr-2 rounded bg-secondary/30 p-0.5">
          <button
            onClick={() => setMode("live")}
            title={t("cc.liveTitle", lang)}
            className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded transition-colors ${
              mode === "live" ? "bg-primary/25 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("cc.live", lang)}
          </button>
          <button
            onClick={() => setMode("pro")}
            title={t("cc.proTitle", lang)}
            className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded transition-colors ${
              mode === "pro" ? "bg-primary/25 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            ✏ Pro
          </button>
        </div>
        {mode === "live" && (
          <>
            <button
              onClick={() => setTa((v) => !v)}
              title={t("cc.taTitle", lang)}
              className={`px-2 py-0.5 mr-1 text-[10px] font-mono font-bold rounded transition-colors ${
                ta ? "bg-primary/25 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              TA
            </button>
            <button
              onClick={() => {
                const c = candlesRef.current;
                if (c.length > 0) {
                  const candles = c.map((cd) => ({ time: cd.time, open: cd.open, high: cd.high, low: cd.low, close: cd.close }));
                  const result = autoAnalyze(candles, candles[candles.length - 1].close);
                  setAnalysis(result);
                  setShowAnalysis(true);
                }
              }}
              title={t("cc.analyzeTitle", lang)}
              className="px-2 py-0.5 mr-1 text-[10px] font-mono font-bold rounded transition-colors bg-primary/15 text-primary hover:bg-primary/25"
            >
              {t("cc.analyze", lang)}
            </button>
            {INTERVALS.map((iv) => (
              <button
                key={iv}
                onClick={() => setPeriod(iv)}
                className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                  period === iv
                    ? "bg-primary/20 text-primary font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {iv}
              </button>
            ))}
          </>
        )}
      </div>
      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="absolute inset-0" />

        {/* ── Open-position overlay cards ───────────────────────────────────── */}
        {mode === "live" && positions && positions.length > 0 && (
          <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 max-h-[calc(100%-16px)] overflow-y-auto pointer-events-none">
            {positions.map((pos) => {
              const isLong = pos.direction === "LONG";
              const mark = markPrice > 0 ? markPrice : pos.entryPrice;
              const delta = isLong
                ? (mark - pos.entryPrice) / pos.entryPrice
                : (pos.entryPrice - mark) / pos.entryPrice;
              const pnl = delta * pos.notional;
              const pnlPct = delta * pos.leverage * 100;
              const margin = pos.notional / pos.leverage;
              const accent = isLong ? "#10b981" : "#ef4444";
              const pnlPositive = pnl >= 0;

              return (
                <div
                  key={pos.id}
                  className="pointer-events-auto rounded border bg-[hsl(0_0%_6%)/92] backdrop-blur-sm shadow-lg text-[10px] font-mono overflow-hidden"
                  style={{ borderColor: `${accent}50`, minWidth: "148px", maxWidth: "190px" }}
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between px-1.5 py-1 gap-1" style={{ background: `${accent}18` }}>
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="font-black" style={{ color: accent }}>{pos.direction}</span>
                      <span className="text-[9px] font-bold px-1 rounded" style={{ background: `${accent}25`, color: accent }}>
                        {pos.leverage}x
                      </span>
                      <span className="truncate text-[9px] text-muted-foreground">{pos.source ?? (pos.auto ? "Bot" : "Manual")}</span>
                    </div>
                    {onClosePosition && (
                      <button
                        onClick={() => onClosePosition(pos.id, mark)}
                        className="flex-shrink-0 rounded p-0.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/15 transition-all"
                        title={t("cc.closePosition", lang)}
                      >
                        <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 1l10 10M11 1L1 11" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Price rows */}
                  <div className="px-1.5 py-1 space-y-0.5">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Entry</span>
                      <span>${pos.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Mark</span>
                      <span>{mark > 0 ? `$${mark.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}</span>
                    </div>
                    {pos.slPrice != null && (
                      <div className="flex justify-between gap-2 text-red-400/80">
                        <span>SL</span>
                        <span>${pos.slPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {pos.tpPrice != null && (
                      <div className="flex justify-between gap-2 text-emerald-400/80">
                        <span>TP</span>
                        <span>${pos.tpPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-2 pt-0.5 border-t border-border/40">
                      <span className="text-muted-foreground">Margin</span>
                      <span>${margin.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between gap-2 font-black" style={{ color: pnlPositive ? "#10b981" : "#ef4444" }}>
                      <span>P&L</span>
                      <span>{pnlPositive ? "+" : ""}{pnl.toFixed(2)} ({pnlPositive ? "+" : ""}{pnlPct.toFixed(1)}%)</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {mode === "pro" && (
          <div className="absolute inset-0 z-20 bg-[hsl(0_0%_4%)]">
            <TradingViewAdvancedChart tvSymbol={`BINANCE:${toBinanceSymbol(symbol)}`} />
          </div>
        )}
        {mode === "live" && loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-background/60">
            <span className="text-xs font-mono text-muted-foreground animate-pulse">Loading chart…</span>
          </div>
        )}
        {err && !loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-background/60">
            <span className="text-xs font-mono text-red-400">Chart data unavailable</span>
          </div>
        )}
        {showAnalysis && analysis && (
          <div className="absolute top-2 right-2 max-w-sm rounded-lg border border-border/80 bg-card/95 backdrop-blur p-3 shadow-lg z-10">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                analysis.verdict === "LONG" ? "bg-emerald-500/20 text-emerald-400"
                : analysis.verdict === "SHORT" ? "bg-red-500/20 text-red-400"
                : "bg-muted/40 text-muted-foreground"
              }`}>
                {analysis.verdict} {analysis.confidence}%
              </span>
              <button onClick={() => setShowAnalysis(false)} className="text-[10px] text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground leading-snug mb-2" dir="rtl">{analysis.summary}</p>
            <div className="grid grid-cols-2 gap-1">
              {analysis.indicators.map((ind) => (
                <div key={ind.name} className="flex items-center gap-1 text-[9px]">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    ind.signal === "BUY" ? "bg-emerald-400" : ind.signal === "SELL" ? "bg-red-400" : "bg-muted-foreground"
                  }`} />
                  <span className="text-muted-foreground">{ind.name}:</span>
                  <span className={ind.signal === "BUY" ? "text-emerald-400" : ind.signal === "SELL" ? "text-red-400" : "text-muted-foreground"}>
                    {ind.signal}
                  </span>
                </div>
              ))}
            </div>
            {(analysis.entry || analysis.sl || analysis.tp) && (
              <div className="mt-2 pt-2 border-t border-border/40 flex gap-3 text-[9px] font-mono">
                {analysis.entry && <span className="text-muted-foreground">Entry <span className="text-foreground">${analysis.entry.toFixed(2)}</span></span>}
                {analysis.sl && <span className="text-muted-foreground">SL <span className="text-red-400">${analysis.sl.toFixed(2)}</span></span>}
                {analysis.tp && <span className="text-muted-foreground">TP <span className="text-emerald-400">${analysis.tp.toFixed(2)}</span></span>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
