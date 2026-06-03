import { useGetMarketMovers, getGetMarketMoversQueryKey } from "@workspace/api-client-react";
import type { MoverCoin, TrendingCoin, NewsItem, FearGreed } from "@workspace/api-client-react";
import {
  Activity, TrendingUp, TrendingDown, Flame, Newspaper, Gauge, RefreshCw, ExternalLink,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/* ─── Fear & Greed gauge ───────────────────────────────────── */
function fgColor(v: number): string {
  if (v <= 25) return "#ef4444";   // extreme fear
  if (v <= 45) return "#f59e0b";   // fear
  if (v <= 55) return "#eab308";   // neutral
  if (v <= 75) return "#84cc16";   // greed
  return "#22c55e";                // extreme greed
}

function FearGreedGauge({ fg }: { fg: FearGreed | null | undefined }) {
  const value = fg?.value ?? 50;
  const color = fgColor(value);
  const angle = -90 + (value / 100) * 180; // -90deg (0) → +90deg (100)

  return (
    <div className="rounded-lg border border-border bg-card p-5 flex flex-col items-center">
      <div className="flex items-center gap-2 self-start mb-3">
        <Gauge className="h-4 w-4 text-primary" />
        <h2 className="text-xs font-mono font-bold tracking-wider text-muted-foreground uppercase">Fear &amp; Greed</h2>
      </div>
      <div className="relative w-44 h-24 overflow-hidden">
        <svg viewBox="0 0 200 110" className="w-full h-full">
          <defs>
            <linearGradient id="fg-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="35%" stopColor="#f59e0b" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="70%" stopColor="#84cc16" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>
          <path d="M 18 100 A 82 82 0 0 1 182 100" fill="none" stroke="url(#fg-grad)" strokeWidth="14" strokeLinecap="round" />
          <line
            x1="100" y1="100"
            x2={100 + 70 * Math.cos((angle - 90) * Math.PI / 180)}
            y2={100 + 70 * Math.sin((angle - 90) * Math.PI / 180)}
            stroke="white" strokeWidth="3" strokeLinecap="round"
          />
          <circle cx="100" cy="100" r="6" fill="white" />
        </svg>
      </div>
      <div className="text-3xl font-black font-mono mt-1" style={{ color }}>{fg?.value ?? "—"}</div>
      <div className="text-xs font-mono tracking-wider mt-0.5" style={{ color }}>
        {fg?.classification?.toUpperCase() ?? "UNAVAILABLE"}
      </div>
    </div>
  );
}

/* ─── Movers list ──────────────────────────────────────────── */
function fmtVol(v: number | null | undefined): string {
  if (v == null) return "";
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(0)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (p >= 1) return p.toFixed(2);
  if (p >= 0.01) return p.toFixed(4);
  return p.toPrecision(2);
}

function MoversList({ title, coins, positive }: { title: string; coins: MoverCoin[]; positive: boolean }) {
  const Icon = positive ? TrendingUp : TrendingDown;
  const accent = positive ? "text-emerald-400" : "text-red-400";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-4 w-4 ${accent}`} />
        <h2 className="text-xs font-mono font-bold tracking-wider text-muted-foreground uppercase">{title}</h2>
      </div>
      <div className="space-y-0.5">
        {coins.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No data.</p>
        ) : coins.map((c) => (
          <a
            key={c.symbol}
            href={`https://www.binance.com/en/trade/${c.symbol}_USDT`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-secondary/40 transition-colors group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono font-bold text-sm text-foreground/90 w-16 truncate">{c.symbol}</span>
              <span className="text-[10px] font-mono text-muted-foreground hidden sm:inline">{fmtVol(c.quoteVolume)}</span>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="font-mono text-xs text-muted-foreground">${fmtPrice(c.price)}</span>
              <span className={`font-mono font-bold text-xs w-16 text-right ${c.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {c.changePercent >= 0 ? "+" : ""}{c.changePercent.toFixed(2)}%
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

/* ─── Trending ─────────────────────────────────────────────── */
function TrendingList({ coins }: { coins: TrendingCoin[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Flame className="h-4 w-4 text-orange-400" />
        <h2 className="text-xs font-mono font-bold tracking-wider text-muted-foreground uppercase">Trending Searches</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {coins.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No data.</p>
        ) : coins.map((c, i) => (
          <div
            key={`${c.symbol}-${i}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-border bg-secondary/30 hover:border-orange-500/40 transition-colors"
          >
            {c.thumb ? (
              <img src={c.thumb} alt="" className="h-4 w-4 rounded-full" />
            ) : (
              <Flame className="h-3 w-3 text-orange-400" />
            )}
            <span className="text-xs font-medium text-foreground/90">{c.name}</span>
            <span className="text-[10px] font-mono text-muted-foreground uppercase">{c.symbol}</span>
            {c.marketCapRank != null && (
              <span className="text-[9px] font-mono text-orange-400/80">#{c.marketCapRank}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── News feed ────────────────────────────────────────────── */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function NewsFeed({ news }: { news: NewsItem[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
        <Newspaper className="h-4 w-4 text-primary" />
        <h2 className="text-xs font-mono font-bold tracking-wider text-muted-foreground uppercase">Market News</h2>
        <span className="text-[10px] font-mono text-muted-foreground/60 ml-auto">{news.length} headlines</span>
      </div>
      <div className="space-y-1 overflow-y-auto flex-1 min-h-0">
        {news.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No headlines available.</p>
        ) : news.map((n, i) => (
          <a
            key={`${n.url}-${i}`}
            href={n.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 py-2 px-2 rounded hover:bg-secondary/40 transition-colors group border-b border-border/30 last:border-0"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground/85 leading-snug group-hover:text-foreground line-clamp-2">{n.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-mono font-bold text-primary/80">{n.source}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{timeAgo(n.publishedAt)}</span>
              </div>
            </div>
            <ExternalLink className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary flex-shrink-0 mt-0.5" />
          </a>
        ))}
      </div>
    </div>
  );
}

export default function MoversPage() {
  const { data, isLoading, isFetching } = useGetMarketMovers({
    query: {
      queryKey: getGetMarketMoversQueryKey(),
      refetchInterval: 180000,
      staleTime: 120000,
    },
  });

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-black tracking-tight">Market Movers</h1>
            {isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            What's moving the market right now — sentiment, momentum &amp; headlines.
          </p>
        </div>
        {data?.fetchedAt && (
          <span className="text-[10px] font-mono text-muted-foreground hidden sm:block">
            Updated {timeAgo(data.fetchedAt)} ago
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {/* Top row: gauge + gainers + losers */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <FearGreedGauge fg={data?.fearGreed} />
            <MoversList title="Top Gainers (24h)" coins={data?.gainers ?? []} positive />
            <MoversList title="Top Losers (24h)" coins={data?.losers ?? []} positive={false} />
          </div>

          {/* Trending */}
          <TrendingList coins={data?.trending ?? []} />

          {/* News */}
          <div className="h-[420px]">
            <NewsFeed news={data?.news ?? []} />
          </div>
        </>
      )}
    </div>
  );
}
