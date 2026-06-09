import { useMemo, useState } from "react";
import {
  useGetMarketOverview,
  getGetMarketOverviewQueryKey,
  useGetStocks,
  getGetStocksQueryKey,
} from "@workspace/api-client-react";
import { useLivePrices } from "@/contexts/live-price-context";
import { TrendingUp, TrendingDown, Pause, Play } from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
import { t as tr } from "@/lib/i18n";

function fmtPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (p >= 1) return p.toFixed(2);
  return p.toFixed(4);
}

type Tick = { key: string; label: string; price: number; changePercent: number; kind: "index" | "stock" | "crypto" };

/** Central large-caps to surface in the tape, in display order. */
const CENTRAL_STOCKS = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "TSLA", "META", "JPM"];

/**
 * Slim Binance-style scrolling price tape across the top of the workspace.
 * Shows major indices, central stocks, and live crypto. Live WS price wins for
 * crypto; hover or the pause button stops the scroll for reading.
 */
export function TickerTape() {
  const { data: overview } = useGetMarketOverview({
    query: { queryKey: getGetMarketOverviewQueryKey(), refetchInterval: 30000, staleTime: 20000 },
  });
  const { data: stocks } = useGetStocks({
    query: { queryKey: getGetStocksQueryKey(), refetchInterval: 60000, staleTime: 45000 },
  });
  const { get: getLive } = useLivePrices();
  const [paused, setPaused] = useState(false);
  const { lang } = useLanguage();

  // Heavy filter/find work only recomputes when the underlying data changes,
  // not on every 250ms live-price tick.
  const indices = useMemo<Tick[]>(
    () =>
      (stocks ?? [])
        .filter((s) => s.category === "INDEX" && Number.isFinite(s.price) && s.price > 0)
        .map((s) => ({ key: `idx-${s.symbol}`, label: s.name, price: s.price, changePercent: s.changePercent, kind: "index" })),
    [stocks],
  );

  const centralStocks = useMemo<Tick[]>(
    () =>
      CENTRAL_STOCKS.map((sym) => (stocks ?? []).find((s) => s.symbol === sym))
        .filter((s): s is NonNullable<typeof s> => !!s && Number.isFinite(s.price) && s.price > 0)
        .map((s) => ({ key: `stk-${s.symbol}`, label: s.symbol, price: s.price, changePercent: s.changePercent, kind: "stock" })),
    [stocks],
  );

  const coinsBase = useMemo(
    () =>
      (overview ?? [])
        .filter((c) => Number.isFinite(c.price) && c.price > 0)
        .map((c) => ({ asset: c.asset, price: c.price, changePercent: c.changePercent })),
    [overview],
  );

  // Live price overlay is the only part that needs to update each tick.
  const coins: Tick[] = coinsBase.map((c) => ({
    key: `crypto-${c.asset}`,
    label: c.asset,
    price: getLive(c.asset)?.price ?? c.price,
    changePercent: c.changePercent,
    kind: "crypto",
  }));

  if (indices.length + centralStocks.length + coins.length === 0) return null;

  // Duplicate the row so the -50% scroll loops seamlessly.
  const row = [...indices, ...centralStocks, ...coins, ...indices, ...centralStocks, ...coins];

  return (
    <div className="relative z-10 shrink-0 h-8 overflow-hidden border-b border-border/70 bg-[hsl(0_0%_3%)]">
      <div className="absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[hsl(0_0%_3%)] to-transparent pointer-events-none" />
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        aria-label={paused ? tr("tt.playScroll", lang) : tr("tt.pauseScroll", lang)}
        title={paused ? tr("tt.play", lang) : tr("tt.pause", lang)}
        className="absolute inset-y-0 right-0 z-20 flex w-8 items-center justify-center bg-gradient-to-l from-[hsl(0_0%_3%)] via-[hsl(0_0%_3%)] to-transparent text-muted-foreground hover:text-primary transition-colors"
      >
        {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
      </button>
      <div className={`ticker-track flex h-full w-max items-center gap-6 whitespace-nowrap px-4${paused ? " ticker-paused" : ""}`}>
        {row.map((t, i) => {
          const up = t.changePercent >= 0;
          return (
            <div key={`${t.key}-${i}`} className="flex items-center gap-1.5 text-[11px] font-mono">
              {t.kind === "index" && <span className="text-[8px] font-bold text-primary/70 tracking-widest">IDX</span>}
              <span className="font-bold text-foreground/90 tracking-wide">{t.label}</span>
              <span className="text-foreground/70">${fmtPrice(t.price)}</span>
              <span className={`flex items-center gap-0.5 font-semibold ${up ? "text-emerald-400" : "text-red-400"}`}>
                {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {up ? "+" : ""}{t.changePercent.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
