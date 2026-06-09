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
import { useGetStockKlines, getGetStockKlinesQueryKey } from "@workspace/api-client-react";
import { applyTAOverlays, type TAHandle, autoAnalyze, type AnalysisResult } from "../lib/ta";
import { israelTickMarkFormatter, israelTimeFormatter } from "../lib/timezone";
import { TradingViewAdvancedChart } from "./tradingview-advanced-chart";
import { usePortfolio, type StockPosition } from "@/contexts/portfolio-context";
import { useLanguage } from "@/contexts/language-context";
import { t } from "@/lib/i18n";

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
  /** Optional TradingView symbol (e.g. "NASDAQ:AAPL", "BRK.B"). Defaults to `symbol`. */
  tvSymbol?: string;
}

type PriceLineHandles = { entry: IPriceLine; sl?: IPriceLine; tp?: IPriceLine };

export function StockChart({ symbol, tvSymbol }: Props) {
  const { lang } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const taRef = useRef<TAHandle | null>(null);
  const priceLineMapRef = useRef<Map<string, PriceLineHandles>>(new Map());
  const lastCloseRef = useRef<number>(0);

  const [range, setRange] = useState<RangeKey>("1mo");
  const [ta, setTa] = useState(true);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [mode, setMode] = useState<"live" | "pro">("live");

  const { stockPositions, closeStockPosition } = usePortfolio();
  const positions: StockPosition[] = stockPositions.filter((p) => p.symbol === symbol);

  const { data, isLoading, isError } = useGetStockKlines(
    { symbol, range },
    {
      query: {
        queryKey: getGetStockKlinesQueryKey({ symbol, range }),
        refetchInterval: mode === "pro" ? false : range === "1d" || range === "5d" ? 20000 : 60000,
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
      localization: { timeFormatter: israelTimeFormatter },
      timeScale: {
        borderColor: "hsl(0 0% 13%)",
        timeVisible: range === "1d" || range === "5d",
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
    if (candles.length > 0) {
      lastCloseRef.current = candles[candles.length - 1].close;
    }
  }, [data]);

  // TA overlays
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

  // ── Open-position price lines ────────────────────────────────────────────────
  useEffect(() => {
    const series = seriesRef.current;

    for (const h of priceLineMapRef.current.values()) {
      try { series?.removePriceLine(h.entry); } catch { /* disposed */ }
      if (h.sl) try { series?.removePriceLine(h.sl); } catch { /* disposed */ }
      if (h.tp) try { series?.removePriceLine(h.tp); } catch { /* disposed */ }
    }
    priceLineMapRef.current.clear();

    if (!series || mode === "pro" || positions.length === 0) return;

    for (const pos of positions) {
      const dir = pos.direction ?? "LONG";
      const isLong = dir === "LONG";
      const entryColor = isLong ? "#10b981" : "#ef4444";
      const shortLabel = (pos.source ?? (pos.auto ? "Bot" : "Manual")).slice(0, 14);

      const entry = series.createPriceLine({
        price: pos.entryPrice,
        color: entryColor,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `${dir} ${pos.leverage}x · ${shortLabel}`,
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
  }, [positions, mode, data]);

  return (
    <div className="flex flex-col h-full bg-[hsl(0_0%_4%)] rounded-lg border border-border overflow-hidden">
      <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-border shrink-0 bg-card/20">
        <span className="text-[10px] font-mono text-muted-foreground mr-2 uppercase tracking-widest">Chart</span>
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
                if (data && data.length > 0) {
                  const candles = data.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }));
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
          </>
        )}
      </div>
      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="absolute inset-0" />

        {/* ── Open-position overlay cards ────────────────────────────────────── */}
        {mode === "live" && positions.length > 0 && (
          <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 max-h-[calc(100%-16px)] overflow-y-auto pointer-events-none">
            {positions.map((pos) => {
              const dir = pos.direction ?? "LONG";
              const isLong = dir === "LONG";
              const mark = lastCloseRef.current > 0 ? lastCloseRef.current : pos.entryPrice;
              const pnl = pos.shares * (isLong ? mark - pos.entryPrice : pos.entryPrice - mark);
              const pnlPct = pos.cost > 0 ? (pnl / pos.cost) * 100 : 0;
              const accent = isLong ? "#10b981" : "#ef4444";
              const pnlPositive = pnl >= 0;

              return (
                <div
                  key={pos.id}
                  className="pointer-events-auto rounded border bg-[hsl(0_0%_6%)/92] backdrop-blur-sm shadow-lg text-[10px] font-mono overflow-hidden"
                  style={{ borderColor: `${accent}50`, minWidth: "148px", maxWidth: "190px" }}
                >
                  <div className="flex items-center justify-between px-1.5 py-1 gap-1" style={{ background: `${accent}18` }}>
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="font-black" style={{ color: accent }}>{dir}</span>
                      <span className="text-[9px] font-bold px-1 rounded" style={{ background: `${accent}25`, color: accent }}>
                        {pos.leverage}x
                      </span>
                      <span className="truncate text-[9px] text-muted-foreground">{pos.source ?? (pos.auto ? "Bot" : "Manual")}</span>
                    </div>
                    <button
                      onClick={() => closeStockPosition(pos.id, mark)}
                      className="flex-shrink-0 rounded p-0.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/15 transition-all"
                      title={t("cc.closePosition", lang)}
                    >
                      <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 1l10 10M11 1L1 11" />
                      </svg>
                    </button>
                  </div>

                  <div className="px-1.5 py-1 space-y-0.5">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Entry</span>
                      <span>${pos.entryPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Now</span>
                      <span>{mark > 0 ? `$${mark.toFixed(2)}` : "—"}</span>
                    </div>
                    {pos.slPrice != null && (
                      <div className="flex justify-between gap-2 text-red-400/80">
                        <span>SL</span>
                        <span>${pos.slPrice.toFixed(2)}</span>
                      </div>
                    )}
                    {pos.tpPrice != null && (
                      <div className="flex justify-between gap-2 text-emerald-400/80">
                        <span>TP</span>
                        <span>${pos.tpPrice.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-2 pt-0.5 border-t border-border/40">
                      <span className="text-muted-foreground">Cost</span>
                      <span>${pos.cost.toFixed(2)}</span>
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
            <TradingViewAdvancedChart tvSymbol={tvSymbol ?? symbol} interval="D" />
          </div>
        )}
        {mode === "live" && isLoading && (
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
