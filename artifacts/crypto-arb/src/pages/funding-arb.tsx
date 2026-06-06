import { useEffect, useMemo, useRef, useState } from "react";
import {
  useGetFundingOpportunities,
  getGetFundingOpportunitiesQueryKey,
  useCheckFundingAsset,
  getCheckFundingAssetQueryKey,
  useBacktestFundingAsset,
  getBacktestFundingAssetQueryKey,
} from "@workspace/api-client-react";
import type {
  FundingOpportunity,
  FundingAssetCheck,
  FundingBacktest,
} from "@workspace/api-client-react";
import {
  Coins, RefreshCw, Search, TrendingUp, TrendingDown, Wallet,
  ArrowDownUp, Activity, ShieldCheck, AlertTriangle, Languages, Scale,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { CryptoIcon } from "@/components/crypto-icon";
import { FundingChart } from "@/components/funding-chart";
import { usePortfolio } from "@/contexts/portfolio-context";
import { toast } from "@/hooks/use-toast";

type Lang = "he" | "en";
const LANG_STORAGE = "jarvis-lang";

function loadLang(): Lang {
  if (typeof window === "undefined") return "he";
  return window.localStorage.getItem(LANG_STORAGE) === "en" ? "en" : "he";
}

function fmtPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(2);
  if (p >= 0.01) return p.toFixed(4);
  return p.toPrecision(3);
}

function fmtPct(p: number): string {
  return `${p >= 0 ? "+" : ""}${p.toFixed(2)}%`;
}

const T = {
  title: { he: "ארביטראז' מימון", en: "Funding Arbitrage" },
  subtitle: {
    he: "תרחישים חינוכיים של עסקת cash-and-carry דלתא-ניטרלית: רגל בסיס מול חוזה עתידי שגובה/משלם מימון. ללא כסף אמיתי.",
    en: "Educational delta-neutral cash-and-carry scenarios: a base leg vs a perp that collects/pays funding. No real money.",
  },
  riskNote: {
    he: "⚠ חומר חינוכי בלבד — לא ייעוץ השקעות. תשואות מימון משתנות ואינן מובטחות; פרשי מחיר (basis) ועלויות עלולים למחוק את התקבולים.",
    en: "⚠ Educational only — not financial advice. Funding yields vary and are never guaranteed; basis drift and costs can erase the carry.",
  },
  opportunities: { he: "הזדמנויות מדורגות", en: "Ranked Opportunities" },
  checkTitle: { he: "בדיקת נכס מיידית", en: "Instant Asset Check" },
  checkPlaceholder: { he: "סמל נכס (BTC, ETH, SOL)…", en: "Asset symbol (BTC, ETH, SOL)…" },
  check: { he: "בדוק", en: "Check" },
  annualized: { he: "מתואם שנתי", en: "Annualized" },
  perInterval: { he: "לכל מחזור", en: "Per interval" },
  spot: { he: "מחיר בסיס", en: "Base price" },
  side: { he: "כיוון", en: "Side" },
  bestVenue: { he: "זירה מובילה", en: "Best venue" },
  viability: { he: "כדאיות", en: "Viability" },
  shortPerp: { he: "לונג בסיס · שורט חוזה", en: "Long base · Short perp" },
  longPerp: { he: "שורט בסיס · לונג חוזה", en: "Short base · Long perp" },
  fundingChart: { he: "היסטוריית מימון", en: "Funding history" },
  backtest: { he: "תרחיש לאחור", en: "Backtest scenario" },
  accrued: { he: "מימון מצטבר", en: "Accrued funding" },
  posIntervals: { he: "מחזורים חיוביים", en: "Positive intervals" },
  worst: { he: "מחזור גרוע ביותר", en: "Worst interval" },
  maxAdverse: { he: "סטייה מרבית", en: "Max adverse" },
  verdict: { he: "מסקנה", en: "Verdict" },
  notFound: { he: "לא נמצאו נתוני מימון לנכס זה.", en: "No funding data found for this asset." },
  empty: { he: "אין הזדמנויות זמינות כרגע.", en: "No opportunities available right now." },
  noPositive: { he: "אין כעת תקבולי מימון חיוביים בנכס זה.", en: "No positive funding carry on this asset right now." },
  paperTrade: { he: "פתח עסקה דמו דלתא-ניטרלית", en: "Open delta-neutral demo" },
  bal: { he: "יתרה", en: "Bal" },
  notional: { he: "נפח לכל רגל", en: "Notional / leg" },
  open: { he: "פתח", en: "Open" },
};

