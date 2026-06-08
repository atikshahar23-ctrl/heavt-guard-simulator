import { useState, useEffect } from "react";
import { useGetShortTermMarkets, getGetShortTermMarketsQueryKey } from "@workspace/api-client-react";
import type { PolymarketMarket } from "@workspace/api-client-react";
import { Timer, RefreshCw, ExternalLink, Star, Zap, ArrowUpRight, TrendingUp, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useFavorites } from "@/contexts/favorites-context";
import { usePortfolio } from "@/contexts/portfolio-context";
import { CryptoIcon } from "@/components/crypto-icon";

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

function smartPick(m: PolymarketMarket): { side: "YES" | "NO"; confidence: number; reason: string } {
  const yes = m.yesProbabilityPercent;
  if (yes <= 25) return { side: "YES", confidence: 0.85, reason: "YES זול — ערך מוסרי" };
  if (yes >= 75) return { side: "NO", confidence: 0.85, reason: "NO זול — ערך מוסרי" };
  if (yes < 45) return { side: "YES", confidence: 0.55, reason: "YES קל יותר" };
  if (yes > 55) return { side: "NO", confidence: 0.55, reason: "NO קל יותר" };
  return { side: "YES", confidence: 0.5, reason: "50/50 — קל יותר" };
}

function QuickBetCard({ m, now }: { m: PolymarketMarket; now: number }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const { cash, openPolyPosition } = usePortfolio();
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const favId = `market:${m.conditionId}`;
  const fav = isFavorite(favId);
  const cd = countdown(m.endDate, now);
  const yes = m.yesProbabilityPercent;
  const url = m.eventSlug ? `https://polymarket.com/event/${m.eventSlug}` : "https://polymarket.com";
  const smart = smartPick(m);

  const canAfford = cash >= 50;
  const stake = Math.min(200, Math.max(50, Math.floor(cash * 0.05)));
  const fairYes = smart.side === "YES" ? yes : 100 - yes;

  function doBet() {
    if (!canAfford) { setStatus({ ok: false, msg: "אין מספיק מזומן" }); return; }
    const err = openPolyPosition(
      {
        conditionId: m.conditionId,
        question: m.question,
        category: m.assetTag ?? "crypto",
        slug: m.eventSlug ?? null,
        side: smart.side,
        entryPrice: fairYes / 100,
      },
      stake,
    );
    if (err) { setStatus({ ok: false, msg: err }); return; }
    setStatus({ ok: true, msg: `${smart.side} $${stake} → ${m.assetTag}` });
    setTimeout(() => setStatus(null), 3000);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
      {/* Header: question + asset tag */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <button
            onClick={() => toggleFavorite({ id: favId, kind: "market", symbol: m.assetTag, label: m.question })}
            className="flex-shrink-0 mt-0.5"
            aria-label="Toggle favorite"
          >
            <Star
              className="h-3.5 w-3.5 transition-colors"
              style={{ color: fav ? "hsl(207 30% 70%)" : "#52525b", fill: fav ? "hsl(207 30% 70%)" : "transparent" }}
            />
          </button>
          <p className="text-sm font-medium text-foreground/90 leading-snug line-clamp-3">{m.question}</p>
        </div>
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary flex-shrink-0 flex items-center gap-1">
          <CryptoIcon asset={m.assetTag} size={14} /> {m.assetTag}
        </span>
      </div>

      {/* Smart pick badge */}
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-1 rounded ${
          smart.side === "YES" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
        }`}>
          {smart.side === "YES" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          בוט: {smart.side} — {smart.reason}
        </span>
        <span className="text-[9px] font-mono text-muted-foreground">{Math.round(smart.confidence * 100)}% בטחון</span>
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

      {/* Footer: countdown + quick bet + external link */}
      <div className="flex items-center justify-between border-t border-border/50 pt-2">
        <div
          className="flex items-center gap-1.5 text-xs font-mono font-bold"
          style={{ color: cd.urgent ? "#ef4444" : "hsl(207 30% 70%)" }}
        >
          <Timer className="h-3.5 w-3.5" />
          {cd.text}
        </div>
        <div className="flex items-center gap-2">
          {status && (
            <span className={`text-[10px] font-mono ${status.ok ? "text-emerald-400" : "text-red-400"}`}>
              {status.msg}
            </span>
          )}
          <button
            onClick={doBet}
            disabled={!canAfford}
            className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-mono font-bold bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-40 transition-colors"
          >
            <Zap className="h-3 w-3" /> ${stake} {smart.side}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default function QuickBetsPage() {
  const now = useNow(1000);
  const { isFavorite } = useFavorites();
  const [showFavOnly, setShowFavOnly] = useState(false);

  const { data, isLoading, isFetching } = useGetShortTermMarkets({
    query: {
      queryKey: getGetShortTermMarketsQueryKey(),
      refetchInterval: 60000,
      staleTime: 45000,
    },
  });

  const markets = data ?? [];

  const filtered = showFavOnly
    ? markets.filter((m) => isFavorite(`market:${m.conditionId}`))
    : markets;

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
            שווקי חיזוי קצרי-טווח עם פתרון תוך 48 שעות — בוט חכם ממליץ צד לכל שוק.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFavOnly((v) => !v)}
            className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-mono font-bold transition-colors ${
              showFavOnly ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Star className="h-3 w-3" style={{ fill: showFavOnly ? "hsl(207 30% 70%)" : "transparent" }} />
            {showFavOnly ? "מועדפים" : "הכל"}
          </button>
          <span className="text-[10px] font-mono text-muted-foreground hidden sm:block">{filtered.length} markets</span>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <Zap className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {showFavOnly ? "אין שווקים מועדפים — סמן כוכב כדי לעקוב" : "אין שווקי חיזוי זמינים כרגע."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((m) => (
            <QuickBetCard key={m.conditionId} m={m} now={now} />
          ))}
        </div>
      )}
    </div>
  );
}
