import { useEffect, useMemo, useState } from "react";
import {
  useGetStockSearch, getGetStockSearchQueryKey,
  useGetMarketOverview, getGetMarketOverviewQueryKey,
  useGetStocks, getGetStocksQueryKey,
  useGetInfluencerSignals, getGetInfluencerSignalsQueryKey,
} from "@workspace/api-client-react";
import type { CoinTicker, StockQuote, InfluencerSignal, StockSearchResult } from "@workspace/api-client-react";
import {
  Search, ExternalLink, TrendingUp, TrendingDown, Newspaper, LineChart,
  BarChart3, FileText, Coins, Building2, Megaphone, Globe, Gauge, Languages,
  Clock, X, BarChartHorizontal, Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CryptoIcon } from "@/components/crypto-icon";
import { StockIcon } from "@/components/stock-icon";
import { StockDetailPanel } from "@/components/stock-detail-panel";
import { SearchedStockPanel } from "@/components/universal-stock-search";
import { ResearchJournal, type JournalPrefill } from "@/components/research-journal";
import { strings } from "@/lib/research-i18n";
import {
  loadHistory, pushHistory, clearHistory, loadLang, saveLang,
  type HistoryEntry, type Lang,
} from "@/lib/research-store";

function fmtPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(2);
  if (p >= 0.01) return p.toFixed(4);
  return p.toPrecision(3);
}

interface ResearchLink { label: string; href: string; icon: React.ComponentType<{ className?: string }>; }

function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : "#";
}

function stockLinks(symbol: string, name: string): ResearchLink[] {
  const q = encodeURIComponent(`${symbol} ${name} stock`);
  const tvSymbol = symbol.replace(/-/g, ".");
  return [
    { label: "TradingView", href: `https://www.tradingview.com/symbols/${tvSymbol}/`, icon: LineChart },
    { label: "Yahoo Finance", href: `https://finance.yahoo.com/quote/${symbol}`, icon: BarChart3 },
    { label: "StockAnalysis", href: `https://stockanalysis.com/stocks/${symbol}/`, icon: FileText },
    { label: "SEC", href: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(name)}&type=10-K`, icon: Building2 },
  ];
}

function cryptoLinks(asset: string, symbol: string): ResearchLink[] {
  const q = encodeURIComponent(`${asset} crypto`);
  return [
    { label: "TradingView", href: `https://www.tradingview.com/symbols/${symbol.replace(/USDT$/, "USD")}/`, icon: LineChart },
    { label: "CoinGecko", href: `https://www.coingecko.com/en/search?query=${encodeURIComponent(asset)}`, icon: Coins },
    { label: "News", href: `https://news.google.com/search?q=${q}`, icon: Newspaper },
  ];
}

const QUICK_LINKS: ResearchLink[] = [
  { label: "Market News", href: "https://news.google.com/search?q=stock%20market%20today", icon: Newspaper },
  { label: "TradingView", href: "https://www.tradingview.com/markets/", icon: LineChart },
  { label: "CoinGecko", href: "https://www.coingecko.com/", icon: Coins },
  { label: "Fear & Greed", href: "https://alternative.me/crypto/fear-and-greed-index/", icon: Gauge },
  { label: "Crypto", href: "https://news.google.com/search?q=crypto%20bitcoin", icon: Globe },
];

function LinkPills({ links }: { links: ResearchLink[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs font-medium text-foreground/90 hover:border-primary/60 hover:text-primary transition-colors focus-visible:text-primary"
          onClick={(e) => e.stopPropagation()}
        >
          <l.icon className="h-3.5 w-3.5" />
          {l.label}
          <ExternalLink className="h-3 w-3 opacity-50" />
        </a>
      ))}
    </div>
  );
}

