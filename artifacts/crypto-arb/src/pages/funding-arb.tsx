import { useMemo, useRef, useState } from "react";
import {
  useGetFundingOpportunities,
  getGetFundingOpportunitiesQueryKey,
  useCheckFundingAsset,
  getCheckFundingAssetQueryKey,
  useBacktestFundingAsset,
  getBacktestFundingAssetQueryKey,
  useGetStocks,
  getGetStocksQueryKey,
  useGetFundingHistory,
  getGetFundingHistoryQueryKey,
} from "@workspace/api-client-react";
import type {
  FundingOpportunity,
  FundingAssetCheck,
  FundingBacktest,
  FundingRatePoint,
  StockQuote,
} from "@workspace/api-client-react";
import {
  Coins, RefreshCw, Search, TrendingUp, TrendingDown, Wallet,
  ArrowDownUp, Activity, ShieldCheck, AlertTriangle, Scale,
  Building2,
} from "lucide-react";
import { useLivePrice } from "@/contexts/live-price-context";
import { useLanguage } from "@/contexts/language-context";
import { t, type Lang } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { CryptoIcon } from "@/components/crypto-icon";
import { FundingChart } from "@/components/funding-chart";
import { usePortfolio } from "@/contexts/portfolio-context";
import { toast } from "@/hooks/use-toast";

type Suggestion = { kind: "crypto" | "stock"; symbol: string; sub: string };

function fmtPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(2);
  if (p >= 0.01) return p.toFixed(4);
  return p.toPrecision(3);
}

function fmtPct(p: number): string {
  return `${p >= 0 ? "+" : ""}${p.toFixed(2)}%`;
}

function viabilityColor(v: string): string {
  if (v === "STRONG") return "#22c55e";
  if (v === "MODERATE") return "#84cc16";
  if (v === "WEAK") return "hsl(207 30% 70%)";
  return "#ef4444";
}

function sideMeta(side: string, lang: Lang) {
  if (side === "SHORT_PERP") {
    return { Icon: TrendingDown, color: "#ef4444", label: t("markets.funding.shortPerp", lang) };
  }
  return { Icon: TrendingUp, color: "#22c55e", label: t("markets.funding.longPerp", lang) };
}

