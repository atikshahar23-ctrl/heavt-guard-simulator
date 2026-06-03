import { useState, useEffect, useRef, useCallback } from "react";
import { useGetAllMarkets, getGetAllMarketsQueryKey, GetAllMarketsCategory } from "@workspace/api-client-react";
import { ExternalLink, Search, Globe, X, RefreshCw, ChevronUp, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  CRYPTO:   { label: "Crypto",    color: "text-orange-400",      bg: "bg-orange-500/15 border-orange-500/25" },
  POLITICS: { label: "Politics",  color: "text-blue-400",        bg: "bg-blue-500/15 border-blue-500/25" },
  SPORTS:   { label: "Sports",    color: "text-emerald-400",     bg: "bg-emerald-500/15 border-emerald-500/25" },
  ECONOMY:  { label: "Economy",   color: "text-purple-400",      bg: "bg-purple-500/15 border-purple-500/25" },
  TECH:     { label: "Tech/AI",   color: "text-cyan-400",        bg: "bg-cyan-500/15 border-cyan-500/25" },
  OTHER:    { label: "Other",     color: "text-muted-foreground", bg: "bg-muted/30 border-border" },
  ALL:      { label: "All",       color: "text-foreground",      bg: "bg-secondary/50 border-border" },
};

function CategoryBadge({ category }: { category: string }) {
  const cfg = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.OTHER;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono border ${cfg.bg} ${cfg.color} whitespace-nowrap`}>
      {cfg.label}
    </span>
  );
}

function ProbBar({ pct }: { pct: number }) {
  const color = pct > 70 ? "#22c55e" : pct > 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono font-bold" style={{ color }}>{pct.toFixed(0)}%</span>
    </div>
  );
}

type SortField = "question" | "yesProbabilityPercent" | "volume" | "yesPrice";
type SortDir = "asc" | "desc";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function BrowsePage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [category, setCategory] = useState<GetAllMarketsCategory>("ALL");
  const [showPanel, setShowPanel] = useState(false);
  const [panelUrl, setPanelUrl] = useState("https://polymarket.com");
  const [sort, setSort] = useState<SortField>("volume");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeBlocked, setIframeBlocked] = useState(false);

  const { data: markets, isLoading, isFetching } = useGetAllMarkets(
    { category, search: debouncedSearch || undefined },
    {
      query: {
        queryKey: getGetAllMarketsQueryKey({ category, search: debouncedSearch || undefined }),
        refetchInterval: 120000,
        staleTime: 60000,
      }
    }
  );

  const toggleSort = useCallback((field: SortField) => {
    if (sort === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSort(field); setSortDir("desc"); }
  }, [sort]);

  const sorted = [...(markets ?? [])].sort((a, b) => {
    let va: number | string = 0, vb: number | string = 0;
    if (sort === "question") { va = a.question; vb = b.question; }
    else if (sort === "yesProbabilityPercent") { va = a.yesProbabilityPercent; vb = b.yesProbabilityPercent; }
    else if (sort === "volume") { va = a.volume ?? 0; vb = b.volume ?? 0; }
    else if (sort === "yesPrice") { va = a.yesPrice; vb = b.yesPrice; }
    if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
    return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });

  function openInPanel(slug: string | null | undefined, conditionId: string) {
    const url = slug
      ? `https://polymarket.com/event/${slug}`
      : `https://polymarket.com`;
    setPanelUrl(url);
    setShowPanel(true);
    setIframeBlocked(false);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sort !== field) return <ChevronUp className="h-3 w-3 opacity-20" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 text-primary" />
      : <ChevronDown className="h-3 w-3 text-primary" />;
  }

  const categories = ["ALL", "CRYPTO", "POLITICS", "SPORTS", "ECONOMY", "TECH", "OTHER"] as const;

  return (
    <div className={`flex h-full ${showPanel ? 'divide-x divide-border' : ''}`}>
      {/* Main table area */}
      <div className={`flex flex-col min-w-0 ${showPanel ? 'w-1/2' : 'w-full'} overflow-hidden`}>
        <div className="p-5 space-y-4 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-black tracking-tight">Live Markets</h1>
                {isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                All active Polymarket prediction markets — real-time.
                {markets && <span className="text-primary ml-1 font-mono">{markets.length.toLocaleString()} markets</span>}
              </p>
            </div>
            <button
              onClick={() => setShowPanel(p => !p)}
              className={`inline-flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded border transition-all ${showPanel ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40'}`}
            >
              <Globe className="h-3.5 w-3.5" />
              {showPanel ? 'Hide Polymarket' : 'Open Polymarket Panel'}
            </button>
          </div>

          {/* Category tabs */}
          <div className="flex items-center gap-1 flex-wrap flex-shrink-0">
            {categories.map((cat) => {
              const cfg = CATEGORY_CONFIG[cat];
              const isActive = category === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1 rounded text-[11px] font-bold font-mono border transition-all ${isActive ? `${cfg.bg} ${cfg.color}` : 'bg-transparent border-border/40 text-muted-foreground hover:border-border hover:text-foreground'}`}
                >
                  {cfg.label}
                </button>
              );
            })}
            <div className="ml-auto relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search any market..."
                className="pl-8 bg-secondary/30 h-8 text-xs w-52"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-sm">
                <tr>
                  <th className="text-left px-3 py-2 font-mono text-[10px] tracking-wider text-muted-foreground w-20">CAT</th>
                  <th
                    className="text-left px-3 py-2 font-mono text-[10px] tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none"
                    onClick={() => toggleSort("question")}
                  >
                    <div className="flex items-center gap-1">QUESTION <SortIcon field="question" /></div>
                  </th>
                  <th
                    className="text-right px-3 py-2 font-mono text-[10px] tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none w-32"
                    onClick={() => toggleSort("yesProbabilityPercent")}
                  >
                    <div className="flex items-center justify-end gap-1">PROB <SortIcon field="yesProbabilityPercent" /></div>
                  </th>
                  <th
                    className="text-right px-3 py-2 font-mono text-[10px] tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none w-24"
                    onClick={() => toggleSort("yesPrice")}
                  >
                    <div className="flex items-center justify-end gap-1">YES / NO <SortIcon field="yesPrice" /></div>
                  </th>
                  <th
                    className="text-right px-3 py-2 font-mono text-[10px] tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none w-24"
                    onClick={() => toggleSort("volume")}
                  >
                    <div className="flex items-center justify-end gap-1">VOLUME <SortIcon field="volume" /></div>
                  </th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 12 }).map((_, i) => (
                    <tr key={i} className="border-t border-border/40">
                      <td className="px-3 py-2"><Skeleton className="h-4 w-14" /></td>
                      <td className="px-3 py-2"><Skeleton className="h-4 w-64" /></td>
                      <td className="px-3 py-2"><Skeleton className="h-4 w-20 ml-auto" /></td>
                      <td className="px-3 py-2"><Skeleton className="h-4 w-16 ml-auto" /></td>
                      <td className="px-3 py-2"><Skeleton className="h-4 w-16 ml-auto" /></td>
                      <td className="px-3 py-2" />
                    </tr>
                  ))
                ) : sorted.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-16 text-muted-foreground">
                      No markets match your search.
                    </td>
                  </tr>
                ) : (
                  sorted.map((m, idx) => (
                    <tr
                      key={`${m.conditionId}-${idx}`}
                      className="border-t border-border/30 hover:bg-secondary/20 cursor-pointer group"
                      onClick={() => openInPanel(m.eventSlug, m.conditionId)}
                    >
                      <td className="px-3 py-2">
                        <CategoryBadge category={m.category} />
                      </td>
                      <td className="px-3 py-2 font-medium text-foreground/80 leading-tight max-w-0">
                        <div className="truncate max-w-[280px] group-hover:text-foreground" title={m.question}>
                          {m.question}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end">
                          <ProbBar pct={m.yesProbabilityPercent} />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground whitespace-nowrap">
                        <span className="text-emerald-400">${m.yesPrice.toFixed(2)}</span>
                        {" / "}
                        <span className="text-red-400">${m.noPrice.toFixed(2)}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                        {m.volume != null && m.volume > 0
                          ? m.volume >= 1_000_000
                            ? `$${(m.volume / 1_000_000).toFixed(1)}M`
                            : m.volume >= 1_000
                              ? `$${(m.volume / 1_000).toFixed(0)}K`
                              : `$${m.volume.toFixed(0)}`
                          : "-"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <a
                          href={m.eventSlug ? `https://polymarket.com/event/${m.eventSlug}` : "https://polymarket.com"}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                          title="Open on Polymarket"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Embedded Polymarket panel */}
      {showPanel && (
        <div className="w-1/2 flex flex-col bg-background">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/50 flex-shrink-0">
            <Globe className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-xs font-mono text-muted-foreground truncate flex-1">{panelUrl}</span>
            <a
              href={panelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-muted-foreground hover:text-primary flex items-center gap-1 flex-shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open tab
            </a>
            <button
              onClick={() => setShowPanel(false)}
              className="text-muted-foreground hover:text-foreground flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 relative">
            {iframeBlocked ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
                <Globe className="h-12 w-12 text-muted-foreground/30" />
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">Polymarket blocks embedding</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Polymarket prevents iframe embedding for security.<br />
                    Click below to open the market directly.
                  </p>
                  <a
                    href={panelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open on Polymarket
                  </a>
                </div>
              </div>
            ) : (
              <iframe
                ref={iframeRef}
                src={panelUrl}
                className="w-full h-full border-0"
                title="Polymarket"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
                onError={() => setIframeBlocked(true)}
                onLoad={(e) => {
                  // Detect if page loaded but is blocked by CSP/X-Frame-Options
                  try {
                    const doc = (e.target as HTMLIFrameElement).contentDocument;
                    if (!doc || doc.body.innerHTML === "") setIframeBlocked(true);
                  } catch {
                    setIframeBlocked(true);
                  }
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