export default function Research() {
  const [lang, setLang] = useState<Lang>("he");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<StockQuote | null>(null);
  const [selectedSearch, setSelectedSearch] = useState<StockSearchResult | null>(null);
  const [prefill, setPrefill] = useState<JournalPrefill | null>(null);

  const t = strings(lang);

  useEffect(() => {
    setLang(loadLang());
    setHistory(loadHistory());
  }, []);

  function toggleLang() {
    const next: Lang = lang === "he" ? "en" : "he";
    setLang(next);
    saveLang(next);
  }

  const submitted = query.trim().length >= 1;
  const Q = query.trim().toUpperCase();

  function runSearch(value: string) {
    const v = value.trim();
    if (!v) return;
    setQuery(v);
    setDraft(v);
    setHistory(pushHistory(v));
  }

  const { data: searchResults, isFetching: searching } = useGetStockSearch(
    { q: query.trim() },
    { query: { queryKey: getGetStockSearchQueryKey({ q: query.trim() }), enabled: submitted, staleTime: 60000 } },
  );
  const { data: overview } = useGetMarketOverview({
    query: { queryKey: getGetMarketOverviewQueryKey(), refetchInterval: 30000, staleTime: 20000 },
  });
  const { data: stocks } = useGetStocks({
    query: { queryKey: getGetStocksQueryKey(), refetchInterval: 30000, staleTime: 20000 },
  });
  const { data: influencers } = useGetInfluencerSignals({
    query: { queryKey: getGetInfluencerSignalsQueryKey(), refetchInterval: 120000, staleTime: 60000 },
  });

  const cryptoMatches = useMemo<CoinTicker[]>(() => {
    if (!submitted) return [];
    return ((overview ?? []) as CoinTicker[])
      .filter((c) => c.asset.toUpperCase().includes(Q) || c.symbol.toUpperCase().includes(Q))
      .slice(0, 6);
  }, [overview, Q, submitted]);

  const quoteFor = (symbol: string): StockQuote | undefined =>
    ((stocks ?? []) as StockQuote[]).find((s) => s.symbol.toUpperCase() === symbol.toUpperCase());

  const relatedNews = useMemo<InfluencerSignal[]>(() => {
    if (!submitted) return [];
    return ((influencers ?? []) as InfluencerSignal[])
      .filter((i) => i.ticker.toUpperCase().includes(Q) || i.name.toUpperCase().includes(Q))
      .slice(0, 5);
  }, [influencers, Q, submitted]);

  const stockHits = (searchResults ?? []).slice(0, 8);
  const noResults = submitted && !searching && stockHits.length === 0 && cryptoMatches.length === 0;

  function openStock(s: StockSearchResult) {
    const quote = quoteFor(s.symbol);
    if (quote) setSelectedQuote(quote);
    else setSelectedSearch(s);
  }

  function addToPlan(symbol: string, name: string, kind: "stock" | "crypto") {
    setPrefill({ symbol, name, kind, nonce: Date.now() });
    document.getElementById("research-journal")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6" dir={t.dir}>
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Search className="h-6 w-6 text-primary" /> {t.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t.subtitle}</p>
        </div>
        <button
          onClick={toggleLang}
          className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition-colors shrink-0"
          aria-label="Toggle language"
        >
          <Languages className="h-4 w-4" /> {t.langLabel}
        </button>
      </header>

      {/* Search bar */}
      <form
        onSubmit={(e) => { e.preventDefault(); runSearch(draft); }}
        className="flex gap-2"
        role="search"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="pl-9 h-11 bg-secondary/40 text-sm"
            aria-label="Search symbol or company"
            autoFocus
          />
        </div>
        <Button type="submit" className="h-11 px-5 gap-2 font-medium">
          <Search className="h-4 w-4" /> {t.searchBtn}
        </Button>
      </form>

      {/* Recent searches */}
      {history.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
            <Clock className="h-3 w-3" /> {t.recentSearches}
          </span>
          {history.slice(0, 10).map((h) => (
            <button
              key={h.ts}
              onClick={() => runSearch(h.query)}
              className="rounded-full border border-border bg-secondary/30 px-2.5 py-1 text-xs text-foreground/80 hover:border-primary/50 hover:text-primary transition-colors"
            >
              {h.query}
            </button>
          ))}
          <button
            onClick={() => setHistory(clearHistory())}
            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-red-400 transition-colors"
          >
            <X className="h-3 w-3" /> {t.clear}
          </button>
        </div>
      )}

      {/* Quick research links (always available) */}
      {!submitted && (
        <section className="space-y-3">
          <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">{t.quickLinks}</h2>
          <LinkPills links={QUICK_LINKS} />
          <div className="rounded-lg border border-border bg-secondary/20 p-5 text-center">
            <Search className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground mt-2">{t.emptyHint}</p>
          </div>
        </section>
      )}

      {noResults && (
        <div className="rounded-lg border border-border bg-secondary/20 p-6 text-center">
          <p className="text-sm text-muted-foreground">{t.noResultsTitle(query)}</p>
          <div className="mt-3 flex justify-center"><LinkPills links={QUICK_LINKS} /></div>
        </div>
      )}

      {/* Crypto matches */}
      {cryptoMatches.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <Coins className="h-3.5 w-3.5" /> {t.crypto}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {cryptoMatches.map((c) => {
              const up = c.changePercent >= 0;
              return (
                <div key={c.symbol} className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <CryptoIcon asset={c.asset} size={28} />
                      <div>
                        <div className="text-base font-bold">{c.asset}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{c.symbol}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-semibold">${fmtPrice(c.price)}</div>
                      <div className={`text-xs font-mono flex items-center gap-1 justify-end ${up ? "text-emerald-400" : "text-red-400"}`}>
                        {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {up ? "+" : ""}{c.changePercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <LinkPills links={cryptoLinks(c.asset, c.symbol)} />
                    <button
                      onClick={() => addToPlan(c.asset, c.asset, "crypto")}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/30 px-2.5 py-1 text-[11px] text-primary hover:bg-primary/10 transition-colors shrink-0"
                    >
                      <Plus className="h-3 w-3" /> {t.addToPlan}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Stock matches — click to open full analysis */}
      {stockHits.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <LineChart className="h-3.5 w-3.5" /> {t.stocks}
          </h2>
          <p className="text-[11px] text-muted-foreground/80 -mt-1 flex items-center gap-1.5">
            <BarChartHorizontal className="h-3 w-3" /> {t.fullAnalysisHint}
          </p>
          <div className="space-y-3">
            {stockHits.map((s) => {
              const quote = quoteFor(s.symbol);
              const up = quote ? quote.changePercent >= 0 : false;
              return (
                <div
                  key={`${s.symbol}-${s.exchange}`}
                  onClick={() => openStock(s)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openStock(s);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${t.openAnalysis}: ${s.symbol} ${s.name}`}
                  className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3 cursor-pointer hover:border-primary/50 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StockIcon symbol={s.symbol} size={28} />
                        <span className="text-base font-bold">{s.symbol}</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground uppercase">{s.type}</span>
                        <span className="text-[9px] font-mono text-muted-foreground">{s.exchange}</span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{s.name}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0 sm:flex-row sm:items-center sm:gap-3">
                      {quote && (
                        <div className="text-right">
                          <div className="font-mono font-semibold">${fmtPrice(quote.price)}</div>
                          <div className={`text-xs font-mono flex items-center gap-1 justify-end ${up ? "text-emerald-400" : "text-red-400"}`}>
                            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {up ? "+" : ""}{quote.changePercent.toFixed(2)}%
                          </div>
                        </div>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-primary group-hover:bg-primary/20 transition-colors">
                        <BarChartHorizontal className="h-3.5 w-3.5" /> {t.openAnalysis}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <LinkPills links={stockLinks(s.symbol, s.name)} />
                    <button
                      onClick={(e) => { e.stopPropagation(); addToPlan(s.symbol, s.name, "stock"); }}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/30 px-2.5 py-1 text-[11px] text-primary hover:bg-primary/10 transition-colors shrink-0"
                    >
                      <Plus className="h-3 w-3" /> {t.addToPlan}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Related smart-money headlines */}
      {relatedNews.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <Megaphone className="h-3.5 w-3.5" /> {t.relatedNews}
          </h2>
          <div className="space-y-2">
            {relatedNews.map((n, i) => (
              <a
                key={`${n.ticker}-${i}`}
                href={safeUrl(n.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg border border-border bg-secondary/20 p-3 hover:border-primary/50 transition-colors group"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-primary">{n.influencer} · {n.ticker}</span>
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${n.direction === "LONG" ? "bg-emerald-500/15 text-emerald-400" : n.direction === "SHORT" ? "bg-red-500/15 text-red-400" : "bg-muted/40 text-muted-foreground"}`}>
                    {n.direction} · {Math.round(n.confidence)}%
                  </span>
                </div>
                <p className="text-sm text-foreground/90 mt-1 group-hover:text-foreground line-clamp-2">{n.headline}</p>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                  {n.source} <ExternalLink className="h-2.5 w-2.5" />
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {submitted && (
        <section className="space-y-3 pt-2">
          <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">{t.generalResearch}</h2>
          <LinkPills links={QUICK_LINKS} />
        </section>
      )}

      {/* Research journal — notes, plan, tracking */}
      <div id="research-journal" className="pt-2 scroll-mt-6">
        <div className="uhnw-divider mb-5" />
        <ResearchJournal t={t} prefill={prefill} />
      </div>

      <p className="text-[10px] text-muted-foreground/70 text-center">{t.disclaimer}</p>

      {/* Full analysis panels */}
      {selectedQuote && <StockDetailPanel stock={selectedQuote} onClose={() => setSelectedQuote(null)} />}
      {selectedSearch && (
        <SearchedStockPanel
          result={selectedSearch}
          onClose={() => setSelectedSearch(null)}
          labels={{ loading: t.panelLoading, notFound: t.panelNotFound }}
        />
      )}
    </div>
  );
}
