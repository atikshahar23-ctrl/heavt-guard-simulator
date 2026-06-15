import { useMemo, useState } from "react";
import {
  useGetInfluencerSignals, getGetInfluencerSignalsQueryKey, InfluencerSignal,
  useGetStocks, getGetStocksQueryKey, StockQuote,
} from "@workspace/api-client-react";
import { usePortfolio } from "@/contexts/portfolio-context";
import { useAutoTrader } from "@/contexts/autotrader-context";
import { useRefresh } from "@/contexts/refresh-context";
import { useLanguage } from "@/contexts/language-context";
import { t } from "@/lib/i18n";
import { recommendLevels } from "@/lib/recommend-levels";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { PageIntro } from "@/components/page-intro";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  TrendingUp, TrendingDown, RefreshCw, Newspaper, Megaphone, ExternalLink, Clock, Zap, Bot, Settings2,
} from "lucide-react";

/** Default paper stake when one-tapping a signal. */
const DEFAULT_STAKE = 200;

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function SignalCard({
  s,
  onTrade,
}: {
  s: InfluencerSignal;
  onTrade: (s: InfluencerSignal) => void;
}) {
  const long = s.direction === "LONG";
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono font-black text-lg text-foreground">{s.ticker}</span>
            <span
              className={`text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                long ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
              }`}
            >
              {long ? <TrendingUp className="inline h-3 w-3 mr-0.5" /> : <TrendingDown className="inline h-3 w-3 mr-0.5" />}
              {s.direction}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{s.name}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Conviction</div>
          <div className={`font-mono font-bold ${long ? "text-emerald-400" : "text-rose-400"}`}>
            {s.confidence.toFixed(0)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <Megaphone className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="font-semibold text-foreground">{s.influencer}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary/50 text-muted-foreground">
          {s.horizon === "SHORT" ? "Short-term" : "Long-term"}
        </span>
      </div>

      <a
        href={s.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-start gap-2 text-sm text-foreground/90 hover:text-primary transition-colors"
      >
        <Newspaper className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground group-hover:text-primary" />
        <span className="line-clamp-2">{s.headline}</span>
        <ExternalLink className="h-3 w-3 mt-1 shrink-0 opacity-0 group-hover:opacity-60" />
      </a>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="truncate">{s.source}</span>
        <span className="flex items-center gap-1 shrink-0">
          <Clock className="h-3 w-3" /> {timeAgo(s.publishedAt)}
        </span>
      </div>

      <button
        onClick={() => onTrade(s)}
        className={`mt-1 w-full rounded-lg py-2 text-sm font-bold uppercase tracking-wider transition-transform active:scale-[0.98] ${
          long
            ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
            : "bg-rose-500/15 text-rose-400 hover:bg-rose-500/25"
        }`}
      >
        Paper {long ? "Buy" : "Short"} {s.ticker}
      </button>
    </div>
  );
}

/* ─── Smart-Money auto-trader controls ──────────────────────── */

function SmartMoneyBot() {
  const { settings, update } = useAutoTrader();
  const { stockPositions } = usePortfolio();
  const [open, setOpen] = useState(false);
  const armed = settings.stocksEnabled;
  const autoOpen = stockPositions.filter((p) => p.auto).length;

  return (
    <div
      className="rounded-lg border bg-card p-4 space-y-3 transition-colors mb-5"
      style={{ borderColor: armed ? "hsl(207 30% 70% / 0.5)" : undefined }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: armed ? "hsl(207 30% 70% / 0.15)" : "hsl(0 0% 100% / 0.05)" }}
          >
            <Bot className="h-5 w-5" style={{ color: armed ? "hsl(207 30% 70%)" : "#71717a" }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black tracking-tight">Smart-Money Bot</h2>
              <span
                className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  background: armed ? "hsl(207 30% 70% / 0.15)" : "hsl(0 0% 100% / 0.06)",
                  color: armed ? "hsl(207 30% 70%)" : "#71717a",
                }}
              >
                {armed ? "ARMED" : "OFF"}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-snug">
              {armed
                ? `Auto-opens LONG/SHORT stocks from influencer + technical agreement · ${autoOpen}/${settings.stockMaxOpen} open`
                : "Let the system trade stocks from influencer sentiment + technicals (paper)."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Smart-Money settings"
          >
            <Settings2 className="h-4 w-4" />
          </button>
          <Switch checked={settings.stocksEnabled} onCheckedChange={(v) => update({ stocksEnabled: v })} />
        </div>
      </div>

      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 pt-3 border-t border-border/50">
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Stake / trade (USD)</label>
            <Input
              type="number"
              value={settings.stockStakePerTrade}
              min={1}
              onChange={(e) => update({ stockStakePerTrade: Math.max(0, Number(e.target.value)) })}
              className="h-8 font-mono text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Max open positions</label>
            <Input
              type="number"
              value={settings.stockMaxOpen}
              min={1}
              max={50}
              onChange={(e) => update({ stockMaxOpen: Math.max(1, Math.min(50, Number(e.target.value))) })}
              className="h-8 font-mono text-sm"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Min conviction</label>
              <span className="font-mono text-xs font-bold text-primary">{settings.stockMinConfidence}</span>
            </div>
            <Slider
              value={[settings.stockMinConfidence]}
              min={20}
              max={100}
              step={5}
              onValueChange={(v) => update({ stockMinConfidence: v[0] })}
            />
          </div>

          <div className="flex items-center justify-between rounded bg-secondary/30 px-2.5 py-2">
            <span className="text-[11px] font-mono text-foreground">Longs</span>
            <Switch checked={settings.allowLong} onCheckedChange={(v) => update({ allowLong: v })} />
          </div>
          <div className="flex items-center justify-between rounded bg-secondary/30 px-2.5 py-2">
            <span className="text-[11px] font-mono text-foreground">Shorts</span>
            <Switch checked={settings.allowShort} onCheckedChange={(v) => update({ allowShort: v })} />
          </div>

          <p className="sm:col-span-2 text-[9px] font-mono text-amber-400/80 leading-snug">
            ⚠ Demo-only. Fuses free Google-News influencer sentiment with technical recommendations; opens the
            agreeing side with a 2:1 stop/target. 10-min cooldown per ticker. Not financial advice.
          </p>
        </div>
      )}
    </div>
  );
}

