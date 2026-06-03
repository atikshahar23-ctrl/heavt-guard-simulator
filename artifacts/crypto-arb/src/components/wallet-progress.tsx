import { useEffect, useRef, useMemo } from "react";
import {
  createChart,
  AreaSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type AreaData,
  type UTCTimestamp,
} from "lightweight-charts";
import { usePortfolio } from "@/contexts/portfolio-context";
import { TrendingUp, TrendingDown, LineChart as LineChartIcon } from "lucide-react";

function fmtUsd(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Realized equity curve for the active wallet: baseline = totalDeposited, then
 * cumulative realized PnL applied in closedAt order. This reflects the wallet's
 * account growth from closed trades (open-position MTM is excluded so the curve
 * is stable and only steps on realized events).
 */
export function WalletProgress() {
  const { tradeHistory, totalDeposited, activeWalletName, activeWalletId } = usePortfolio();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  const { points, realizedPnl, isUp } = useMemo(() => {
    const closed = [...tradeHistory]
      .filter((t) => t.closedAt)
      .sort((a, b) => new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime());

    const realized = closed.reduce((s, t) => s + t.pnl, 0);

    // Baseline equity = total deposited (before any realized PnL). The curve then
    // steps by each closed trade's PnL, so the final point equals
    // totalDeposited + realizedPnl (deposits aren't timestamped, so the baseline
    // is treated as the starting equity).
    const base = totalDeposited;
    const pts: AreaData[] = [];

    if (closed.length > 0) {
      const firstTs = Math.floor(new Date(closed[0].closedAt).getTime() / 1000) - 1;
      pts.push({ time: firstTs as UTCTimestamp, value: base });
    }

    let running = base;
    // Bucket multiple trades sharing a timestamp by nudging seconds so the
    // lightweight-charts time axis (which requires strictly ascending times) stays valid.
    let lastTs = -1;
    for (const t of closed) {
      running += t.pnl;
      let ts = Math.floor(new Date(t.closedAt).getTime() / 1000);
      if (ts <= lastTs) ts = lastTs + 1;
      lastTs = ts;
      pts.push({ time: ts as UTCTimestamp, value: Number(running.toFixed(2)) });
    }

    return { points: pts, realizedPnl: realized, isUp: realized >= 0 };
  }, [tradeHistory, totalDeposited]);

  useEffect(() => {
    if (!containerRef.current) return;

    const up = isUp;
    const line = up ? "#34d399" : "#f87171";
    const top = up ? "rgba(52, 211, 153, 0.25)" : "rgba(248, 113, 113, 0.25)";
    const bottom = up ? "rgba(52, 211, 153, 0.02)" : "rgba(248, 113, 113, 0.02)";

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#71717a",
        fontFamily: "'Space Mono', monospace",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.06)" },
      timeScale: { borderColor: "rgba(255,255,255,0.06)", timeVisible: true, secondsVisible: false },
      handleScroll: false,
      handleScale: false,
      crosshair: { horzLine: { visible: false }, vertLine: { labelVisible: false } },
      height: containerRef.current.clientHeight || 200,
      width: containerRef.current.clientWidth,
    });
    chartRef.current = chart;

    const series = chart.addSeries(AreaSeries, {
      lineColor: line,
      topColor: top,
      bottomColor: bottom,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    seriesRef.current = series;

    if (points.length > 0) {
      series.setData(points);
      chart.timeScale().fitContent();
    }

    let disposed = false;
    const ro = new ResizeObserver(() => {
      if (disposed || !containerRef.current) return;
      try {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight || 200,
        });
      } catch {
        // chart was disposed between the resize event and this callback
      }
    });
    ro.observe(containerRef.current);

    return () => {
      disposed = true;
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // Rebuild fully when the active wallet changes or the data/direction changes.
  }, [points, isUp, activeWalletId]);

  const pct = totalDeposited > 0 ? (realizedPnl / totalDeposited) * 100 : 0;
  const hasData = points.length > 1;

  return (
    <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <LineChartIcon className="h-4 w-4 text-primary" />
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-foreground">
            התקדמות הארנק
          </span>
          <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[120px]">· {activeWalletName}</span>
        </div>
        <div className={`flex items-center gap-1 text-xs font-mono font-bold ${isUp ? "text-emerald-400" : "text-red-400"}`}>
          {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {realizedPnl >= 0 ? "+" : ""}{fmtUsd(realizedPnl)}
          <span className="text-muted-foreground">({pct >= 0 ? "+" : ""}{pct.toFixed(1)}%)</span>
        </div>
      </div>
      <div className="relative h-[200px]">
        <div ref={containerRef} className="absolute inset-0" />
        {!hasData && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <LineChartIcon className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs font-mono text-muted-foreground">אין עדיין עסקאות סגורות</p>
            <p className="text-[10px] font-mono text-muted-foreground/70">הגרף יתעדכן ככל שתסגור פוזיציות</p>
          </div>
        )}
      </div>
    </div>
  );
}
