import { useState, useEffect, useRef } from "react";
import {
  useGetStockSearch,
  getGetStockSearchQueryKey,
  useGetStockKlines,
  getGetStockKlinesQueryKey,
  type StockSearchResult,
  type StockQuote,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Globe, X } from "lucide-react";
import { StockDetailPanel } from "@/components/stock-detail-panel";
import { useLanguage } from "@/contexts/language-context";
import { t } from "@/lib/i18n";

function categoryFor(type: string): StockQuote["category"] {
  const t = type.toUpperCase();
  if (t === "ETF" || t === "INDEX" || t === "MUTUALFUND") return "INDEX";
  return "LARGE_CAP";
}

/**
 * Reconstruct a usable StockQuote for ANY searched symbol from its 1-month daily
 * candles, so the standard detail/trade panel works for instruments outside the
 * curated universe. Fetches once via the existing klines proxy.
 */
export function SearchedStockPanel({
  result,
  onClose,
  labels,
}: {
  result: StockSearchResult;
  onClose: () => void;
  labels?: { loading: (sym: string) => string; notFound: (sym: string) => string };
}) {
  const { lang } = useLanguage();
  const loadingText = labels?.loading ?? ((sym: string) => t("markets.loadingStock", lang).replace("{sym}", sym));
  const notFoundText = labels?.notFound ?? ((sym: string) => t("markets.noTradeData", lang).replace("{sym}", sym));
  const params = { symbol: result.symbol, range: "1mo", interval: "1d" };
  const { data: candles, isLoading, isError } = useGetStockKlines(params, {
    query: { queryKey: getGetStockKlinesQueryKey(params) },
  });

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full sm:max-w-md h-full bg-card border-l border-border shadow-2xl flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs font-mono">{loadingText(result.symbol)}</span>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !candles || candles.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full sm:max-w-md h-full bg-card border-l border-border shadow-2xl flex flex-col items-center justify-center gap-3 p-6 text-center">
          <button onClick={onClose} aria-label="Close" className="absolute top-3 left-3 p-1.5 rounded hover:bg-secondary/60 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
          <div className="text-sm text-muted-foreground">{notFoundText(result.symbol)}</div>
        </div>
      </div>
    );
  }

  const closes = candles.map((c) => c.close);
  const last = candles[candles.length - 1];
  const price = last.close;
  const previousClose = closes.length >= 2 ? closes[closes.length - 2] : price;
  const change = price - previousClose;
  const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0;
  const monthHigh = Math.max(...candles.map((c) => c.high));
  const monthLow = Math.min(...candles.map((c) => c.low));
  const fivePrev = closes.length >= 6 ? closes[closes.length - 6] : null;
  const momentum5dPercent = fivePrev && fivePrev !== 0 ? ((price - fivePrev) / fivePrev) * 100 : null;

  const quote: StockQuote = {
    symbol: result.symbol,
    name: result.name,
    category: categoryFor(result.type),
    price,
    previousClose,
    change,
    changePercent,
    dayHigh: last.high,
    dayLow: last.low,
    monthHigh,
    monthLow,
    momentum5dPercent,
    volume: last.volume ?? null,
    currency: "USD",
    tradingViewSymbol: result.symbol,
    fetchedAt: new Date().toISOString(),
  };

  return <StockDetailPanel stock={quote} onClose={onClose} />;
}

export function UniversalStockSearch() {
  const { lang, dir } = useLanguage();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<StockSearchResult | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const enabled = debounced.length >= 1;
  const params = { q: debounced };
  const { data: results, isFetching } = useGetStockSearch(params, {
    query: { queryKey: getGetStockSearchQueryKey(params), enabled },
  });

  return (
    <>
      <div ref={boxRef} className="relative w-full">
        <div className="relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
          <Input
            type="search"
            placeholder={t("markets.searchPlaceholder", lang)}
            value={term}
            onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            className="pl-9 pr-9 bg-secondary/30 border-primary/30 focus-visible:border-primary"
            dir={dir}
          />
          {isFetching && enabled && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
          )}
        </div>

        {open && enabled && (
          <div className="absolute z-40 mt-1 w-full rounded-lg border border-border bg-card shadow-2xl overflow-hidden">
            {!results || results.length === 0 ? (
              <div className="px-4 py-3 text-xs text-muted-foreground font-mono">
                {isFetching ? t("markets.searching", lang) : t("markets.noResults", lang)}
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {results.map((r) => (
                  <button
                    key={`${r.symbol}-${r.exchange}`}
                    onClick={() => { setSelected(r); setOpen(false); setTerm(""); }}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-primary/10 transition-colors border-b border-border/40 last:border-0"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-foreground">{r.symbol}</span>
                        <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary/50 text-muted-foreground">
                          {r.type}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{r.name}</div>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">{r.exchange}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selected && <SearchedStockPanel result={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
