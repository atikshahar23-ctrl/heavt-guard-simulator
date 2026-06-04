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
import { useGetStockKlines, getGetStockKlinesQueryKey } from "@workspace/api-client-react";
import { applyTAOverlays, type TAHandle, autoAnalyze, type AnalysisResult } from "../lib/ta";

const RANGES = [
  { key: "1d", label: "1D" },
  { key: "5d", label: "5D" },
  { key: "1mo", label: "1M" },
  { key: "6mo", label: "6M" },
  { key: "1y", label: "1Y" },
] as const;

type RangeKey = typeof RANGES[number]["key"];

interface Props {
  symbol: string;
}

export function StockChart({ symbol }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const taRef = useRef<TAHandle | null>(null);
  const [range, setRange] = useState<RangeKey>("1mo");
  const [ta, setTa] = useState(true);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const { data, isLoading, isError } = useGetStockKlines(
    { symbol, range },
    {
      query: {
        queryKey: getGetStockKlinesQueryKey({ symbol, range }),
        refetchInterval: range === "1d" || range === "5d" ? 20000 : 60000,
        staleTime: 15000,
      },
    },
  );

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
        timeVisible: range === "1d" || range === "5d",
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
  }, [range]);

  useEffect(() => {
    if (!seriesRef.current || !data) return;
    const candles: CandlestickData<UTCTimestamp>[] = data.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    seriesRef.current.setData(candles);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  // TA overlays (EMA / S-R / signals). Recomputed only on full data load or toggle
  // — never on a tick — so the live path stays untouched.
  useEffect(() => {
    taRef.current?.remove();
    taRef.current = null;
    if (!ta || !chartRef.current || !seriesRef.current || !data || data.length === 0) return;
    const candles = data.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    taRef.current = applyTAOverlays(chartRef.current, seriesRef.current, candles);
    return () => {
      taRef.current?.remove();
      taRef.current = null;
    };
  }, [data, ta]);

  return (
    <div className="flex flex-col h-full bg-[hsl(0_0%_4%)] rounded-lg border border-border overflow-hidden">
      <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-border shrink-0 bg-card/20">
        <span className="text-[10px] font-mono text-muted-foreground mr-2 uppercase tracking-widest">Chart</span>
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
            if (data && data.length > 0) {
              const candles = data.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }));
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
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
              range === r.key
                ? "bg-primary/20 text-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="absolute inset-0" />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-background/60">
            <span className="text-xs font-mono text-muted-foreground animate-pulse">Loading chart…</span>
          </div>
        )}
        {isError && !isLoading && (
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
