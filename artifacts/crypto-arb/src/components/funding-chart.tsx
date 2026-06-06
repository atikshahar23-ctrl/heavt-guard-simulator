import { useEffect, useRef } from "react";
import {
  createChart,
  AreaSeries,
  ColorType,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { FundingRatePoint } from "@workspace/api-client-react";

interface Props {
  /** Oldest→newest funding points. `metric` selects which field is plotted. */
  series: FundingRatePoint[];
  /** Plot annualized funding (default) or the raw per-interval funding. */
  metric?: "annualized" | "interval";
}

/**
 * Funding-rate area chart (gold theme). Plots the funding stream over time with a
 * zero baseline so positive (collectable) vs negative (paying) regimes read at a
 * glance. lightweight-charts v5 API: addSeries(AreaSeries, opts).
 */
export function FundingChart({ series, metric = "annualized" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

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

    const s = chart.addSeries(AreaSeries, {
      lineColor: "hsl(43 74% 52%)",
      topColor: "hsl(43 74% 52% / 0.35)",
      bottomColor: "hsl(43 74% 52% / 0.02)",
      lineWidth: 2,
      priceLineVisible: false,
      baseLineVisible: true,
      baseLineColor: "hsl(0 0% 30%)",
      baseLineStyle: LineStyle.Dashed,
    });
    seriesRef.current = s;

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
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

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

  return <div ref={containerRef} className="h-full w-full" />;
}
