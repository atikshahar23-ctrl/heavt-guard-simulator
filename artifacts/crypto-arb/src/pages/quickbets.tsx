import { useState, useEffect } from "react";
import { useGetShortTermMarkets, getGetShortTermMarketsQueryKey } from "@workspace/api-client-react";
import type { PolymarketMarket } from "@workspace/api-client-react";
import { Timer, RefreshCw, ExternalLink, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useFavorites } from "@/contexts/favorites-context";

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function countdown(endDate: string | null | undefined, now: number): { text: string; urgent: boolean } {
  if (!endDate) return { text: "—", urgent: false };
  const ms = new Date(endDate).getTime() - now;
  if (ms <= 0) return { text: "resolving", urgent: true };
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  if (h >= 1) return { text: `${h}h ${m}m`, urgent: h < 2 };
  return { text: `${m}m ${s}s`, urgent: true };
}

function BetCard({ m, now }: { m: PolymarketMarket; now: number }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favId = `market:${m.conditionId}`;
  const fav = isFavorite(favId);
  const cd = countdown(m.endDate, now);
  const yes = m.yesProbabilityPercent;
  const url = m.eventSlug ? `https://polymarket.com/event/${m.eventSlug}` : "https://polymarket.com";

  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <button
            onClick={() => toggleFavorite({ id: favId, kind: "market", symbol: m.assetTag, label: m.question })}
            className="flex-shrink-0 mt-0.5"
            aria-label="Toggle favorite"
          >
            <Star
              className="h-3.5 w-3.5 transition-colors"
              style={{ color: fav ? "hsl(43 74% 52%)" : "#52525b", fill: fav ? "hsl(43 74% 52%)" : "transparent" }}
            />
          </button>
          <p className="text-sm font-medium text-foreground/90 leading-snug line-clamp-3">{m.question}</p>
        </div>
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary flex-shrink-0">
          {m.assetTag}
        </span>
      </div>

      {/* Probability bar */}
      <div>
        <div className="flex items-center justify-between text-[10px] font-mono mb-1">
          <span className="text-emerald-400 font-bold">YES {yes.toFixed(1)}%</span>
          <span className="text-red-400 font-bold">NO {(100 - yes).toFixed(1)}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-red-500/20 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, yes))}%` }} />
        </div>
      </div>

      {/* Footer: countdown + link */}
      <div className="flex items-center justify-between border-t border-border/50 pt-2">
        <div
          className="flex items-center gap-1.5 text-xs font-mono font-bold"
          style={{ color: cd.urgent ? "#ef4444" : "hsl(43 74% 52%)" }}
        >
          <Timer className="h-3.5 w-3.5" />
          {cd.text}
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-primary transition-colors"
        >
          Trade <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

export default function QuickBetsPage() {
  const now = useNow(1000);
  const { data, isLoading, isFetching } = useGetShortTermMarkets({
    query: {
      queryKey: getGetShortTermMarketsQueryKey(),
      refetchInterval: 60000,
      staleTime: 45000,
    },
  });

  const markets = data ?? [];

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-black tracking-tight">Quick Bets</h1>
            {isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Short-term crypto prediction markets resolving within 48h — soonest first.
          </p>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground hidden sm:block">{markets.length} markets</span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : markets.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">No near-term crypto markets available right now.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {markets.map((m) => (
            <BetCard key={m.conditionId} m={m} now={now} />
          ))}
        </div>
      )}
    </div>
  );
}
