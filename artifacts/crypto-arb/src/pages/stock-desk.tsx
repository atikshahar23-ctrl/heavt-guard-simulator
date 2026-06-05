import { useState, useEffect, useMemo, useRef } from "react";
import {
  useGetStocks, getGetStocksQueryKey,
  useGetStockRecommendations, getGetStockRecommendationsQueryKey,
  useGetMarketMovers, getGetMarketMoversQueryKey,
  type StockQuote, type StockRecommendation,
} from "@workspace/api-client-react";
import {
  LineChart, RefreshCw, ShieldAlert, TrendingUp, TrendingDown, Activity,
  Gauge, Zap, Check, ExternalLink, CandlestickChart, Search, Newspaper,
  CalendarClock, Layers, Bot, ArrowUpRight, ArrowDownRight, Target, Filter,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StockIcon } from "@/components/stock-icon";
import { StockDetailPanel } from "@/components/stock-detail-panel";
import { UniversalStockSearch } from "@/components/universal-stock-search";
import { usePortfolio } from "@/contexts/portfolio-context";
import { useRefresh } from "@/contexts/refresh-context";
import { recommendLevels } from "@/lib/recommend-levels";
import { getMarketNotes, formatHebrewDate } from "@/lib/market-calendar";

/* ─── Labels & helpers ─── */

const CATEGORY_LABEL_HE: Record<string, string> = {
  TECH: "טכנולוגיה",
  ENERGY: "אנרגיה",
  RESOURCES: "חומרי גלם",
  LARGE_CAP: "שווי שוק גדול",
  INDEX: "מדדים / קרנות סל",
};

const ACTION_HE: Record<StockRecommendation["action"], string> = {
  BUY: "קנייה",
  SELL: "מכירה",
  HOLD: "המתנה",
};

const CONFIDENCE_HE: Record<StockRecommendation["confidence"], string> = {
  HIGH: "ביטחון גבוה",
  MEDIUM: "ביטחון בינוני",
  LOW: "ביטחון נמוך",
};

// Indices / ETFs to surface as the top market strip, in display order.
const INDEX_ORDER = ["SPY", "QQQ", "DIA", "IWM", "GLD", "USO"];

const SECTOR_ORDER = ["TECH", "LARGE_CAP", "ENERGY", "RESOURCES", "INDEX"];