/** Delta-neutral paper entry: opens a base leg + opposite perp leg accruing simulated funding. */
function PaperEntry({ asset, spotPrice, side, annualizedPercent, lang }: {
  asset: string; spotPrice: number; side: string; annualizedPercent: number; lang: Lang;
}) {
  const { cash, openFundingPosition } = usePortfolio();
  const [open, setOpen] = useState(false);
  const [notional, setNotional] = useState(500);
  const lp = useLivePrice(asset);
  const effSpot = lp?.price ?? spotPrice;

  function submit() {
    if (!(notional > 0)) {
      toast({ title: t("markets.funding.invalidAmount", lang), variant: "destructive" });
      return;
    }
    if (notional > cash) {
      toast({
        title: t("markets.funding.insufficientBalance", lang),
        description: `${t("markets.funding.available", lang)} $${cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        variant: "destructive",
      });
      return;
    }
    const err = openFundingPosition({
      asset,
      side: side === "SHORT_PERP" ? "SHORT_PERP" : "LONG_PERP",
      notionalPerLeg: notional,
      entryPrice: effSpot,
      annualizedPercent,
      source: "Funding arb",
    });
    if (err) {
      toast({ title: t("markets.funding.openFailed", lang), description: err, variant: "destructive" });
      return;
    }
    toast({
      title: `${asset} ${t("markets.funding.positionOpened", lang)}`,
      description: `${sideMeta(side, lang).label} · $${notional.toLocaleString()} / ${t("markets.funding.leg", lang)}`,
    });
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full mt-1 flex items-center justify-center gap-1.5 rounded py-1.5 text-xs font-mono font-bold tracking-wide transition-colors"
          style={{ background: "hsl(207 30% 70% / 0.12)", color: "hsl(207 30% 70%)", boxShadow: "inset 0 0 0 1px hsl(207 30% 70% / 0.3)" }}>
          <Wallet className="h-3 w-3" /> {t("markets.funding.paperTrade", lang)}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="end">
        <div className="flex items-center justify-between">
          <span className="font-mono font-bold text-sm text-primary">{asset}</span>
          <span className="text-[10px] font-mono text-muted-foreground">{t("markets.funding.bal", lang)} ${cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{t("markets.funding.notional", lang)} (USD)</label>
          <Input type="number" value={notional} min={1} onChange={(e) => setNotional(Math.max(0, Number(e.target.value)))} className="h-8 font-mono text-sm" />
          <div className="flex gap-1">
            {[100, 250, 500, 1000].map((v) => (
              <button key={v} onClick={() => setNotional(v)} className="flex-1 rounded bg-secondary/50 py-1 text-[10px] font-mono hover:bg-secondary">${v}</button>
            ))}
          </div>
        </div>
        <div className="rounded bg-secondary/40 p-2 space-y-1 text-[10px] font-mono">
          <div className="flex justify-between"><span className="text-muted-foreground">{t("markets.funding.side", lang)}</span><span className="text-foreground font-bold">{sideMeta(side, lang).label}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t("markets.funding.spot", lang)}</span><span className="inline-flex items-center gap-1.5 text-foreground">{lp && <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" title={t("markets.funding.live", lang)} />}${fmtPrice(effSpot)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t("markets.funding.annualized", lang)}</span><span className="text-emerald-400 font-bold">{fmtPct(annualizedPercent)}</span></div>
        </div>
        <Button onClick={submit} className="w-full h-8 font-mono font-bold" style={{ background: "hsl(207 30% 70%)", color: "#0a0a0a" }}>
          {t("markets.funding.open", lang)} · ${notional}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function OpportunityCard({ o, lang }: { o: FundingOpportunity; lang: Lang }) {
  const sm = sideMeta(o.side, lang);
  const vc = viabilityColor(o.viability);
  const lp = useLivePrice(o.asset);
  const displaySpot = lp?.price ?? o.spotPrice;
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
          <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">{t("markets.funding.annualized", lang)}</div>
          <span className="font-mono text-2xl font-black" style={{ color: vc }}>{fmtPct(o.annualizedPercent)}</span>
        </div>
        <div className="text-right">
          <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground flex items-center justify-end gap-1">
            {lp && <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" title={t("markets.funding.live", lang)} />}
            {t("markets.funding.spot", lang)}
          </div>
          <span className="font-mono text-sm font-bold text-foreground">${fmtPrice(displaySpot)}</span>
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
          <h3 className="text-sm font-black tracking-tight">{t("markets.funding.backtest", lang)}</h3>
          <span className="text-[10px] font-mono text-muted-foreground">{bt.hours}h · {bt.venue}</span>
        </div>
        <div className="flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold text-[10px]" style={{ background: `${vc}1a`, color: vc }}>
          {bt.verdict}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <div className="rounded bg-secondary/40 py-2">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">{t("markets.funding.accrued", lang)}</div>
          <div className="font-mono text-sm font-bold" style={{ color: bt.accruedFundingUsd >= 0 ? "#22c55e" : "#ef4444" }}>${bt.accruedFundingUsd.toFixed(2)}</div>
          <div className="font-mono text-[9px] text-muted-foreground">{fmtPct(bt.accruedFundingPercent)}</div>
        </div>
        <div className="rounded bg-secondary/40 py-2">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">{t("markets.funding.annualized", lang)}</div>
          <div className="font-mono text-sm font-bold" style={{ color: vc }}>{fmtPct(bt.annualizedPercent)}</div>
        </div>
        <div className="rounded bg-secondary/40 py-2">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">{t("markets.funding.posIntervals", lang)}</div>
          <div className="font-mono text-sm font-bold text-foreground">{bt.positiveIntervals}/{bt.intervals}</div>
        </div>
        <div className="rounded bg-secondary/40 py-2">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">{t("markets.funding.maxAdverse", lang)}</div>
          <div className="font-mono text-sm font-bold text-red-400">{fmtPct(bt.maxAdversePercent)}</div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground leading-snug border-t border-border/50 pt-2">
        {lang === "he" ? bt.analysisHe : bt.analysisEn}
      </p>
    </div>
  );
}

/** Selectable lookback windows for the pro funding-history chart. */
const HIST_RANGES: { days: number; label: string }[] = [
  { days: 7, label: "7D" },
  { days: 30, label: "30D" },
  { days: 90, label: "90D" },
  { days: 365, label: "1Y" },
];

/**
 * Professional funding-history panel: a range selector (7D/30D/90D/1Y, fetched
 * as deep as the venue has data), an area chart with crosshair tooltip + average
 * reference line, and a summary stat strip. Falls back to the bundled check
 * history while the deep series loads so the chart never flashes empty.
 */
function FundingHistorySection({ asset, fallback, lang }: { asset: string; fallback: FundingRatePoint[]; lang: Lang }) {
  const [days, setDays] = useState(30);
  const { data, isLoading, isFetching } = useGetFundingHistory(
    { asset, days },
    { query: { queryKey: getGetFundingHistoryQueryKey({ asset, days }), enabled: !!asset, staleTime: 300000 } },
  );

  const series = data && data.points.length > 1 ? data.points : fallback;
  const stats = data?.stats ?? null;
  const hasData = series.length > 1;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {t("markets.funding.histTitle", lang)}
          {isFetching && <RefreshCw className="h-3 w-3 animate-spin text-primary/70" />}
        </div>
        <div className="flex items-center gap-1" dir="ltr">
          {HIST_RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => setDays(r.days)}
              className="rounded px-2 py-0.5 text-[10px] font-mono font-bold transition-colors"
              style={
                days === r.days
                  ? { background: "hsl(207 30% 70%)", color: "#0a0a0a" }
                  : { background: "hsl(0 0% 12%)", color: "hsl(0 0% 60%)" }
              }
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-4 gap-1.5 text-center" dir="ltr">
          <HistStat label={t("markets.funding.statAvg", lang)} value={fmtPct(stats.avgAnnualizedPercent)} color={stats.avgAnnualizedPercent >= 0 ? "#22c55e" : "#ef4444"} />
          <HistStat label={t("markets.funding.statMin", lang)} value={fmtPct(stats.minAnnualizedPercent)} color="#ef4444" />
          <HistStat label={t("markets.funding.statMax", lang)} value={fmtPct(stats.maxAnnualizedPercent)} color="#22c55e" />
          <HistStat label={t("markets.funding.statPositive", lang)} value={`${Math.round(stats.positiveRatio * 100)}%`} color="hsl(207 30% 78%)" />
        </div>
      )}

      <div className="h-52 rounded-lg border border-border/50 overflow-hidden">
        {isLoading && !hasData ? (
          <div className="flex h-full items-center justify-center text-[10px] font-mono text-muted-foreground">{t("markets.funding.histLoading", lang)}</div>
        ) : hasData ? (
          <FundingChart series={series} metric="annualized" avgValue={stats?.avgAnnualizedPercent ?? null} />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] font-mono text-muted-foreground">{t("markets.funding.histEmpty", lang)}</div>
        )}
      </div>

      {stats && stats.count > 0 && (
        <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground" dir="ltr">
          <span>{stats.count} pts · {t("markets.funding.statSpan", lang)} {stats.spanDays}d</span>
          <span>HYPERLIQUID · 1h</span>
        </div>
      )}

      <p className="text-[9px] text-muted-foreground/70 leading-snug">{t("markets.funding.histVenueNote", lang)}</p>
    </div>
  );
}

function HistStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded bg-secondary/40 py-1.5">
      <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">{label}</div>
      <div className="font-mono text-[11px] font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

function CheckResult({ chk, lang }: { chk: FundingAssetCheck; lang: Lang }) {
  const sm = sideMeta(chk.side, lang);
  const vc = viabilityColor(chk.viability);
  const hasCarry = chk.annualizedPercent > 0;
  const lp = useLivePrice(chk.asset);
  const displaySpot = lp?.price ?? chk.spotPrice;
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3" style={{ borderColor: `${vc}33` }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <CryptoIcon asset={chk.asset} size={24} />
          <span className="font-mono font-black text-base text-foreground">{chk.asset}</span>
          <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
            {lp && <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" title={t("markets.funding.live", lang)} />}
            ${fmtPrice(displaySpot)}
          </span>
        </div>
        <div className="flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold text-[10px]" style={{ background: `${vc}1a`, color: vc }}>
          {chk.viability}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded bg-secondary/40 py-2">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">{t("markets.funding.annualized", lang)}</div>
          <div className="font-mono text-sm font-bold" style={{ color: vc }}>{fmtPct(chk.annualizedPercent)}</div>
        </div>
        <div className="rounded bg-secondary/40 py-2">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">{t("markets.funding.side", lang)}</div>
          <div className="font-mono text-[11px] font-bold" style={{ color: sm.color }}>{sm.label}</div>
        </div>
        <div className="rounded bg-secondary/40 py-2">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">{t("markets.funding.bestVenue", lang)}</div>
          <div className="font-mono text-[11px] font-bold text-foreground">{chk.bestVenue}</div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground leading-snug">{lang === "he" ? chk.analysisHe : chk.analysisEn}</p>

      <FundingHistorySection asset={chk.asset} fallback={chk.history} lang={lang} />

      {hasCarry ? (
        <PaperEntry asset={chk.asset} spotPrice={chk.spotPrice} side={chk.side} annualizedPercent={chk.annualizedPercent} lang={lang} />
      ) : (
        <p className="text-[10px] font-mono text-amber-400/80 text-center py-1">{t("markets.funding.noPositive", lang)}</p>
      )}
    </div>
  );
}

/** Stocks have no funding rate, so they only stand in as the base/price leg. */
function StockLegPanel({ stock, lang }: { stock: StockQuote; lang: Lang }) {
  const up = stock.changePercent >= 0;
  const gold = "hsl(207 30% 70%)";
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3" style={{ borderColor: `${gold.replace(")", " / 0.2)")}` }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="h-5 w-5 text-primary flex-shrink-0" />
          <div className="min-w-0">
            <div className="font-mono font-black text-base text-foreground leading-none">{stock.symbol}</div>
            <div className="text-[10px] text-muted-foreground truncate">{stock.name}</div>
          </div>
        </div>
        <span className="flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold text-[10px] flex-shrink-0" style={{ background: "hsl(207 30% 70% / 0.12)", color: gold }}>
          <Building2 className="h-3 w-3" /> {t("markets.funding.kindStock", lang)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded bg-secondary/40 py-2">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">{t("markets.funding.price", lang)}</div>
          <div className="font-mono text-sm font-bold text-foreground">${fmtPrice(stock.price)}</div>
        </div>
        <div className="rounded bg-secondary/40 py-2">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">{t("markets.funding.change", lang)}</div>
          <div className="font-mono text-sm font-bold" style={{ color: up ? "#22c55e" : "#ef4444" }}>{fmtPct(stock.changePercent)}</div>
        </div>
        <div className="rounded bg-secondary/40 py-2">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">{t("markets.funding.momentum", lang)}</div>
          <div className="font-mono text-sm font-bold text-foreground">{stock.momentum5dPercent == null ? "—" : fmtPct(stock.momentum5dPercent)}</div>
        </div>
      </div>

      {stock.dayLow != null && stock.dayHigh != null && (
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
          <span>{t("markets.funding.dayRange", lang)}</span>
          <span className="text-foreground">${fmtPrice(stock.dayLow)} – ${fmtPrice(stock.dayHigh)}</span>
        </div>
      )}

      <p className="text-[10px] text-amber-400/90 leading-snug border-t border-border/50 pt-2 flex gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-px" />
        <span>{t("markets.funding.stockNote", lang)}</span>
      </p>
    </div>
  );
}

export default function FundingArbPage() {
  const { lang } = useLanguage();
  const [query, setQuery] = useState("");
  const [checkAsset, setCheckAsset] = useState<string | null>(null);
  const [checkStock, setCheckStock] = useState<StockQuote | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);

  const { data, isLoading, isFetching } = useGetFundingOpportunities({
    query: {
      queryKey: getGetFundingOpportunitiesQueryKey(),
      refetchInterval: 120000,
      staleTime: 90000,
    },
  });

  const { data: stocksData } = useGetStocks({
    query: { queryKey: getGetStocksQueryKey(), refetchInterval: 30000, staleTime: 20000 },
  });
  const stocks = useMemo(() => (stocksData ?? []) as StockQuote[], [stocksData]);

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

  // Unified typeahead drawn from the existing data pool: crypto funding
  // opportunities + tracked stocks. Stocks have no funding leg, so picking one
  // shows its price as the base leg with a clear note.
  const suggestions = useMemo<Suggestion[]>(() => {
    const q = normalize(query);
    const out: Suggestion[] = [];
    const seen = new Set<string>();
    for (const o of opportunities) {
      const sym = o.asset.toUpperCase();
      if (seen.has(sym)) continue;
      if (q && !sym.includes(q)) continue;
      seen.add(sym);
      out.push({ kind: "crypto", symbol: o.asset, sub: `${o.annualizedPercent >= 0 ? "+" : ""}${o.annualizedPercent.toFixed(1)}% APR` });
    }
    for (const s of stocks) {
      const sym = s.symbol.toUpperCase();
      if (seen.has(sym)) continue;
      if (q && !sym.includes(q) && !s.name.toUpperCase().includes(q)) continue;
      seen.add(sym);
      out.push({ kind: "stock", symbol: s.symbol, sub: s.name });
    }
    return out.slice(0, 8);
  }, [query, opportunities, stocks]);

  function findStock(sym: string): StockQuote | undefined {
    return stocks.find((s) => s.symbol.toUpperCase() === sym.toUpperCase());
  }

  function runCheck() {
    const a = normalize(query);
    if (!a) return;
    setShowSuggest(false);
    const stock = findStock(a);
    if (stock) {
      setCheckAsset(null);
      setCheckStock(stock);
    } else {
      setCheckStock(null);
      setCheckAsset(a);
    }
  }

  function selectSuggestion(s: Suggestion) {
    setQuery(s.symbol);
    setShowSuggest(false);
    if (s.kind === "stock") {
      setCheckAsset(null);
      setCheckStock(findStock(s.symbol) ?? null);
    } else {
      setCheckStock(null);
      setCheckAsset(normalize(s.symbol));
    }
  }

  return (
    <div className="p-5 space-y-4" dir={dir}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-black tracking-tight">{t("markets.funding.title", lang)}</h1>
            {isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">{t("markets.funding.subtitle", lang)}</p>
        </div>
      </div>

      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
        <p className="text-[10px] font-mono text-amber-400/90 leading-snug">{t("markets.funding.riskNote", lang)}</p>
      </div>

      {/* Instant asset check */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-black tracking-tight">{t("markets.funding.checkTitle", lang)}</h2>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowSuggest(true); }}
              onFocus={() => setShowSuggest(true)}
              onBlur={() => setTimeout(() => setShowSuggest(false), 120)}
              onKeyDown={(e) => e.key === "Enter" && runCheck()}
              placeholder={t("markets.funding.checkPlaceholder", lang)}
              className="h-9 font-mono text-sm w-full"
            />
            {showSuggest && suggestions.length > 0 && (
              <div
                className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border bg-card shadow-lg"
                dir="ltr"
              >
                {suggestions.map((s) => (
                  <button
                    key={`${s.kind}-${s.symbol}`}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectSuggestion(s)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-secondary/60 transition-colors"
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="flex-shrink-0 rounded px-1 py-px text-[9px] font-mono font-bold uppercase"
                        style={
                          s.kind === "crypto"
                            ? { background: "hsl(207 30% 70% / 0.15)", color: "hsl(207 30% 70%)" }
                            : { background: "hsl(217 91% 60% / 0.15)", color: "hsl(217 91% 70%)" }
                        }
                      >
                        {s.kind === "crypto" ? t("markets.funding.kindCrypto", lang) : t("markets.funding.kindStock", lang)}
                      </span>
                      <span className="font-mono font-bold">{s.symbol}</span>
                    </span>
                    <span className="font-mono text-xs text-muted-foreground truncate text-right">{s.sub}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button onClick={runCheck} className="h-9 font-mono font-bold flex-shrink-0" style={{ background: "hsl(207 30% 70%)", color: "#0a0a0a" }}>
            {t("markets.funding.check", lang)}
          </Button>
        </div>

        {checkStock && <StockLegPanel stock={checkStock} lang={lang} />}

        {checkAsset && (checkQ.isLoading || backtestQ.isLoading) && (
          <div className="space-y-3">
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-28 w-full rounded-lg" />
          </div>
        )}

        {checkAsset && !checkQ.isLoading && checkQ.data && !checkQ.data.found && (
          <p className="text-sm text-muted-foreground py-6 text-center">{t("markets.funding.notFound", lang)}</p>
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
        <h2 className="text-sm font-black tracking-tight">{t("markets.funding.opportunities", lang)}</h2>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-lg" />
          ))}
        </div>
      ) : opportunities.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">{t("markets.funding.empty", lang)}</p>
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
