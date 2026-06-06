import { useEffect, useRef, useState } from "react";
import {
  createChart,
  AreaSeries,
  ColorType,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type MouseEventParams,
} from "lightweight-charts";
import type { FundingRatePoint } from "@workspace/api-client-react";

interface Props {
  /** Oldest→newest funding points. `metric` selects which field is plotted. */
  series: FundingRatePoint[];
  /** Plot annualized funding (default) or the raw per-interval funding. */
  metric?: "annualized" | "interval";
  /** Optional average value (same unit as `metric`) drawn as a reference line. */
  avgValue?: number | null;
  /** "%" suffix shown in the crosshair tooltip. */
  unitSuffix?: string;
}

/**
 * Funding-rate area chart (gold theme). Plots the funding stream over time with a
 * zero baseline so positive (collectable) vs negative (paying) regimes read at a
 * glance, an optional dashed average reference line, and a floating crosshair
 * tooltip with the precise value + timestamp. lightweight-charts v5 API:
 * addSeries(AreaSeries, opts).
 */
export function FundingChart({ series, metric = "annualized", avgValue = null, unitSuffix = "%" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const avgLineRef = useRef<ReturnType<ISeriesApi<"Area">["createPriceLine"]> | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; value: number; time: number } | null>(null);

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
      crosshair: {
        mode: 1,
        vertLine: { color: "hsl(43 74% 52% / 0.5)", width: 1, style: LineStyle.Dotted, labelBackgroundColor: "hsl(43 74% 52%)" },
        horzLine: { color: "hsl(43 74% 52% / 0.5)", width: 1, style: LineStyle.Dotted, labelBackgroundColor: "hsl(43 74% 52%)" },
      },
      width: el.clientWidth,
      height: el.clientHeight,
    });
    chartRef.current = chart;

    const s = chart.addSeries(AreaSeries, {
      lineColor: "hsl(43 74% 52%)",
      topColor: "hsl(43 74% 52% / 0.35)",
      bottomColor: "hsl(43 74% 52% / 0.02)",
      lineWidth: 2,
      priceLineVisible: false,
      baseLineVisible: true,
      baseLineColor: "hsl(0 0% 30%)",
      baseLineStyle: LineStyle.Dashed,
      priceFormat: { type: "custom", formatter: (p: number) => `${p.toFixed(2)}${unitSuffix}` },
    });
    seriesRef.current = s;

    const onMove = (param: MouseEventParams) => {
      if (!param.point || param.time === undefined || !param.seriesData.has(s)) {
        setTip(null);
        return;
      }
      const d = param.seriesData.get(s) as { value?: number } | undefined;
      if (!d || typeof d.value !== "number") {
        setTip(null);
        return;
      }
      setTip({ x: param.point.x, y: param.point.y, value: d.value, time: param.time as number });
    };
    chart.subscribeCrosshairMove(onMove);

    let disposed = false;
    const ro = new ResizeObserver(() => {
      if (disposed || !el) return;
      try {
        chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
      } catch {
        // chart disposed between resize event and callback
      }
    });
    ro.observe(el);

    return () => {
      disposed = true;
      ro.disconnect();
      chart.unsubscribeCrosshairMove(onMove);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      avgLineRef.current = null;
    };
  }, [unitSuffix]);

  useEffect(() => {
    const s = seriesRef.current;
    const chart = chartRef.current;
    if (!s || !chart) return;
    const data = series
      .filter((p) => Number.isFinite(p.time))
      .map((p) => ({
        time: p.time as UTCTimestamp,
        value: metric === "annualized" ? p.annualizedPercent : p.fundingRatePercent,
      }));
    s.setData(data);
    chart.timeScale().fitContent();
  }, [series, metric]);

  // Average reference line — recreated whenever the average changes.
  useEffect(() => {
    const s = seriesRef.current;
    if (!s) return;
    if (avgLineRef.current) {
      s.removePriceLine(avgLineRef.current);
      avgLineRef.current = null;
    }
    if (avgValue != null && Number.isFinite(avgValue)) {
      avgLineRef.current = s.createPriceLine({
        price: avgValue,
        color: "hsl(0 0% 55%)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "avg",
      });
    }
  }, [avgValue]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {tip && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-border/70 bg-card/95 px-2 py-1 font-mono text-[10px] shadow-lg backdrop-blur"
          style={{
            left: Math.min(Math.max(tip.x + 12, 4), (containerRef.current?.clientWidth ?? 0) - 110),
            top: Math.max(tip.y - 36, 4),
          }}
          dir="ltr"
        >
          <div className="font-bold" style={{ color: tip.value >= 0 ? "#22c55e" : "#ef4444" }}>
            {tip.value >= 0 ? "+" : ""}{tip.value.toFixed(2)}{unitSuffix}
          </div>
          <div className="text-muted-foreground">
            {new Date(tip.time * 1000).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      )}
    </div>
  );
}
