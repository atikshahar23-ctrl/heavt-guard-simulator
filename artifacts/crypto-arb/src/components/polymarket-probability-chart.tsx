import { useEffect, useRef, useId } from "react";
import {
  createChart,
  LineSeries,
  ColorType,
  LineStyle,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type UTCTimestamp,
  type Time,
  type SeriesMarker,
} from "lightweight-charts";
import {
  useGetPolymarketPriceHistory,
  getGetPolymarketPriceHistoryQueryKey,
} from "@workspace/api-client-react";
import { israelTickMarkFormatter, israelTimeFormatter } from "../lib/timezone";
import { useLanguage } from "@/contexts/language-context";
import { t } from "@/lib/i18n";

interface Props {
  conditionId: string;
  /** CLOB YES-token ID — preferred over conditionId for the price-history API. */
  tokenId?: string | null;
  entryTs?: number;
  entryPrice?: number;
  exitTs?: number;
  exitPrice?: number;
  openPosition?: boolean;
  height?: number;
}

function snapTime(
  data: LineData<UTCTimestamp>[],
  targetSec: number,
): UTCTimestamp | null {
  if (data.length === 0) return null;
  let best = data[0].time as number;
  let bestDiff = Math.abs(best - targetSec);
  for (const d of data) {
    const diff = Math.abs((d.time as number) - targetSec);
    if (diff < bestDiff) {
      best = d.time as number;
      bestDiff = diff;
    }
  }
  return best as UTCTimestamp;
}

export function PolymarketProbabilityChart({
  conditionId,
  tokenId,
  entryTs,
  entryPrice,
  exitTs,
  exitPrice,
  openPosition = false,
  height = 200,
}: Props) {
  const { lang, dir } = useLanguage();
  const uid = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const interval = openPosition ? "1h" : "1d";
  // The Polymarket CLOB price-history API requires the YES-token ID, not the conditionId.
  // Fall back to conditionId for legacy positions that were opened before tokenId was stored.
  const marketId = (tokenId ?? conditionId) || conditionId;

  const { data, isLoading, isError } = useGetPolymarketPriceHistory(
    { marketId, interval },
    {
      query: {
        queryKey: getGetPolymarketPriceHistoryQueryKey({ marketId, interval }),
        staleTime: 5 * 60 * 1000,
        refetchInterval: openPosition ? 5 * 60 * 1000 : false,
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
      rightPriceScale: {
        borderColor: "hsl(0 0% 13%)",
        scaleMargins: { top: 0.15, bottom: 0.15 },
      },
      localization: {
        timeFormatter: israelTimeFormatter,
        priceFormatter: (p: number) => `${(p * 100).toFixed(1)}%`,
      },
      timeScale: {
        borderColor: "hsl(0 0% 13%)",
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: israelTickMarkFormatter,
      },
      crosshair: { mode: 1 },
      width: el.clientWidth,
      height,
    });
    chartRef.current = chart;

    const series = chart.addSeries(LineSeries, {
      color: "#38bdf8",
      lineWidth: 2,
      priceLineVisible: false,
    });
    seriesRef.current = series;

    let disposed = false;
    const ro = new ResizeObserver(() => {
      if (disposed || !el) return;
      try {
        chart.applyOptions({ width: el.clientWidth });
      } catch {
        /* chart disposed */
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, height]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart || !data || data.length === 0) return;

    const lineData: LineData<UTCTimestamp>[] = data
      .map((p) => ({ time: p.t as UTCTimestamp, value: parseFloat(p.p) }))
      .filter((d) => Number.isFinite(d.value))
      .sort((a, b) => (a.time as number) - (b.time as number));

    if (lineData.length === 0) return;

    series.setData(lineData);

    if (Number.isFinite(entryPrice)) {
      series.createPriceLine({
        price: entryPrice as number,
        color: "#38bdf8",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `${t("tdc.entry", lang)} ${((entryPrice as number) * 100).toFixed(1)}%`,
      });
    }

    if (Number.isFinite(exitPrice) && !openPosition) {
      const won = exitPrice! > (entryPrice ?? 0);
      series.createPriceLine({
        price: exitPrice as number,
        color: won ? "#22c55e" : "#ef4444",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `${t("tdc.exit", lang)} ${((exitPrice as number) * 100).toFixed(1)}%`,
      });
    }

    const markers: SeriesMarker<Time>[] = [];
    if (entryTs != null) {
      const snap = snapTime(lineData, entryTs);
      if (snap !== null) {
        markers.push({
          time: snap as Time,
          position: "belowBar",
          color: "#38bdf8",
          shape: "arrowUp",
          text: t("tdc.entry", lang),
        });
      }
    }
    if (exitTs != null && !openPosition) {
      const snap = snapTime(lineData, exitTs);
      const entrySnap = entryTs != null ? snapTime(lineData, entryTs) : null;
      if (snap !== null && snap !== entrySnap) {
        const won = (exitPrice ?? 0) > (entryPrice ?? 0);
        markers.push({
          time: snap as Time,
          position: "aboveBar",
          color: won ? "#22c55e" : "#ef4444",
          shape: "circle",
          text: t("tdc.exit", lang),
        });
      }
    }
    markers.sort((a, b) => (a.time as number) - (b.time as number));
    const markersApi = createSeriesMarkers(series, markers);

    if (entryTs != null && !openPosition && exitTs != null) {
      const first = lineData[0].time as number;
      const last = lineData[lineData.length - 1].time as number;
      const pad = Math.max((exitTs - entryTs) * 0.2, 3600);
      const from = Math.max(entryTs - pad, first);
      const to = Math.min(exitTs + pad, last);
      if (to > from) {
        try {
          chart.timeScale().setVisibleRange({ from: from as Time, to: to as Time });
        } catch {
          chart.timeScale().fitContent();
        }
      } else {
        chart.timeScale().fitContent();
      }
    } else {
      chart.timeScale().fitContent();
    }

    return () => {
      try {
        markersApi.setMarkers([]);
        markersApi.detach();
      } catch {
        /* noop */
      }
    };
  }, [data, entryTs, entryPrice, exitTs, exitPrice, openPosition, lang]);

  if (isLoading) {
    return (
      <div
        className="rounded-lg border border-border/40 bg-[hsl(0_0%_4%)] flex items-center justify-center"
        style={{ height }}
      >
        <span className="text-xs font-mono text-muted-foreground animate-pulse" dir={dir}>
          {t("pp.loadingProb", lang)}
        </span>
      </div>
    );
  }

  if (isError || !data || data.length === 0) {
    return (
      <div
        className="rounded-lg border border-border/40 bg-[hsl(0_0%_4%)] flex items-center justify-center"
        style={{ height }}
      >
        <span className="text-xs font-mono text-muted-foreground/60" dir={dir}>
          {t("pp.noHistory", lang)}
        </span>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg border border-border/40 overflow-hidden" style={{ height }}>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
