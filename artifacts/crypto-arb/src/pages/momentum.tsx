import { useState } from "react";
import { useGetMomentumCoins, getGetMomentumCoinsQueryKey } from "@workspace/api-client-react";
import type { MomentumCoin } from "@workspace/api-client-react";
import {
  Rocket, Flame, TrendingUp, Activity, RefreshCw, Target, Shield, LogIn,
  Star, Wallet, BarChart3, Zap, MessageCircle, ChevronDown,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CryptoIcon } from "@/components/crypto-icon";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useFavorites } from "@/contexts/favorites-context";
import { usePortfolio } from "@/contexts/portfolio-context";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";
import { t, type Lang } from "@/lib/i18n";

function fmtPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(2);
  if (p >= 0.01) return p.toFixed(4);
  return p.toPrecision(3);
}

type StageFilter = "ALL" | "HOT" | "SURGING" | "BUILDING";

interface StageMeta {
  Icon: typeof Flame;
  color: string;
  label: string;
}

/** Rule-based JARVIS momentum explanation — pure, no AI, no network. */
function explainMomentumCoin(c: MomentumCoin, lang: Lang): string[] {
  const lines: string[] = [];
  const stageKey = `momentum.stage.${c.stage}`;
  const stageLine = t(stageKey, lang);
  lines.push(stageLine === stageKey ? c.stage : stageLine);

  if (c.score >= 80) lines.push(t("momentum.score.veryStrong", lang).replace("{n}", String(c.score)));
  else if (c.score >= 60) lines.push(t("momentum.score.high", lang).replace("{n}", String(c.score)));
  else lines.push(t("momentum.score.medium", lang).replace("{n}", String(c.score)));

  if (c.rvol >= 3) lines.push(t("momentum.rvol.high", lang).replace("{n}", c.rvol.toFixed(1)));
  else if (c.rvol >= 1.5) lines.push(t("momentum.rvol.elevated", lang).replace("{n}", c.rvol.toFixed(1)));
  else lines.push(t("momentum.rvol.average", lang).replace("{n}", c.rvol.toFixed(1)));

  if (c.roc15m > 0.5) lines.push(t("momentum.roc15m.up", lang).replace("{n}", c.roc15m.toFixed(2)));
  else if (c.roc15m < -0.5) lines.push(t("momentum.roc15m.down", lang).replace("{n}", c.roc15m.toFixed(2)));

  if (c.roc1h > 1) lines.push(t("momentum.roc1h.up", lang).replace("{n}", c.roc1h.toFixed(2)));
  else if (c.roc1h < -1) lines.push(t("momentum.roc1h.down", lang).replace("{n}", c.roc1h.toFixed(2)));

  for (const r of c.reasons) lines.push(`• ${r}`);
  return lines;
}

function stageMeta(stage: MomentumCoin["stage"]): StageMeta {
  switch (stage) {
    case "HOT": return { Icon: Flame, color: "#ef4444", label: "HOT" };
    case "SURGING": return { Icon: Rocket, color: "hsl(207 30% 70%)", label: "SURGING" };
    case "BUILDING": return { Icon: Activity, color: "#84cc16", label: "BUILDING" };
    default: return { Icon: TrendingUp, color: "#71717a", label: "COOLING" };
  }
}

