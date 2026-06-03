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
  const [range, setRange] = useState<RangeKey>("1mo");

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

    const ro = new ResizeObserver(() => {
      if (el) chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);

    return () => {
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

  return (
    <div className="flex flex-col h-full bg-[hsl(0_0%_4%)] rounded-lg border border-border overflow-hidden">
      <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-border shrink-0 bg-card/20">
        <span className="text-[10px] font-mono text-muted-foreground mr-2 uppercase tracking-widest">Chart</span>
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
      </div>
    </div>
  );
}
