import { useState } from "react";
import { useGetScalpSignals, getGetScalpSignalsQueryKey } from "@workspace/api-client-react";
import type { ScalpSignal } from "@workspace/api-client-react";
import {
  Zap, TrendingUp, TrendingDown, Minus, RefreshCw, Target, Shield, LogIn, Star,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useFavorites } from "@/contexts/favorites-context";

function fmtPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(2);
  if (p >= 0.01) return p.toFixed(4);
  return p.toPrecision(3);
}

type DirFilter = "ALL" | "LONG" | "SHORT";

function dirMeta(direction: ScalpSignal["direction"]) {
  if (direction === "LONG") return { Icon: TrendingUp, color: "#22c55e", label: "LONG" };
  if (direction === "SHORT") return { Icon: TrendingDown, color: "#ef4444", label: "SHORT" };
  return { Icon: Minus, color: "#71717a", label: "NEUTRAL" };
}

function confColor(c: ScalpSignal["confidence"]): string {
  if (c === "HIGH") return "hsl(43 74% 52%)";
  if (c === "MEDIUM") return "#84cc16";
  return "#71717a";
}

function SignalCard({ s }: { s: ScalpSignal }) {
  const { Icon, color, label } = dirMeta(s.direction);
  const { isFavorite, toggleFavorite } = useFavorites();
  const favId = `coin:${s.asset}`;
  const fav = isFavorite(favId);

  return (
    <div
      className="rounded-lg border bg-card p-4 flex flex-col gap-3 transition-colors"
      style={{ borderColor: s.direction === "NEUTRAL" ? undefined : `${color}40` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => toggleFavorite({ id: favId, kind: "coin", symbol: s.asset, label: s.asset })}
            className="flex-shrink-0"
            aria-label="Toggle favorite"
          >
            <Star
              className="h-3.5 w-3.5 transition-colors"
              style={{ color: fav ? "hsl(43 74% 52%)" : "#52525b", fill: fav ? "hsl(43 74% 52%)" : "transparent" }}
            />
          </button>
          <span className="font-mono font-black text-base text-foreground">{s.asset}</span>
          <span className="text-[10px] font-mono text-muted-foreground">/USDT</span>
        </div>
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold text-xs"
          style={{ background: `${color}1a`, color }}
        >
          <Icon className="h-3 w-3" />
          {label}
        </div>
      </div>

      {/* Price + change */}
      <div className="flex items-end justify-between">
        <span className="font-mono text-lg font-bold text-foreground">${fmtPrice(s.price)}</span>
        <span className={`font-mono text-xs font-bold ${s.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {s.changePercent >= 0 ? "+" : ""}{s.changePercent.toFixed(2)}%
        </span>
      </div>

      {/* Entry / SL / TP */}
      {s.direction !== "NEUTRAL" && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded bg-secondary/40 py-1.5">
            <div className="flex items-center justify-center gap-1 text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">
              <LogIn className="h-2.5 w-2.5" /> Entry
            </div>
            <div className="font-mono text-xs font-bold text-foreground">${fmtPrice(s.entry)}</div>
          </div>
          <div className="rounded bg-red-500/10 py-1.5">
            <div className="flex items-center justify-center gap-1 text-[9px] font-mono text-red-400/80 uppercase tracking-wider mb-0.5">
              <Shield className="h-2.5 w-2.5" /> Stop
            </div>
            <div className="font-mono text-xs font-bold text-red-400">${fmtPrice(s.stopLoss)}</div>
          </div>
          <div className="rounded bg-emerald-500/10 py-1.5">
            <div className="flex items-center justify-center gap-1 text-[9px] font-mono text-emerald-400/80 uppercase tracking-wider mb-0.5">
              <Target className="h-2.5 w-2.5" /> Target
            </div>
            <div className="font-mono text-xs font-bold text-emerald-400">${fmtPrice(s.takeProfit)}</div>
          </div>
        </div>
      )}

      {/* Metrics row */}
      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground border-t border-border/50 pt-2">
        <span>RSI <span className="text-foreground/90 font-bold">{s.rsi}</span></span>
        <span>R:R <span className="text-foreground/90 font-bold">{s.riskReward > 0 ? s.riskReward.toFixed(2) : "—"}</span></span>
        <span className="flex items-center gap-1">
          <span style={{ color: confColor(s.confidence) }} className="font-bold">{s.confidence}</span>
          <span className="text-foreground/60">· {s.score}</span>
        </span>
      </div>

      {/* Reasons */}
      <ul className="space-y-0.5">
        {s.reasons.map((r, i) => (
          <li key={i} className="text-[10px] text-muted-foreground flex items-start gap-1.5">
            <span className="text-primary mt-0.5">›</span>
            <span className="leading-snug">{r}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ScalpPage() {
  const [filter, setFilter] = useState<DirFilter>("ALL");
  const { data, isLoading, isFetching } = useGetScalpSignals({
    query: {
      queryKey: getGetScalpSignalsQueryKey(),
      refetchInterval: 60000,
      staleTime: 45000,
    },
  });

  const signals = data ?? [];
  const filtered = filter === "ALL" ? signals : signals.filter((s) => s.direction === filter);
  const longCount = signals.filter((s) => s.direction === "LONG").length;
  const shortCount = signals.filter((s) => s.direction === "SHORT").length;

  const tabs: { key: DirFilter; label: string }[] = [
    { key: "ALL", label: `All (${signals.length})` },
    { key: "LONG", label: `Long (${longCount})` },
    { key: "SHORT", label: `Short (${shortCount})` },
  ];

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-black tracking-tight">Scalp Signals</h1>
            {isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            15m fast-trade setups — RSI, EMA(9/21), ATR &amp; swing structure with entry, stop &amp; target.
          </p>
        </div>
      </div>

      {/* Risk note */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
        <p className="text-[10px] font-mono text-amber-400/90 leading-snug">
          ⚠ Educational signals from technical indicators — not financial advice. Always confirm with your own analysis and size positions responsibly.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-3 py-1.5 rounded text-xs font-mono font-bold tracking-wide transition-colors ${
              filter === t.key
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
            style={filter === t.key ? { boxShadow: "inset 0 0 0 1px hsl(43 74% 52% / 0.3)" } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">No signals match this filter right now.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((s) => (
            <SignalCard key={s.symbol} s={s} />
          ))}
        </div>
      )}
    </div>
  );
}
