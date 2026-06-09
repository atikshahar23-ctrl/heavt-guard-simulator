import { useGetMarketMovers, getGetMarketMoversQueryKey } from "@workspace/api-client-react";
import type { NewsItem } from "@workspace/api-client-react";
import { Newspaper, ExternalLink, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

const NEWS_OPEN_KEY = "sidebar-news-open";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "עכשיו";
  if (mins < 60) return `לפני ${mins} ד׳`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `לפני ${hrs} ש׳`;
  return `לפני ${Math.floor(hrs / 24)} ימים`;
}

export function SidebarNews({ collapsible = false }: { collapsible?: boolean }) {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(NEWS_OPEN_KEY) === "true";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(NEWS_OPEN_KEY, String(open));
  }, [open]);

  const { data, isLoading } = useGetMarketMovers({
    query: {
      queryKey: getGetMarketMoversQueryKey(),
      refetchInterval: 180000,
      staleTime: 120000,
    },
  });

  const news: NewsItem[] = (data?.news ?? []).slice(0, 5);

  return (
    <div className="px-1" dir="rtl">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full px-3 pb-2 flex items-center gap-2 text-right"
          aria-expanded={open}
        >
          <Newspaper className="h-3.5 w-3.5 text-[#cdbfa4]/70" strokeWidth={1.5} />
          <span className="text-[9px] font-mono uppercase tracking-[0.26em] text-[#cdbfa4]/55">חדשות שוק</span>
          <ChevronDown className={`h-3.5 w-3.5 text-[#cdbfa4]/55 mr-auto transition-transform duration-200 ${open ? 'rotate-180' : ''}`} strokeWidth={1.5} />
        </button>
      ) : (
        <div className="px-3 pb-2 flex items-center gap-2">
          <Newspaper className="h-3.5 w-3.5 text-[#cdbfa4]/70" strokeWidth={1.5} />
          <span className="text-[9px] font-mono uppercase tracking-[0.26em] text-[#cdbfa4]/55">חדשות שוק</span>
        </div>
      )}

      <div className={`space-y-0.5 ${collapsible && !open ? 'hidden' : ''}`}>
        {isLoading ? (
          <div className="space-y-2 px-2 py-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-6 rounded bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : news.length === 0 ? (
          <p className="px-3 py-2 text-[10px] text-muted-foreground/60">אין כותרות זמינות כעת.</p>
        ) : (
          news.map((n, i) => (
            <a
              key={`${n.url}-${i}`}
              href={n.url}
              target="_blank"
              rel="noopener noreferrer"
              dir="ltr"
              className="group flex items-start gap-1.5 px-3 py-1.5 rounded-md transition-colors hover:bg-white/[0.03]"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[11px] leading-snug text-muted-foreground group-hover:text-foreground line-clamp-2">
                  {n.title}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[8.5px] font-mono font-bold text-[#cdbfa4]/70 truncate">{n.source}</span>
                  <span className="text-[8.5px] font-mono text-muted-foreground/50" dir="rtl">{timeAgo(n.publishedAt)}</span>
                </div>
              </div>
              <ExternalLink className="h-2.5 w-2.5 mt-0.5 flex-shrink-0 text-muted-foreground/30 group-hover:text-[#cdbfa4]/70" />
            </a>
          ))
        )}
      </div>
    </div>
  );
}