function fmtPrice(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(n: number, d = 2) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`;
}

/** Build a fully-Hebrew, rule-based rationale from the structured signal fields. */
function hebrewRationale(rec: StockRecommendation): string {
  const mom = rec.momentum5dPercent;
  const day = rec.changePercent;
  const range = Math.round(rec.rangePositionPercent);
  if (rec.action === "BUY") {
    return `מומנטום חיובי — עלייה של ${mom.toFixed(1)}% ב-5 ימי מסחר, ${pct(day)} היום, ונסחרת ב-${range}% מטווח החודש. הסוכן מזהה תנאים להמשך כלפי מעלה.`;
  }
  if (rec.action === "SELL") {
    return `לחץ מכירות — ירידה של ${Math.abs(mom).toFixed(1)}% ב-5 ימים, ${pct(day)} היום, ${range}% מטווח החודש. הסוכן מזהה חולשה; שקול הימנעות או הקטנת חשיפה.`;
  }
  return `דשדוש — תנועה של ${pct(mom, 1)} ב-5 ימים ו-${pct(day)} היום (${range}% מהטווח). אין יתרון ברור; המתנה לאיתות חזק יותר.`;
}

/** Educational entry / target / stop levels (NOT advice). HOLD → no levels. */
function levelsFor(rec: StockRecommendation) {
  if (rec.action === "HOLD") return null;
  const direction = rec.action === "SELL" ? "SHORT" : "LONG";
  const { sl, tp } = recommendLevels(rec.price, direction, { slPct: 0.03, tpPct: 0.06 });
  return { entry: rec.price, stop: sl, target: tp, direction } as const;
}

/* ─── Index strip ─── */

function IndexCard({ q }: { q: StockQuote }) {
  const up = q.changePercent >= 0;
  return (
    <div className="rounded-lg border border-border bg-card/50 px-3 py-2 min-w-[118px] flex-1">
      <div className="flex items-center gap-1.5">
        <StockIcon symbol={q.symbol} size={18} />
        <span className="font-mono font-bold text-xs">{q.symbol}</span>
      </div>
      <div className="mt-1 text-sm font-black tabular-nums">${fmtPrice(q.price)}</div>
      <div className={`text-[11px] font-mono font-bold ${up ? "text-emerald-400" : "text-red-400"}`}>
        {pct(q.changePercent)}
      </div>
    </div>
  );
}

/* ─── Pulse stat ─── */

function PulseStat({ icon: Icon, label, value, sub, tone }: {
  icon: typeof Activity; label: string; value: string; sub: string; tone: "up" | "down" | "flat";
}) {
  const color = tone === "up" ? "text-emerald-400" : tone === "down" ? "text-red-400" : "text-primary";
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={`mt-1 text-lg font-black tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

/* ─── Agent recommendation row ─── */

function ConfidencePill({ confidence }: { confidence: StockRecommendation["confidence"] }) {
  const styles: Record<StockRecommendation["confidence"], string> = {
    HIGH: "bg-primary/20 text-primary border-primary/30",
    MEDIUM: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    LOW: "bg-muted/30 text-muted-foreground border-border",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-full border ${styles[confidence]}`}>
      {confidence === "HIGH" && <Zap className="h-2.5 w-2.5" />}
      {CONFIDENCE_HE[confidence]}
    </span>
  );
}

function AgentRow({ rec, quote, onOpen }: {
  rec: StockRecommendation;
  quote: StockQuote | undefined;
  onOpen: (q: StockQuote) => void;
}) {
  const { cash, openStockPosition, activeWalletName } = usePortfolio();
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const isBuy = rec.action === "BUY";
  const isSell = rec.action === "SELL";
  const levels = levelsFor(rec);
  const momUp = rec.momentum5dPercent >= 0;
  const tvUrl = `https://www.tradingview.com/symbols/${encodeURIComponent(rec.tradingViewSymbol)}/`;

  const accent = isBuy ? "border-r-emerald-500" : isSell ? "border-r-red-500" : "border-r-border";
  const actionColor = isBuy ? "text-emerald-400" : isSell ? "text-red-400" : "text-muted-foreground";

  function quickTrade() {
    if (!levels) return;
    const amount = Math.min(2000, Math.max(0, cash * 0.1));
    if (amount < 1) { setErr("אין מספיק מזומן"); return; }
    const e = openStockPosition(
      {
        symbol: rec.symbol, name: rec.name, direction: levels.direction,
        entryPrice: rec.price, slPrice: levels.stop, tpPrice: levels.target,
        source: "Stock Desk",
      },
      amount,
    );
    if (e) { setErr(e); return; }
    setErr(null);
    setDone(`→ ${activeWalletName}`);
    setTimeout(() => setDone(null), 3000);
  }

  return (
    <div className={`rounded-lg border border-border border-r-4 ${accent} bg-card/40 p-3 hover:border-primary/30 transition-colors`}>
      <div className="flex items-start gap-3">
        {/* Rank + icon */}
        <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
          <span className="text-[10px] font-mono text-muted-foreground/50 font-bold">#{rec.rank}</span>
          <StockIcon symbol={rec.symbol} size={28} />
        </div>

        {/* Main */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-sm">{rec.symbol}</span>
            <span className="text-xs text-muted-foreground truncate max-w-[140px]">{rec.name}</span>
            <span className={`text-xs font-black ${actionColor}`}>{ACTION_HE[rec.action]}</span>
            <ConfidencePill confidence={rec.confidence} />
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-secondary/50 text-muted-foreground">
              {CATEGORY_LABEL_HE[rec.category] ?? rec.category}
            </span>
          </div>

          <p className="mt-1.5 text-[11px] text-foreground/80 leading-relaxed">{hebrewRationale(rec)}</p>

          {/* Metrics */}
          <div className="mt-2 flex items-center gap-3 flex-wrap text-[10px] font-mono">
            <span className="text-muted-foreground">מחיר <b className="text-foreground">${fmtPrice(rec.price)}</b></span>
            <span className={rec.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}>היום {pct(rec.changePercent)}</span>
            <span className={momUp ? "text-emerald-400/80" : "text-red-400/80"}>5 ימים {pct(rec.momentum5dPercent, 1)}</span>
            <span className="text-muted-foreground">טווח {Math.round(rec.rangePositionPercent)}%</span>
          </div>

          {/* Educational levels */}
          {levels && (
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <LevelChip label="כניסה" value={`$${fmtPrice(levels.entry)}`} tone="flat" />
              <LevelChip label="יעד" value={`$${fmtPrice(levels.target)}`} tone="up" />
              <LevelChip label="סטופ" value={`$${fmtPrice(levels.stop)}`} tone="down" />
            </div>
          )}

          {/* Actions */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {levels && (
              <button
                onClick={quickTrade}
                className="flex items-center gap-1 text-[10px] font-mono font-bold px-2.5 py-1.5 rounded border border-primary/40 bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
              >
                <Zap className="h-3 w-3" /> מסחר מהיר
              </button>
            )}
            {quote && (
              <button
                onClick={() => onOpen(quote)}
                className="flex items-center gap-1 text-[10px] font-mono font-bold px-2.5 py-1.5 rounded border border-border text-foreground hover:border-primary/40 hover:text-primary transition-colors"
              >
                <CandlestickChart className="h-3 w-3" /> גרף וסחר
              </button>
            )}
            <a
              href={tvUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] font-mono px-2.5 py-1.5 rounded border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
            >
              TradingView <ExternalLink className="h-3 w-3" />
            </a>
            {done && <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400"><Check className="h-3 w-3" /> בוצע {done}</span>}
            {err && <span className="text-[10px] font-mono text-red-400">{err}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function LevelChip({ label, value, tone }: { label: string; value: string; tone: "up" | "down" | "flat" }) {
  const c = tone === "up" ? "text-emerald-400 border-emerald-500/25 bg-emerald-500/5"
    : tone === "down" ? "text-red-400 border-red-500/25 bg-red-500/5"
    : "text-foreground border-border bg-secondary/30";
  return (
    <div className={`rounded border px-2 py-1 ${c}`}>
      <div className="text-[8.5px] font-mono uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-[11px] font-mono font-bold tabular-nums">{value}</div>
    </div>
  );
}

/* ─── Side panels ─── */

function MoverRow({ q, onOpen }: { q: StockQuote; onOpen: (q: StockQuote) => void }) {
  const up = q.changePercent >= 0;
  return (
    <button
      onClick={() => onOpen(q)}
      className="w-full flex items-center justify-between gap-2 rounded-md border border-border/60 bg-secondary/20 px-2.5 py-1.5 hover:border-primary/40 transition-colors text-right"
    >
      <div className="flex items-center gap-2 min-w-0">
        <StockIcon symbol={q.symbol} size={18} />
        <div className="min-w-0">
          <div className="text-xs font-bold font-mono">{q.symbol}</div>
          <div className="text-[10px] text-muted-foreground truncate max-w-[110px]">{q.name}</div>
        </div>
      </div>
      <span className={`text-[11px] font-mono font-bold shrink-0 ${up ? "text-emerald-400" : "text-red-400"}`}>
        {pct(q.changePercent)}
      </span>
    </button>
  );
}

/* ─── Page ─── */

type ActionFilter = "ALL" | "BUY" | "SELL";

export default function StockDeskPage() {
  const { intervalFor } = useRefresh();
  const stocksInterval = intervalFor(30000, 30000);
  const recsInterval = intervalFor(60000, 60000);
  const intervalSeconds = Math.round(stocksInterval / 1000);
  const [countdown, setCountdown] = useState(intervalSeconds);
  const [selected, setSelected] = useState<StockQuote | null>(null);
  const [filter, setFilter] = useState<ActionFilter>("ALL");

  const { data: stocks, isLoading: stocksLoading, isFetching } = useGetStocks({
    query: { queryKey: getGetStocksQueryKey(), refetchInterval: stocksInterval },
  });
  const { data: recsData, isLoading: recsLoading } = useGetStockRecommendations({
    query: { queryKey: getGetStockRecommendationsQueryKey(), refetchInterval: recsInterval, staleTime: 45000 },
  });
  const { data: movers } = useGetMarketMovers({
    query: { queryKey: getGetMarketMoversQueryKey(), refetchInterval: 180000, staleTime: 120000 },
  });

  const now = new Date();
  const calNotes = getMarketNotes(now);
  const fg = movers?.fearGreed;

  const stocksList = useMemo(() => (stocks ?? []) as StockQuote[], [stocks]);
  const recs = useMemo(() => (recsData ?? []) as StockRecommendation[], [recsData]);

  // Quote lookup by symbol so the agent rows can open the full chart panel.
  const quoteBySymbol = useMemo(() => {
    const map = new Map<string, StockQuote>();
    for (const q of stocksList) map.set(q.symbol, q);
    return map;
  }, [stocksList]);

  const indices = useMemo(() => {
    const idx = stocksList.filter((s) => s.category === "INDEX");
    return INDEX_ORDER
      .map((sym) => idx.find((s) => s.symbol === sym))
      .filter((s): s is StockQuote => Boolean(s));
  }, [stocksList]);

  // Breadth + average over the non-index tradable universe.
  const breadth = useMemo(() => {
    const tradable = stocksList.filter((s) => s.category !== "INDEX");
    const adv = tradable.filter((s) => s.changePercent > 0).length;
    const dec = tradable.filter((s) => s.changePercent < 0).length;
    const avg = tradable.length ? tradable.reduce((a, s) => a + s.changePercent, 0) / tradable.length : 0;
    return { adv, dec, avg, total: tradable.length };
  }, [stocksList]);

  const buyCount = recs.filter((r) => r.action === "BUY").length;
  const sellCount = recs.filter((r) => r.action === "SELL").length;

  const filteredRecs = useMemo(
    () => (filter === "ALL" ? recs : recs.filter((r) => r.action === filter)),
    [recs, filter],
  );

  // Sector heatmap: average daily change per category.
  const sectors = useMemo(() => {
    return SECTOR_ORDER.map((cat) => {
      const group = stocksList.filter((s) => s.category === cat);
      const avg = group.length ? group.reduce((a, s) => a + s.changePercent, 0) / group.length : 0;
      return { cat, avg, count: group.length };
    }).filter((s) => s.count > 0);
  }, [stocksList]);

  const gainers = useMemo(
    () => [...stocksList].filter((s) => s.category !== "INDEX").sort((a, b) => b.changePercent - a.changePercent).slice(0, 5),
    [stocksList],
  );
  const losers = useMemo(
    () => [...stocksList].filter((s) => s.category !== "INDEX").sort((a, b) => a.changePercent - b.changePercent).slice(0, 5),
    [stocksList],
  );

  // Deep-link ?symbol=AAPL → open that chart once quotes load.
  const deepLinkDone = useRef(false);
  useEffect(() => {
    if (deepLinkDone.current || stocksList.length === 0) return;
    const wanted = new URLSearchParams(window.location.search).get("symbol");
    deepLinkDone.current = true;
    if (!wanted) return;
    const match = stocksList.find((s) => s.symbol.toUpperCase() === wanted.toUpperCase());
    if (match) setSelected(match);
  }, [stocksList]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isFetching) setCountdown(intervalSeconds);
    else timer = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [isFetching, intervalSeconds]);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LineChart className="h-6 w-6 text-primary" />
            <h1 className="text-xl md:text-2xl font-black tracking-tight">חדר המסחר — מניות</h1>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{formatHebrewDate(now)} · כל מה שצריך סוחר מניות במסך אחד — מדדים, סוכן המלצות, מובילים, מגזרים, חדשות ולוח אירועים.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono bg-card px-3 py-1.5 rounded border border-border text-muted-foreground self-start">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-primary" : ""}`} />
          {isFetching ? "מעדכן..." : `${countdown}s`}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/[0.07] p-3 flex items-start gap-2">
        <ShieldAlert className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
        <p className="text-[11px] text-foreground/85 leading-relaxed">
          <span className="font-bold text-amber-400">חינוכי בלבד — לא ייעוץ השקעות.</span>{" "}
          הסוכן מסכם נתוני שוק ציבוריים ומחשב רמות כניסה/יעד/סטופ <span className="font-semibold">לתרגול בלבד</span>. אין כאן הבטחת תשואה, אחוזי הצלחה או המלצה לפעולה בכסף אמיתי.
        </p>
      </div>

      {/* Universal search */}
      <div className="rounded-lg border border-primary/25 bg-primary/[0.04] p-3">
        <div className="flex items-center gap-2 mb-2">
          <Search className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-bold tracking-widest uppercase text-primary">חיפוש כל מניה בעולם</span>
          <span className="text-[10px] text-muted-foreground">— חפש כל מניה, תעודת סל או מדד וסחר בו</span>
        </div>
        <UniversalStockSearch />
      </div>

      {/* Index strip */}
      <div>
        <h2 className="text-[11px] font-bold tracking-widest uppercase text-cyan-400/80 mb-2 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" /> מדדים מובילים
        </h2>
        {stocksLoading ? (
          <div className="flex gap-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 flex-1 rounded-lg" />)}</div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {indices.map((q) => <IndexCard key={q.symbol} q={q} />)}
          </div>
        )}
      </div>

      {/* Market pulse */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <PulseStat
          icon={Activity} label="רוחב שוק"
          value={`${breadth.adv} / ${breadth.dec}`}
          sub="עולות / יורדות"
          tone={breadth.adv >= breadth.dec ? "up" : "down"}
        />
        <PulseStat
          icon={breadth.avg >= 0 ? TrendingUp : TrendingDown} label="שינוי ממוצע"
          value={pct(breadth.avg)} sub={`על ${breadth.total} מניות`}
          tone={breadth.avg >= 0 ? "up" : "down"}
        />
        <PulseStat
          icon={Gauge} label="פחד/חמדנות"
          value={fg ? String(fg.value) : "—"} sub={fg?.classification ?? "טוען…"}
          tone={(fg?.value ?? 50) >= 55 ? "up" : (fg?.value ?? 50) <= 45 ? "down" : "flat"}
        />
        <PulseStat
          icon={Bot} label="איתותי הסוכן"
          value={`${buyCount} / ${sellCount}`} sub="קנייה / מכירה"
          tone={buyCount >= sellCount ? "up" : "down"}
        />
      </div>

      {/* Main grid: agent (left/wide) + side panels (right/narrow) */}
      <div className="grid lg:grid-cols-[1.65fr_1fr] gap-4 items-start">
        {/* Agent */}
        <section className="rounded-xl border border-border bg-card/30 p-3 md:p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <h2 className="text-sm font-bold flex items-center gap-1.5">
              <Bot className="h-4 w-4 text-primary" /> סוכן המניות
              <span className="text-[10px] font-mono text-muted-foreground">— {recs.length} המלצות מדורגות</span>
            </h2>
            <div className="flex items-center gap-1">
              <Filter className="h-3 w-3 text-muted-foreground" />
              <div className="flex rounded-md border border-border overflow-hidden text-[10px] font-mono font-bold">
                {([["ALL", "הכל"], ["BUY", "קנייה"], ["SELL", "מכירה"]] as const).map(([k, lbl]) => (
                  <button
                    key={k}
                    onClick={() => setFilter(k)}
                    className={`px-2.5 py-1 transition-colors ${filter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/50"}`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {recsLoading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}</div>
          ) : filteredRecs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">אין המלצות בקטגוריה זו כרגע.</div>
          ) : (
            <div className="space-y-2 max-h-[760px] overflow-y-auto pl-1 -ml-1">
              {filteredRecs.map((rec) => (
                <AgentRow key={rec.symbol} rec={rec} quote={quoteBySymbol.get(rec.symbol)} onOpen={setSelected} />
              ))}
            </div>
          )}
        </section>

        {/* Side panels */}
        <div className="space-y-4">
          {/* Sectors */}
          <section className="rounded-xl border border-border bg-card/30 p-3 md:p-4">
            <h2 className="text-sm font-bold flex items-center gap-1.5 mb-2.5"><Layers className="h-4 w-4 text-primary" /> מגזרים</h2>
            <div className="space-y-2">
              {sectors.length === 0 && <p className="text-[11px] text-muted-foreground">טוען…</p>}
              {sectors.map((s) => {
                const up = s.avg >= 0;
                const width = Math.min(100, Math.abs(s.avg) * 25 + 6);
                return (
                  <div key={s.cat}>
                    <div className="flex items-center justify-between text-[11px] mb-0.5">
                      <span className="font-medium">{CATEGORY_LABEL_HE[s.cat] ?? s.cat}</span>
                      <span className={`font-mono font-bold ${up ? "text-emerald-400" : "text-red-400"}`}>{pct(s.avg)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden flex" dir="ltr">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${width}%`, background: up ? "hsl(152 60% 45%)" : "hsl(0 72% 51%)" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Movers */}
          <section className="rounded-xl border border-border bg-card/30 p-3 md:p-4 space-y-3">
            <div>
              <h2 className="text-xs font-bold flex items-center gap-1.5 mb-2 text-emerald-400"><ArrowUpRight className="h-3.5 w-3.5" /> המובילות</h2>
              <div className="space-y-1.5">
                {gainers.length === 0 && <p className="text-[11px] text-muted-foreground">טוען…</p>}
                {gainers.map((q) => <MoverRow key={q.symbol} q={q} onOpen={setSelected} />)}
              </div>
            </div>
            <div>
              <h2 className="text-xs font-bold flex items-center gap-1.5 mb-2 text-red-400"><ArrowDownRight className="h-3.5 w-3.5" /> המפסידות</h2>
              <div className="space-y-1.5">
                {losers.length === 0 && <p className="text-[11px] text-muted-foreground">טוען…</p>}
                {losers.map((q) => <MoverRow key={q.symbol} q={q} onOpen={setSelected} />)}
              </div>
            </div>
          </section>

          {/* Calendar */}
          <section className="rounded-xl border border-border bg-card/30 p-3 md:p-4">
            <h2 className="text-sm font-bold flex items-center gap-1.5 mb-2.5"><CalendarClock className="h-4 w-4 text-primary" /> לוח אירועים</h2>
            {calNotes.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">אין אירועי מסחר מיוחדים היום — יום מסחר רגיל.</p>
            ) : (
              <div className="space-y-1.5">
                {calNotes.map((n, i) => (
                  <div key={i} className="rounded-md border border-border/60 bg-secondary/20 px-2.5 py-1.5 flex items-start gap-1.5">
                    <Target className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                    <span className="text-[11px] text-foreground/85 leading-snug">{n.label}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Headlines */}
      {movers?.news && movers.news.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold flex items-center gap-1.5"><Newspaper className="h-4 w-4 text-primary" /> כותרות שמזיזות שוק</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
            {movers.news.slice(0, 9).map((n, i) => (
              <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" className="rounded-md border border-border/60 bg-card/40 p-2.5 hover:border-primary/40 transition-colors">
                <p className="text-[11px] leading-snug line-clamp-2">{n.title}</p>
                {n.source && <span className="text-[9px] text-muted-foreground">{n.source}</span>}
              </a>
            ))}
          </div>
        </section>
      )}

      <p className="text-center text-[10px] text-muted-foreground/70 pt-2">
        הדמיה חינוכית בלבד · ללא כסף אמיתי · ללא ייעוץ או הבטחת תשואות
      </p>

      {selected && <StockDetailPanel stock={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
