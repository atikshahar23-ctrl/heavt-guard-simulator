import { useState } from "react";
import { useGetMarketOverview, getGetMarketOverviewQueryKey } from "@workspace/api-client-react";
import { useLivePrices } from "@/contexts/live-price-context";
import { TrendingUp, TrendingDown, Pause, Play } from "lucide-react";

function fmtPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (p >= 1) return p.toFixed(2);
  return p.toFixed(4);
}

/**
 * Slim Binance-style scrolling price tape across the top of the workspace.
 * Live WS price wins over the 30s poll; hover pauses the scroll for reading.
 */
export function TickerTape() {
  const { data: overview } = useGetMarketOverview({
    query: { queryKey: getGetMarketOverviewQueryKey(), refetchInterval: 30000, staleTime: 20000 },
  });
  const { get: getLive } = useLivePrices();
  const [paused, setPaused] = useState(false);

  const coins = (overview ?? []).filter((c) => Number.isFinite(c.price) && c.price > 0);
  if (coins.length === 0) return null;

  // Duplicate the row so the -50% scroll loops seamlessly.
  const row = [...coins, ...coins];

  return (
    <div className="relative z-10 shrink-0 h-8 overflow-hidden border-b border-border/70 bg-[hsl(0_0%_3%)]">
      <div className="absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[hsl(0_0%_3%)] to-transparent pointer-events-none" />
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        aria-label={paused ? "הפעל גלילת מחירים" : "השהה גלילת מחירים"}
        title={paused ? "הפעל" : "השהה"}
        className="absolute inset-y-0 right-0 z-20 flex w-8 items-center justify-center bg-gradient-to-l from-[hsl(0_0%_3%)] via-[hsl(0_0%_3%)] to-transparent text-muted-foreground hover:text-primary transition-colors"
      >
        {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
      </button>
      <div className={`ticker-track flex h-full w-max items-center gap-6 whitespace-nowrap px-4${paused ? " ticker-paused" : ""}`}>
        {row.map((c, i) => {
          const live = getLive(c.asset)?.price ?? c.price;
          const up = c.changePercent >= 0;
          return (
            <div key={`${c.asset}-${i}`} className="flex items-center gap-1.5 text-[11px] font-mono">
              <span className="font-bold text-foreground/90 tracking-wide">{c.asset}</span>
              <span className="text-foreground/70">${fmtPrice(live)}</span>
              <span className={`flex items-center gap-0.5 font-semibold ${up ? "text-emerald-400" : "text-red-400"}`}>
                {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {up ? "+" : ""}{c.changePercent.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