export default function SmartMoney() {
  const { lang } = useLanguage();
  const { intervalFor } = useRefresh();
  const { openStockPosition } = usePortfolio();
  const [stake, setStake] = useState<string>(String(DEFAULT_STAKE));

  const { data, isLoading, isFetching, refetch } = useGetInfluencerSignals({
    query: {
      queryKey: getGetInfluencerSignalsQueryKey(),
      refetchInterval: intervalFor(120000, 120000),
      staleTime: 90000,
    },
  });

  const { data: stocks } = useGetStocks({
    query: {
      queryKey: getGetStocksQueryKey(),
      refetchInterval: intervalFor(30000, 30000),
      staleTime: 20000,
    },
  });

  const priceByTicker = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of (stocks ?? []) as StockQuote[]) m.set(s.symbol.toUpperCase(), s.price);
    return m;
  }, [stocks]);

  const signals = useMemo(
    () => [...((data ?? []) as InfluencerSignal[])].sort((a, b) => b.confidence - a.confidence),
    [data],
  );

  const longs = signals.filter((s) => s.direction === "LONG").length;
  const shorts = signals.filter((s) => s.direction === "SHORT").length;

  function trade(s: InfluencerSignal) {
    const amt = parseFloat(stake);
    if (isNaN(amt) || amt <= 0) {
      toast({ variant: "destructive", title: "Invalid stake", description: "Enter a stake greater than 0." });
      return;
    }
    // Influencer signals carry no price — resolve a live quote from the stock feed.
    const price = priceByTicker.get(s.ticker.toUpperCase());
    if (!price || price <= 0) {
      toast({
        variant: "destructive",
        title: "No live price",
        description: `Open ${s.ticker} from the Stocks page to trade it with a live quote.`,
      });
      return;
    }
    const { sl, tp } = recommendLevels(price, s.direction, { slPct: 0.03, tpPct: 0.06 });
    const err = openStockPosition(
      {
        symbol: s.ticker,
        name: s.name,
        direction: s.direction,
        entryPrice: price,
        slPrice: sl,
        tpPrice: tp,
        source: `Smart-Money · ${s.influencer}`,
      },
      amt,
      1,
    );
    if (err) {
      toast({ variant: "destructive", title: "Trade rejected", description: err });
      return;
    }
    toast({
      title: `${s.direction === "LONG" ? "Bought" : "Shorted"} ${s.ticker}`,
      description: `$${amt} @ $${price} (paper trade)`,
    });
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            Smart Money
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Where mega-influencers move markets — Trump, Musk, Powell &amp; more — read from free news sentiment,
            mapped to LONG / SHORT stock ideas.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="shrink-0 rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      <PageIntro title={t("smartMoney.intro.title", lang)} description={t("smartMoney.intro.desc", lang)} />

      <div className="flex items-center gap-3 mt-4 mb-5 flex-wrap">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Paper stake</span>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
            <Input
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              inputMode="decimal"
              className="h-8 w-28 pl-5 font-mono"
            />
          </div>
        </div>
        <span className="text-xs font-mono px-2 py-1 rounded bg-emerald-500/10 text-emerald-400">
          {longs} long
        </span>
        <span className="text-xs font-mono px-2 py-1 rounded bg-rose-500/10 text-rose-400">
          {shorts} short
        </span>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 mb-5 flex items-start gap-2">
        <Zap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Signals come from free Google News headlines and keyword sentiment — not financial advice. Arm the
          Smart-Money bot below to open these LONG/SHORT setups automatically (paper only).
        </p>
      </div>

      <SmartMoneyBot />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : signals.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Newspaper className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No influencer signals right now. Check back after the next news cycle.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {signals.map((s) => (
            <SignalCard key={`${s.influencer}-${s.ticker}-${s.url}`} s={s} onTrade={trade} />
          ))}
        </div>
      )}
    </div>
  );
}
