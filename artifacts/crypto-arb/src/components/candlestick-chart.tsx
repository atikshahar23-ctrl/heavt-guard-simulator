import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type UTCTimestamp,
} from "lightweight-charts";
import { applyTAOverlays, type TAHandle, autoAnalyze, type AnalysisResult } from "../lib/ta";

const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1D"] as const;
type Interval = typeof INTERVALS[number];

const SYMBOL_MAP: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  SOL: "SOLUSDT",
  BNB: "BNBUSDT",
};

async function fetchKlines(
  asset: string,
  interval: string,
  limit = 300
): Promise<CandlestickData<UTCTimestamp>[]> {
  const sym = SYMBOL_MAP[asset] ?? asset;
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
}

export function CandlestickChart({ symbol }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const taRef = useRef<TAHandle | null>(null);
  const candlesRef = useRef<CandlestickData<UTCTimestamp>[]>([]);
  const [period, setPeriod] = useState<Interval>("5m");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [live, setLive] = useState(false);
  const [ta, setTa] = useState(true);
  const [bars, setBars] = useState(0);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

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
      timeScale: {
        borderColor: "hsl(0 0% 13%)",
        timeVisible: true,
        secondsVisible: false,
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

  // TA overlays — recomputed only on full data load (`bars`) or toggle, never on a
  // WS tick, so the live streaming path stays fast and untouched.
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

  // Live updates: prefer a zero-cost Binance kline WebSocket (sub-second, browser
  // direct so no server geo-block). Fall back to REST polling only if the socket
  // never opens (e.g. blocked network).
  useEffect(() => {
    const sym = (SYMBOL_MAP[symbol] ?? symbol).toLowerCase();
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
  }, [symbol, period]);

  return (
    <div className="flex flex-col h-full bg-[hsl(0_0%_4%)]">
      <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-border shrink-0 bg-card/20">
        <span className="text-[10px] font-mono text-muted-foreground mr-2 uppercase tracking-widest">Chart</span>
        <span
          className={`flex items-center gap-1 mr-2 text-[9px] font-mono font-bold uppercase tracking-wider ${
            live ? "text-emerald-400" : "text-muted-foreground"
          }`}
          title={live ? "Live WebSocket stream" : "Polling fallback"}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${live ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/50"}`} />
          {live ? "LIVE" : "···"}
        </span>
        <button
          onClick={() => setTa((v) => !v)}
          title="ניתוח טכני: EMA, תמיכה/התנגדות, איתות קנייה/מכירה"
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
          title="ניתוח אוטומטי מוקש: מאגד מגמה חזוקה מכל האינדיקטורים"
          className="px-2 py-0.5 mr-1 text-[10px] font-mono font-bold rounded transition-colors bg-primary/15 text-primary hover:bg-primary/25"
        >
          ניתח
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
      </div>
      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="absolute inset-0" />
        {loading && (
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
          <div className="absolute top-2 left-2 right-2 max-w-sm mx-auto rounded-lg border border-border/80 bg-card/95 backdrop-blur p-3 shadow-lg z-10">
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