function viabilityColor(v: string): string {
  if (v === "STRONG") return "#22c55e";
  if (v === "MODERATE") return "#84cc16";
  if (v === "WEAK") return "hsl(43 74% 52%)";
  return "#ef4444";
}

function sideMeta(side: string, lang: Lang) {
  if (side === "SHORT_PERP") {
    return { Icon: TrendingDown, color: "#ef4444", label: T.shortPerp[lang] };
  }
  return { Icon: TrendingUp, color: "#22c55e", label: T.longPerp[lang] };
}

/** Delta-neutral paper entry: opens a base leg + opposite perp leg accruing simulated funding. */
function PaperEntry({ asset, spotPrice, side, annualizedPercent, lang }: {
  asset: string; spotPrice: number; side: string; annualizedPercent: number; lang: Lang;
}) {
  const { cash, openFundingPosition } = usePortfolio();
  const [open, setOpen] = useState(false);
  const [notional, setNotional] = useState(500);

  function submit() {
    if (!(notional > 0)) {
      toast({ title: lang === "he" ? "סכום לא תקין" : "Invalid amount", variant: "destructive" });
      return;
    }
    if (notional > cash) {
      toast({
        title: lang === "he" ? "אין מספיק יתרה" : "Insufficient balance",
        description: `${lang === "he" ? "זמין" : "Available"} $${cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        variant: "destructive",
      });
      return;
    }
    const err = openFundingPosition({
      asset,
      side: side === "SHORT_PERP" ? "SHORT_PERP" : "LONG_PERP",
      notionalPerLeg: notional,
      entryPrice: spotPrice,
      annualizedPercent,
      source: lang === "he" ? "ארביטראז' מימון" : "Funding arb",
    });
    if (err) {
      toast({ title: lang === "he" ? "פתיחה נכשלה" : "Open failed", description: err, variant: "destructive" });
      return;
    }
    toast({
      title: `${asset} ${lang === "he" ? "עסקת מימון נפתחה" : "funding position opened"}`,
      description: `${sideMeta(side, lang).label} · $${notional.toLocaleString()} / ${lang === "he" ? "רגל" : "leg"}`,
    });
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full mt-1 flex items-center justify-center gap-1.5 rounded py-1.5 text-xs font-mono font-bold tracking-wide transition-colors"
          style={{ background: "hsl(43 74% 52% / 0.12)", color: "hsl(43 74% 52%)", boxShadow: "inset 0 0 0 1px hsl(43 74% 52% / 0.3)" }}>
          <Wallet className="h-3 w-3" /> {T.paperTrade[lang]}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="end">
        <div className="flex items-center justify-between">
          <span className="font-mono font-bold text-sm text-primary">{asset}</span>
          <span className="text-[10px] font-mono text-muted-foreground">{T.bal[lang]} ${cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{T.notional[lang]} (USD)</label>
          <Input type="number" value={notional} min={1} onChange={(e) => setNotional(Math.max(0, Number(e.target.value)))} className="h-8 font-mono text-sm" />
          <div className="flex gap-1">
            {[100, 250, 500, 1000].map((v) => (
              <button key={v} onClick={() => setNotional(v)} className="flex-1 rounded bg-secondary/50 py-1 text-[10px] font-mono hover:bg-secondary">${v}</button>
            ))}
          </div>
        </div>
        <div className="rounded bg-secondary/40 p-2 space-y-1 text-[10px] font-mono">
          <div className="flex justify-between"><span className="text-muted-foreground">{T.side[lang]}</span><span className="text-foreground font-bold">{sideMeta(side, lang).label}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{T.spot[lang]}</span><span className="text-foreground">${fmtPrice(spotPrice)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{T.annualized[lang]}</span><span className="text-emerald-400 font-bold">{fmtPct(annualizedPercent)}</span></div>
        </div>
        <Button onClick={submit} className="w-full h-8 font-mono font-bold" style={{ background: "hsl(43 74% 52%)", color: "#0a0a0a" }}>
          {T.open[lang]} · ${notional}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function OpportunityCard({ o, lang }: { o: FundingOpportunity; lang: Lang }) {
  const sm = sideMeta(o.side, lang);
  const vc = viabilityColor(o.viability);
  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-3 transition-colors" style={{ borderColor: `${vc}33` }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[10px] text-muted-foreground w-5">#{o.rank}</span>
          <CryptoIcon asset={o.asset} size={22} />
          <span className="font-mono font-black text-base text-foreground">{o.asset}</span>
        </div>
        <div className="flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold text-[10px]" style={{ background: `${vc}1a`, color: vc }}>
          {o.viability === "STRONG" || o.viability === "MODERATE" ? <ShieldCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          {o.viability}
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">{T.annualized[lang]}</div>
          <span className="font-mono text-2xl font-black" style={{ color: vc }}>{fmtPct(o.annualizedPercent)}</span>
        </div>
        <div className="text-right">
          <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">{T.spot[lang]}</div>
          <span className="font-mono text-sm font-bold text-foreground">${fmtPrice(o.spotPrice)}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 rounded bg-secondary/30 px-2 py-1.5" style={{ color: sm.color }}>
        <ArrowDownUp className="h-3 w-3" />
        <span className="font-mono text-[11px] font-bold">{sm.label}</span>
        <span className="ms-auto font-mono text-[10px] text-muted-foreground">{o.bestVenue}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded bg-secondary/40 py-1.5">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">Binance</div>
          <div className="font-mono text-xs font-bold text-foreground">{o.binanceAnnualizedPercent === null ? "—" : fmtPct(o.binanceAnnualizedPercent)}</div>
        </div>
        <div className="rounded bg-secondary/40 py-1.5">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">Hyperliquid</div>
          <div className="font-mono text-xs font-bold text-foreground">{o.hyperliquidAnnualizedPercent === null ? "—" : fmtPct(o.hyperliquidAnnualizedPercent)}</div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground leading-snug border-t border-border/50 pt-2">
        {lang === "he" ? o.analysisHe : o.analysisEn}
      </p>

      <PaperEntry asset={o.asset} spotPrice={o.spotPrice} side={o.side} annualizedPercent={o.annualizedPercent} lang={lang} />
    </div>
  );
}

function BacktestPanel({ bt, lang }: { bt: FundingBacktest; lang: Lang }) {
  const vc = viabilityColor(bt.verdict);
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3" style={{ borderColor: `${vc}33` }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-black tracking-tight">{T.backtest[lang]}</h3>
          <span className="text-[10px] font-mono text-muted-foreground">{bt.hours}h · {bt.venue}</span>
        </div>
        <div className="flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold text-[10px]" style={{ background: `${vc}1a`, color: vc }}>
          {bt.verdict}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <div className="rounded bg-secondary/40 py-2">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">{T.accrued[lang]}</div>
          <div className="font-mono text-sm font-bold" style={{ color: bt.accruedFundingUsd >= 0 ? "#22c55e" : "#ef4444" }}>${bt.accruedFundingUsd.toFixed(2)}</div>
          <div className="font-mono text-[9px] text-muted-foreground">{fmtPct(bt.accruedFundingPercent)}</div>
        </div>
        <div className="rounded bg-secondary/40 py-2">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">{T.annualized[lang]}</div>
          <div className="font-mono text-sm font-bold" style={{ color: vc }}>{fmtPct(bt.annualizedPercent)}</div>
        </div>
        <div className="rounded bg-secondary/40 py-2">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">{T.posIntervals[lang]}</div>
          <div className="font-mono text-sm font-bold text-foreground">{bt.positiveIntervals}/{bt.intervals}</div>
        </div>
        <div className="rounded bg-secondary/40 py-2">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">{T.maxAdverse[lang]}</div>
          <div className="font-mono text-sm font-bold text-red-400">{fmtPct(bt.maxAdversePercent)}</div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground leading-snug border-t border-border/50 pt-2">
        {lang === "he" ? bt.analysisHe : bt.analysisEn}
      </p>
    </div>
  );
}

function CheckResult({ chk, lang }: { chk: FundingAssetCheck; lang: Lang }) {
  const sm = sideMeta(chk.side, lang);
  const vc = viabilityColor(chk.viability);
  const hasCarry = chk.annualizedPercent > 0;
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3" style={{ borderColor: `${vc}33` }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <CryptoIcon asset={chk.asset} size={24} />
          <span className="font-mono font-black text-base text-foreground">{chk.asset}</span>
          <span className="text-[10px] font-mono text-muted-foreground">${fmtPrice(chk.spotPrice)}</span>
        </div>
        <div className="flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold text-[10px]" style={{ background: `${vc}1a`, color: vc }}>
          {chk.viability}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded bg-secondary/40 py-2">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">{T.annualized[lang]}</div>
          <div className="font-mono text-sm font-bold" style={{ color: vc }}>{fmtPct(chk.annualizedPercent)}</div>
        </div>
        <div className="rounded bg-secondary/40 py-2">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">{T.side[lang]}</div>
          <div className="font-mono text-[11px] font-bold" style={{ color: sm.color }}>{sm.label}</div>
        </div>
        <div className="rounded bg-secondary/40 py-2">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">{T.bestVenue[lang]}</div>
          <div className="font-mono text-[11px] font-bold text-foreground">{chk.bestVenue}</div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground leading-snug">{lang === "he" ? chk.analysisHe : chk.analysisEn}</p>

      {chk.history.length > 1 && (
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">{T.fundingChart[lang]}</div>
          <div className="h-48 rounded-lg border border-border/50 overflow-hidden">
            <FundingChart series={chk.history} metric="annualized" />
          </div>
        </div>
      )}

      {hasCarry ? (
        <PaperEntry asset={chk.asset} spotPrice={chk.spotPrice} side={chk.side} annualizedPercent={chk.annualizedPercent} lang={lang} />
      ) : (
        <p className="text-[10px] font-mono text-amber-400/80 text-center py-1">{T.noPositive[lang]}</p>
      )}
    </div>
  );
}

export default function FundingArbPage() {
  const [lang, setLang] = useState<Lang>(loadLang);
  const langRef = useRef(lang);
  langRef.current = lang;

  const [query, setQuery] = useState("");
  const [checkAsset, setCheckAsset] = useState<string | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(LANG_STORAGE, lang);
  }, [lang]);

  const { data, isLoading, isFetching } = useGetFundingOpportunities({
    query: {
      queryKey: getGetFundingOpportunitiesQueryKey(),
      refetchInterval: 120000,
      staleTime: 90000,
    },
  });

  const checkQ = useCheckFundingAsset(
    { asset: checkAsset ?? "" },
    { query: { queryKey: getCheckFundingAssetQueryKey({ asset: checkAsset ?? "" }), enabled: !!checkAsset, staleTime: 60000 } },
  );
  const backtestQ = useBacktestFundingAsset(
    { asset: checkAsset ?? "" },
    { query: { queryKey: getBacktestFundingAssetQueryKey({ asset: checkAsset ?? "" }), enabled: !!checkAsset, staleTime: 60000 } },
  );

  const opportunities = data ?? [];
  const dir = lang === "he" ? "rtl" : "ltr";

  const normalize = (s: string) => s.trim().toUpperCase().replace(/USDT?$/, "");

  // Typeahead suggestions drawn from the live opportunities data pool.
  const suggestions = useMemo(() => {
    const q = normalize(query);
    const seen = new Set<string>();
    return opportunities
      .filter((o) => {
        if (seen.has(o.asset)) return false;
        if (q && !o.asset.toUpperCase().includes(q)) return false;
        seen.add(o.asset);
        return true;
      })
      .slice(0, 8);
  }, [query, opportunities]);

  function runCheck() {
    const a = normalize(query);
    if (a) {
      setCheckAsset(a);
      setShowSuggest(false);
    }
  }

  function selectSuggestion(asset: string) {
    setQuery(asset);
    setCheckAsset(normalize(asset));
    setShowSuggest(false);
  }

  return (
    <div className="p-5 space-y-4" dir={dir}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-black tracking-tight">{T.title[lang]}</h1>
            {isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">{T.subtitle[lang]}</p>
        </div>
        <button
          onClick={() => setLang((l) => (l === "he" ? "en" : "he"))}
          className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-muted-foreground hover:text-foreground bg-secondary/40 hover:bg-secondary transition-colors flex-shrink-0"
        >
          <Languages className="h-3.5 w-3.5" />
          {lang === "he" ? "EN" : "עב"}
        </button>
      </div>

      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
        <p className="text-[10px] font-mono text-amber-400/90 leading-snug">{T.riskNote[lang]}</p>
      </div>

      {/* Instant asset check */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-black tracking-tight">{T.checkTitle[lang]}</h2>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowSuggest(true); }}
              onFocus={() => setShowSuggest(true)}
              onBlur={() => setTimeout(() => setShowSuggest(false), 120)}
              onKeyDown={(e) => e.key === "Enter" && runCheck()}
              placeholder={T.checkPlaceholder[lang]}
              className="h-9 font-mono text-sm w-full"
            />
            {showSuggest && suggestions.length > 0 && (
              <div
                className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border bg-card shadow-lg"
                dir="ltr"
              >
                {suggestions.map((o) => (
                  <button
                    key={o.asset}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectSuggestion(o.asset)}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-secondary/60 transition-colors"
                  >
                    <span className="font-mono font-bold">{o.asset}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {o.annualizedPercent >= 0 ? "+" : ""}{o.annualizedPercent.toFixed(1)}% APR
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button onClick={runCheck} className="h-9 font-mono font-bold flex-shrink-0" style={{ background: "hsl(43 74% 52%)", color: "#0a0a0a" }}>
            {T.check[lang]}
          </Button>
        </div>

        {checkAsset && (checkQ.isLoading || backtestQ.isLoading) && (
          <div className="space-y-3">
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-28 w-full rounded-lg" />
          </div>
        )}

        {checkAsset && !checkQ.isLoading && checkQ.data && !checkQ.data.found && (
          <p className="text-sm text-muted-foreground py-6 text-center">{T.notFound[lang]}</p>
        )}

        {checkAsset && checkQ.data?.found && (
          <div className="space-y-3">
            <CheckResult chk={checkQ.data} lang={lang} />
            {backtestQ.data && <BacktestPanel bt={backtestQ.data} lang={lang} />}
          </div>
        )}
      </div>

      {/* Ranked opportunities */}
      <div className="flex items-center gap-2 pt-1">
        <Activity className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-black tracking-tight">{T.opportunities[lang]}</h2>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-lg" />
          ))}
        </div>
      ) : opportunities.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">{T.empty[lang]}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {opportunities.map((o) => (
            <OpportunityCard key={o.asset} o={o} lang={lang} />
          ))}
        </div>
      )}
    </div>
  );
}