function QuickInvest({ c }: { c: MomentumCoin }) {
  const { cash, openBinancePosition } = usePortfolio();
  const [open, setOpen] = useState(false);
  const [margin, setMargin] = useState(100);
  const [leverage, setLeverage] = useState(5);
  const notional = margin * leverage;
  const liqMove = (100 / leverage).toFixed(1);
  const accent = "#22c55e";

  function submit() {
    if (!(margin > 0)) {
      toast({ title: "Invalid amount", description: "Enter a margin greater than 0.", variant: "destructive" });
      return;
    }
    if (margin > cash) {
      toast({ title: "Insufficient balance", description: `You only have $${cash.toLocaleString(undefined, { maximumFractionDigits: 0 })} available.`, variant: "destructive" });
      return;
    }
    const err = openBinancePosition({
      asset: c.asset,
      direction: "LONG",
      notional,
      entryPrice: c.entry,
      leverage,
      slPrice: c.stopLoss,
      tpPrice: c.takeProfit,
      source: "Momentum surge",
    });
    if (err) {
      toast({ title: "Trade failed", description: err, variant: "destructive" });
      return;
    }
    toast({ title: `LONG ${c.asset} opened`, description: `${leverage}x · $${margin} margin · $${notional.toLocaleString()} notional @ $${fmtPrice(c.entry)}` });
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="w-full mt-1 flex items-center justify-center gap-1.5 rounded py-1.5 text-xs font-mono font-bold tracking-wide transition-colors"
          style={{ background: `${accent}1a`, color: accent, boxShadow: `inset 0 0 0 1px ${accent}40` }}
        >
          <Wallet className="h-3 w-3" /> Ride LONG
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] max-w-72 space-y-3" align="end">
        <div className="flex items-center justify-between">
          <span className="font-mono font-bold text-sm" style={{ color: accent }}>LONG {c.asset}</span>
          <span className="text-[10px] font-mono text-muted-foreground">Bal ${cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Margin (USD)</label>
          <Input
            type="number"
            value={margin}
            min={1}
            onChange={(e) => setMargin(Math.max(0, Number(e.target.value)))}
            className="h-8 font-mono text-sm"
          />
          <div className="flex gap-1">
            {[50, 100, 250, 500].map((v) => (
              <button
                key={v}
                onClick={() => setMargin(v)}
                className="flex-1 rounded bg-secondary/50 py-1 text-[10px] font-mono hover:bg-secondary"
              >${v}</button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Leverage</label>
            <span className="font-mono text-xs font-bold text-primary">{leverage}x</span>
          </div>
          <Slider value={[leverage]} min={1} max={50} step={1} onValueChange={(v) => setLeverage(v[0])} />
        </div>

        <div className="rounded bg-secondary/40 p-2 space-y-1 text-[10px] font-mono">
          <div className="flex justify-between"><span className="text-muted-foreground">Notional</span><span className="text-foreground font-bold">${notional.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Entry</span><span className="text-foreground">${fmtPrice(c.entry)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Stop / Target</span><span><span className="text-red-400">${fmtPrice(c.stopLoss)}</span> / <span className="text-emerald-400">${fmtPrice(c.takeProfit)}</span></span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Liq. ≈ move</span><span className="text-amber-400">{liqMove}%</span></div>
        </div>

        <Button onClick={submit} className="w-full h-8 font-mono font-bold" style={{ background: accent, color: "#0a0a0a" }}>
          Open LONG · ${margin}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-secondary/60 overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.max(4, Math.min(100, score))}%`, background: color }}
      />
    </div>
  );
}

function MomentumCard({ c }: { c: MomentumCoin }) {
  const { Icon, color, label } = stageMeta(c.stage);
  const { isFavorite, toggleFavorite } = useFavorites();
  const { lang, dir } = useLanguage();
  const favId = `coin:${c.asset}`;
  const fav = isFavorite(favId);
  const [whyOpen, setWhyOpen] = useState(false);
  const explanation = whyOpen ? explainMomentumCoin(c, lang) : [];

  return (
    <div
      className="rounded-lg border bg-card p-4 flex flex-col gap-3 transition-colors"
      style={{ borderColor: `${color}40` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => toggleFavorite({ id: favId, kind: "coin", symbol: c.asset, label: c.asset })}
            className="flex-shrink-0"
            aria-label="Toggle favorite"
          >
            <Star
              className="h-3.5 w-3.5 transition-colors"
              style={{ color: fav ? "hsl(207 30% 70%)" : "#52525b", fill: fav ? "hsl(207 30% 70%)" : "transparent" }}
            />
          </button>
          <CryptoIcon asset={c.asset} size={24} />
          <span className="font-mono font-black text-base text-foreground">{c.asset}</span>
          <span className="text-[10px] font-mono text-muted-foreground">/USDT</span>
        </div>
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold text-xs"
          style={{ background: `${color}1a`, color }}
        >
          <Icon className="h-3 w-3" />
          {label}
        </div>
      </div>

      {/* Price + 24h change */}
      <div className="flex items-end justify-between">
        <span className="font-mono text-lg font-bold text-foreground">${fmtPrice(c.price)}</span>
        <span className={`font-mono text-xs font-bold ${c.change24h >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {c.change24h >= 0 ? "+" : ""}{c.change24h.toFixed(2)}% 24h
        </span>
      </div>

      {/* Surge score */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="text-muted-foreground uppercase tracking-wider">Surge score</span>
          <span className="font-bold" style={{ color }}>{c.score}</span>
        </div>
        <ScoreBar score={c.score} color={color} />
      </div>

      {/* Momentum metrics */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded bg-secondary/40 py-1.5">
          <div className="flex items-center justify-center gap-1 text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">
            <BarChart3 className="h-2.5 w-2.5" /> RVol
          </div>
          <div className="font-mono text-xs font-bold text-foreground">{c.rvol.toFixed(1)}×</div>
        </div>
        <div className="rounded bg-secondary/40 py-1.5">
          <div className="flex items-center justify-center gap-1 text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">
            <Zap className="h-2.5 w-2.5" /> 15m
          </div>
          <div className={`font-mono text-xs font-bold ${c.roc15m >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {c.roc15m >= 0 ? "+" : ""}{c.roc15m.toFixed(1)}%
          </div>
        </div>
        <div className="rounded bg-secondary/40 py-1.5">
          <div className="flex items-center justify-center gap-1 text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">
            <TrendingUp className="h-2.5 w-2.5" /> 1h
          </div>
          <div className={`font-mono text-xs font-bold ${c.roc1h >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {c.roc1h >= 0 ? "+" : ""}{c.roc1h.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Entry / SL / TP */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded bg-secondary/40 py-1.5">
          <div className="flex items-center justify-center gap-1 text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">
            <LogIn className="h-2.5 w-2.5" /> Entry
          </div>
          <div className="font-mono text-xs font-bold text-foreground">${fmtPrice(c.entry)}</div>
        </div>
        <div className="rounded bg-red-500/10 py-1.5">
          <div className="flex items-center justify-center gap-1 text-[9px] font-mono text-red-400/80 uppercase tracking-wider mb-0.5">
            <Shield className="h-2.5 w-2.5" /> Stop
          </div>
          <div className="font-mono text-xs font-bold text-red-400">${fmtPrice(c.stopLoss)}</div>
        </div>
        <div className="rounded bg-emerald-500/10 py-1.5">
          <div className="flex items-center justify-center gap-1 text-[9px] font-mono text-emerald-400/80 uppercase tracking-wider mb-0.5">
            <Target className="h-2.5 w-2.5" /> Target
          </div>
          <div className="font-mono text-xs font-bold text-emerald-400">${fmtPrice(c.takeProfit)}</div>
        </div>
      </div>

      {/* Reasons */}
      <ul className="space-y-0.5">
        {c.reasons.map((r, i) => (
          <li key={i} className="text-[10px] text-muted-foreground flex items-start gap-1.5">
            <span className="text-primary mt-0.5">›</span>
            <span className="leading-snug">{r}</span>
          </li>
        ))}
      </ul>

      {/* JARVIS "Why?" toggle */}
      <button
        onClick={() => setWhyOpen((v) => !v)}
        className="flex items-center gap-1.5 w-full justify-center py-1.5 rounded-md border border-dashed transition-colors text-[10px] font-mono"
        style={{
          borderColor: whyOpen ? "hsl(43 74% 52% / 0.6)" : "hsl(207 30% 70% / 0.25)",
          color: whyOpen ? "hsl(43 74% 62%)" : "hsl(207 30% 60%)",
          background: whyOpen ? "hsl(43 74% 52% / 0.08)" : "transparent",
        }}
        aria-label="Toggle JARVIS explanation"
      >
        <MessageCircle className="h-3 w-3" />
        {t("scalp.jarvisBtn", lang)}
        <ChevronDown className="h-3 w-3 transition-transform" style={{ transform: whyOpen ? "rotate(180deg)" : "none" }} />
      </button>

      {/* JARVIS explanation panel */}
      {whyOpen && (
        <div
          className="rounded-md p-3 space-y-1.5 border"
          dir={dir}
          style={{ background: "hsl(43 74% 52% / 0.07)", borderColor: "hsl(43 74% 52% / 0.3)" }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: "hsl(43 74% 62%)" }}>{t("scalp.jarvisTitle", lang)}</span>
            <span className="text-[8px] text-muted-foreground/60 font-mono">{t("scalp.jarvisDisclaimer", lang)}</span>
          </div>
          {explanation.map((line, i) => (
            <p key={i} className="text-[10px] leading-relaxed" style={{ color: i === 0 ? "hsl(43 74% 68%)" : "hsl(0 0% 75%)" }}>
              {line}
            </p>
          ))}
        </div>
      )}

      <QuickInvest c={c} />
    </div>
  );
}

export default function MomentumPage() {
  const [filter, setFilter] = useState<StageFilter>("ALL");
  const { data, isLoading, isFetching } = useGetMomentumCoins({
    query: {
      queryKey: getGetMomentumCoinsQueryKey(),
      refetchInterval: 60000,
      staleTime: 45000,
    },
  });

  const coins = data ?? [];
  const filtered = filter === "ALL" ? coins : coins.filter((c) => c.stage === filter);
  const hot = coins.filter((c) => c.stage === "HOT").length;
  const surging = coins.filter((c) => c.stage === "SURGING").length;
  const building = coins.filter((c) => c.stage === "BUILDING").length;

  const tabs: { key: StageFilter; label: string }[] = [
    { key: "ALL", label: `All (${coins.length})` },
    { key: "HOT", label: `Hot (${hot})` },
    { key: "SURGING", label: `Surging (${surging})` },
    { key: "BUILDING", label: `Building (${building})` },
  ];

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-black tracking-tight">Momentum Radar</h1>
            {isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Coins flying up now or coiling to surge — relative volume, rate-of-change &amp; breakout structure on the 5m.
          </p>
        </div>
      </div>

      {/* Risk note */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
        <p className="text-[10px] font-mono text-amber-400/90 leading-snug">
          ⚠ Momentum runners are high-volatility — meme-style moves reverse fast. Educational signals, not financial advice. Use tight risk.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-3 py-1.5 rounded text-xs font-mono font-bold tracking-wide transition-colors ${
              filter === t.key
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
            style={filter === t.key ? { boxShadow: "inset 0 0 0 1px hsl(207 30% 70% / 0.3)" } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">No coins in this stage right now — the market is quiet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger">
          {filtered.map((c) => (
            <MomentumCard key={c.symbol} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
