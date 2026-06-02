import { useState, useMemo, useEffect } from "react";
import {
  useGetStocks, getGetStocksQueryKey, StockQuote,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, TrendingDown, Search, RefreshCw, ExternalLink, LineChart, Newspaper, Sparkles,
} from "lucide-react";

type Outlook = { tone: "bull" | "bear" | "neutral"; verdict: string; detail: string };

function stockOutlook(s: StockQuote): Outlook {
  const mom = s.momentum5dPercent ?? 0;
  const day = s.changePercent;
  const score = mom + day * 0.5;
  let rangePos = 50;
  if (s.monthHigh != null && s.monthLow != null && s.monthHigh !== s.monthLow) {
    rangePos = ((s.price - s.monthLow) / (s.monthHigh - s.monthLow)) * 100;
  }
  if (score > 3) {
    return {
      tone: "bull",
      verdict: "Bullish",
      detail: `Up ${mom.toFixed(1)}% over 5 sessions, ${rangePos.toFixed(0)}% of the monthly range — momentum favors more upside in the coming days.`,
    };
  }
  if (score < -3) {
    return {
      tone: "bear",
      verdict: "Bearish",
      detail: `Down ${Math.abs(mom).toFixed(1)}% over 5 sessions — selling pressure likely to persist near term; wait or trim.`,
    };
  }
  return {
    tone: "neutral",
    verdict: "Neutral",
    detail: `Roughly flat (5d ${mom >= 0 ? "+" : ""}${mom.toFixed(1)}%) — no clear edge yet, watch for a breakout.`,
  };
}

const CATEGORIES = [
  { key: "ALL", label: "All" },
  { key: "TECH", label: "Technology" },
  { key: "ENERGY", label: "Energy" },
  { key: "RESOURCES", label: "Resources" },
  { key: "LARGE_CAP", label: "Large Cap" },
  { key: "INDEX", label: "Indices / ETFs" },
] as const;

type CategoryKey = typeof CATEGORIES[number]["key"];

const CATEGORY_LABEL: Record<string, string> = {
  TECH: "Technology",
  ENERGY: "Energy",
  RESOURCES: "Resources",
  LARGE_CAP: "Large Cap",
  INDEX: "Index / ETF",
};

function fmtPrice(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtVolume(n: number | null) {
  if (n == null) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}

const OUTLOOK_STYLE: Record<Outlook["tone"], string> = {
  bull: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  bear: "bg-red-500/10 text-red-400 border-red-500/30",
  neutral: "bg-secondary/50 text-muted-foreground border-border",
};

function StockRow({ s }: { s: StockQuote }) {
  const up = s.changePercent >= 0;
  const tvUrl = `https://www.tradingview.com/symbols/${s.tradingViewSymbol}/`;
  const view = stockOutlook(s);
  const googleNews = `https://news.google.com/search?q=${encodeURIComponent(`${s.symbol} ${s.name} stock`)}`;
  const yahooNews = `https://finance.yahoo.com/quote/${encodeURIComponent(s.symbol)}/news`;

  return (
    <div className="rounded-lg border border-border bg-card hover:border-primary/30 transition-colors">
      <div className="grid grid-cols-[1fr_auto] md:grid-cols-[1.6fr_1fr_1fr_1fr_auto] items-center gap-3 px-4 pt-3 pb-2.5">
        {/* Name + symbol */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sm text-foreground">{s.symbol}</span>
            <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary/50 text-muted-foreground">
              {CATEGORY_LABEL[s.category] ?? s.category}
            </span>
          </div>
          <div className="text-xs text-muted-foreground truncate">{s.name}</div>
        </div>

        {/* Price */}
        <div className="text-right md:text-left">
          <div className="font-mono font-bold text-sm text-foreground">${fmtPrice(s.price)}</div>
          <div className="text-[10px] text-muted-foreground font-mono">prev ${fmtPrice(s.previousClose)}</div>
        </div>

        {/* Daily change */}
        <div className={`hidden md:flex flex-col items-start ${up ? "text-emerald-400" : "text-red-400"}`}>
          <div className="flex items-center gap-1 font-mono font-bold text-sm">
            {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {up ? "+" : ""}{s.changePercent.toFixed(2)}%
          </div>
          <div className="text-[10px] font-mono opacity-80">
            {up ? "+" : ""}{s.change.toFixed(2)}
          </div>
        </div>

        {/* 5d momentum + volume */}
        <div className="hidden md:block text-left">
          <div className={`text-xs font-mono ${(s.momentum5dPercent ?? 0) >= 0 ? "text-emerald-400/80" : "text-red-400/80"}`}>
            5d {s.momentum5dPercent == null ? "—" : `${s.momentum5dPercent >= 0 ? "+" : ""}${s.momentum5dPercent.toFixed(1)}%`}
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">vol {fmtVolume(s.volume ?? null)}</div>
        </div>

        {/* TradingView link */}
        <a
          href={tvUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1.5 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors whitespace-nowrap"
        >
          Chart <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Outlook for coming days + news */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 pb-3 pt-1 border-t border-border/50">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <span className={`flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border flex-shrink-0 ${OUTLOOK_STYLE[view.tone]}`}>
            <Sparkles className="h-2.5 w-2.5" /> {view.verdict}
          </span>
          <span className="text-[11px] text-muted-foreground leading-snug">{view.detail}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <a
            href={googleNews}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors whitespace-nowrap"
          >
            <Newspaper className="h-3 w-3" /> Google News
          </a>
          <a
            href={yahooNews}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors whitespace-nowrap"
          >
            <Newspaper className="h-3 w-3" /> Yahoo
          </a>
        </div>
      </div>
    </div>
  );
}

export default function StocksPage() {
  const [category, setCategory] = useState<CategoryKey>("ALL");
  const [search, setSearch] = useState("");
  const [countdown, setCountdown] = useState(30);

  const { data: stocks, isLoading, isFetching } = useGetStocks({
    query: { queryKey: getGetStocksQueryKey(), refetchInterval: 30000 },
  });

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isFetching) {
      setCountdown(30);
    } else {
      timer = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    }
    return () => clearInterval(timer);
  }, [isFetching]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (stocks ?? [])
      .filter((s) => category === "ALL" || s.category === category)
      .filter((s) => !q || s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
  }, [stocks, category, search]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    (stocks ?? []).forEach((s) => { map[s.category] = (map[s.category] ?? 0) + 1; });
    return map;
  }, [stocks]);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <LineChart className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-black tracking-tight">Stocks & Indices</h1>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Live quotes across technology, energy, resources and large caps — plus common indices and ETFs.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono bg-card px-3 py-1.5 rounded border border-border text-muted-foreground">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-primary" : ""}`} />
          {isFetching ? "Updating..." : `${countdown}s`}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => {
            const active = category === c.key;
            const n = c.key === "ALL" ? (stocks?.length ?? 0) : (counts[c.key] ?? 0);
            return (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "bg-secondary/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.label}{n > 0 && <span className="opacity-60 ml-1">{n}</span>}
              </button>
            );
          })}
        </div>
        <div className="relative md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search symbol or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary/30"
          />
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">No stocks match your filters.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => <StockRow key={s.symbol} s={s} />)}
        </div>
      )}
    </div>
  );
}
