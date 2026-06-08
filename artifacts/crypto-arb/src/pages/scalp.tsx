import { useState } from "react";
import { useGetScalpSignals, getGetScalpSignalsQueryKey } from "@workspace/api-client-react";
import type { ScalpSignal } from "@workspace/api-client-react";
import {
  Zap, TrendingUp, TrendingDown, Minus, RefreshCw, Target, Shield, LogIn, Star,
  Wallet, Bot, Settings2, ShieldAlert,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CryptoIcon } from "@/components/crypto-icon";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useFavorites } from "@/contexts/favorites-context";
import { usePortfolio } from "@/contexts/portfolio-context";
import { useAutoTrader, type ScalpConfidence, type TradeStrategy } from "@/contexts/autotrader-context";
import { toast } from "@/hooks/use-toast";

function fmtPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(2);
  if (p >= 0.01) return p.toFixed(4);
  return p.toPrecision(3);
}

type DirFilter = "ALL" | "LONG" | "SHORT";

function dirMeta(direction: ScalpSignal["direction"]) {
  if (direction === "LONG") return { Icon: TrendingUp, color: "#22c55e", label: "LONG" };
  if (direction === "SHORT") return { Icon: TrendingDown, color: "#ef4444", label: "SHORT" };
  return { Icon: Minus, color: "#71717a", label: "NEUTRAL" };
}

function confColor(c: ScalpSignal["confidence"]): string {
  if (c === "HIGH") return "hsl(207 30% 70%)";
  if (c === "MEDIUM") return "#84cc16";
  return "#71717a";
}

function QuickInvest({ s }: { s: ScalpSignal }) {
  const { cash, openBinancePosition } = usePortfolio();
  const [open, setOpen] = useState(false);
  const [margin, setMargin] = useState(100);
  const [leverage, setLeverage] = useState(5);
  const dir = s.direction as "LONG" | "SHORT";
  const notional = margin * leverage;
  const liqMove = (100 / leverage).toFixed(1);

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
      asset: s.asset,
      direction: dir,
      notional,
      entryPrice: s.entry,
      leverage,
      slPrice: s.stopLoss,
      tpPrice: s.takeProfit,
      source: "Scalp signal",
    });
    if (err) {
      toast({ title: "Trade failed", description: err, variant: "destructive" });
      return;
    }
    toast({ title: `${dir} ${s.asset} opened`, description: `${leverage}x · $${margin} margin · $${notional.toLocaleString()} notional @ $${fmtPrice(s.entry)}` });
    setOpen(false);
  }

  const accent = dir === "LONG" ? "#22c55e" : "#ef4444";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="w-full mt-1 flex items-center justify-center gap-1.5 rounded py-1.5 text-xs font-mono font-bold tracking-wide transition-colors"
          style={{ background: `${accent}1a`, color: accent, boxShadow: `inset 0 0 0 1px ${accent}40` }}
        >
          <Wallet className="h-3 w-3" /> Demo Trade {dir}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="end">
        <div className="flex items-center justify-between">
          <span className="font-mono font-bold text-sm" style={{ color: accent }}>{dir} {s.asset}</span>
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
          <div className="flex justify-between"><span className="text-muted-foreground">Entry</span><span className="text-foreground">${fmtPrice(s.entry)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Stop / Target</span><span><span className="text-red-400">${fmtPrice(s.stopLoss)}</span> / <span className="text-emerald-400">${fmtPrice(s.takeProfit)}</span></span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Liq. ≈ move</span><span className="text-amber-400">{liqMove}%</span></div>
        </div>

        <Button onClick={submit} className="w-full h-8 font-mono font-bold" style={{ background: accent, color: "#0a0a0a" }}>
          Open {dir} · ${margin}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function SignalCard({ s }: { s: ScalpSignal }) {
  const { Icon, color, label } = dirMeta(s.direction);
  const { isFavorite, toggleFavorite } = useFavorites();
  const favId = `coin:${s.asset}`;
  const fav = isFavorite(favId);

  return (
    <div
      className="rounded-lg border bg-card p-4 flex flex-col gap-3 transition-colors"
      style={{ borderColor: s.direction === "NEUTRAL" ? undefined : `${color}40` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => toggleFavorite({ id: favId, kind: "coin", symbol: s.asset, label: s.asset })}
            className="flex-shrink-0"
            aria-label="Toggle favorite"
          >
            <Star
              className="h-3.5 w-3.5 transition-colors"
              style={{ color: fav ? "hsl(207 30% 70%)" : "#52525b", fill: fav ? "hsl(207 30% 70%)" : "transparent" }}
            />
          </button>
          <CryptoIcon asset={s.asset} size={24} />
          <span className="font-mono font-black text-base text-foreground">{s.asset}</span>
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

      {/* Price + change */}
      <div className="flex items-end justify-between">
        <span className="font-mono text-lg font-bold text-foreground">${fmtPrice(s.price)}</span>
        <span className={`font-mono text-xs font-bold ${s.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {s.changePercent >= 0 ? "+" : ""}{s.changePercent.toFixed(2)}%
        </span>
      </div>

      {/* Entry / SL / TP */}
      {s.direction !== "NEUTRAL" && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded bg-secondary/40 py-1.5">
            <div className="flex items-center justify-center gap-1 text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">
              <LogIn className="h-2.5 w-2.5" /> Entry
            </div>
            <div className="font-mono text-xs font-bold text-foreground">${fmtPrice(s.entry)}</div>
          </div>
          <div className="rounded bg-red-500/10 py-1.5">
            <div className="flex items-center justify-center gap-1 text-[9px] font-mono text-red-400/80 uppercase tracking-wider mb-0.5">
              <Shield className="h-2.5 w-2.5" /> Stop
            </div>
            <div className="font-mono text-xs font-bold text-red-400">${fmtPrice(s.stopLoss)}</div>
          </div>
          <div className="rounded bg-emerald-500/10 py-1.5">
            <div className="flex items-center justify-center gap-1 text-[9px] font-mono text-emerald-400/80 uppercase tracking-wider mb-0.5">
              <Target className="h-2.5 w-2.5" /> Target
            </div>
            <div className="font-mono text-xs font-bold text-emerald-400">${fmtPrice(s.takeProfit)}</div>
          </div>
        </div>
      )}

      {/* Metrics row */}
      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground border-t border-border/50 pt-2">
        <span>RSI <span className="text-foreground/90 font-bold">{s.rsi}</span></span>
        <span>R:R <span className="text-foreground/90 font-bold">{s.riskReward > 0 ? s.riskReward.toFixed(2) : "—"}</span></span>
        <span className="flex items-center gap-1">
          <span style={{ color: confColor(s.confidence) }} className="font-bold">{s.confidence}</span>
          <span className="text-foreground/60">· {s.score}</span>
        </span>
      </div>

      {/* Reasons */}
      <ul className="space-y-0.5">
        {s.reasons.map((r, i) => (
          <li key={i} className="text-[10px] text-muted-foreground flex items-start gap-1.5">
            <span className="text-primary mt-0.5">›</span>
            <span className="leading-snug">{r}</span>
          </li>
        ))}
      </ul>

      {/* Quick invest */}
      {s.direction !== "NEUTRAL" && <QuickInvest s={s} />}
    </div>
  );
}

function AutoTraderPanel() {
  const { settings, update, toggleEnabled } = useAutoTrader();
  const { binancePositions } = usePortfolio();
  const [open, setOpen] = useState(false);
  const autoOpen = binancePositions.filter((p) => p.auto).length;
  const confs: ScalpConfidence[] = ["LOW", "MEDIUM", "HIGH"];
  const strategies: { key: TradeStrategy; label: string }[] = [
    { key: "SCALP", label: "Scalp" },
    { key: "MOMENTUM", label: "Momentum" },
    { key: "BOTH", label: "Both" },
  ];

  return (
    <div
      className="rounded-lg border bg-card p-4 space-y-3 transition-colors"
      style={{ borderColor: settings.enabled ? "hsl(207 30% 70% / 0.5)" : undefined }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: settings.enabled ? "hsl(207 30% 70% / 0.15)" : "hsl(0 0% 100% / 0.05)" }}
          >
            <Bot className="h-5 w-5" style={{ color: settings.enabled ? "hsl(207 30% 70%)" : "#71717a" }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black tracking-tight">Auto-Trader</h2>
              <span
                className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  background: settings.enabled ? "hsl(207 30% 70% / 0.15)" : "hsl(0 0% 100% / 0.06)",
                  color: settings.enabled ? "hsl(207 30% 70%)" : "#71717a",
                }}
              >
                {settings.enabled ? "ARMED" : "OFF"}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-snug">
              {settings.enabled
                ? `Auto-opens demo trades from signals · ${autoOpen}/${settings.maxOpenPositions} open`
                : "Let the system open demo trades for you from live scalp signals."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Auto-Trader settings"
          >
            <Settings2 className="h-4 w-4" />
          </button>
          <Switch checked={settings.enabled} onCheckedChange={toggleEnabled} />
        </div>
      </div>

      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 pt-3 border-t border-border/50">
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Margin / trade (USD)</label>
            <Input
              type="number"
              value={settings.marginPerTrade}
              min={1}
              onChange={(e) => update({ marginPerTrade: Math.max(0, Number(e.target.value)) })}
              className="h-8 font-mono text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Max open positions</label>
            <Input
              type="number"
              value={settings.maxOpenPositions}
              min={1}
              max={50}
              onChange={(e) => update({ maxOpenPositions: Math.max(1, Math.min(50, Number(e.target.value))) })}
              className="h-8 font-mono text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Leverage</label>
              <span className="font-mono text-xs font-bold text-primary">{settings.leverage}x</span>
            </div>
            <Slider value={[settings.leverage]} min={1} max={50} step={1} onValueChange={(v) => update({ leverage: v[0] })} />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Min confidence</label>
            <div className="flex gap-1">
              {confs.map((c) => (
                <button
                  key={c}
                  onClick={() => update({ minConfidence: c })}
                  className={`flex-1 rounded py-1.5 text-[10px] font-mono font-bold transition-colors ${
                    settings.minConfidence === c ? "text-primary" : "text-muted-foreground hover:text-foreground bg-secondary/40"
                  }`}
                  style={settings.minConfidence === c ? { background: "hsl(207 30% 70% / 0.15)", boxShadow: "inset 0 0 0 1px hsl(207 30% 70% / 0.3)" } : {}}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded bg-secondary/30 px-2.5 py-2">
            <span className="text-[11px] font-mono text-foreground">Longs</span>
            <Switch checked={settings.allowLong} onCheckedChange={(v) => update({ allowLong: v })} />
          </div>
          <div className="flex items-center justify-between rounded bg-secondary/30 px-2.5 py-2">
            <span className="text-[11px] font-mono text-foreground">Shorts</span>
            <Switch checked={settings.allowShort} onCheckedChange={(v) => update({ allowShort: v })} />
          </div>
          <div className="flex items-center justify-between rounded bg-secondary/30 px-2.5 py-2 sm:col-span-2">
            <span className="text-[11px] font-mono text-foreground">Favorites only</span>
            <Switch checked={settings.favoritesOnly} onCheckedChange={(v) => update({ favoritesOnly: v })} />
          </div>

          {/* ── Warrior controls ── */}
          <div className="sm:col-span-2 pt-2 border-t border-border/50">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-primary">Warrior Mode</span>
              <span className="text-[9px] font-mono text-muted-foreground">— sources, trailing &amp; risk caps</span>
            </div>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Signal source</label>
            <div className="flex gap-1">
              {strategies.map((st) => (
                <button
                  key={st.key}
                  onClick={() => update({ strategy: st.key })}
                  className={`flex-1 rounded py-1.5 text-[10px] font-mono font-bold transition-colors ${
                    settings.strategy === st.key ? "text-primary" : "text-muted-foreground hover:text-foreground bg-secondary/40"
                  }`}
                  style={settings.strategy === st.key ? { background: "hsl(207 30% 70% / 0.15)", boxShadow: "inset 0 0 0 1px hsl(207 30% 70% / 0.3)" } : {}}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {(settings.strategy === "MOMENTUM" || settings.strategy === "BOTH") && (
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Min momentum score</label>
                <span className="font-mono text-xs font-bold text-primary">{settings.minMomentumScore}</span>
              </div>
              <Slider value={[settings.minMomentumScore]} min={30} max={90} step={5} onValueChange={(v) => update({ minMomentumScore: v[0] })} />
            </div>
          )}

          <div className="flex items-center justify-between rounded bg-secondary/30 px-2.5 py-2 sm:col-span-2">
            <span className="text-[11px] font-mono text-foreground">Trailing stop (ride winners)</span>
            <Switch checked={settings.trailingEnabled} onCheckedChange={(v) => update({ trailingEnabled: v })} />
          </div>

          {settings.trailingEnabled && (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Trail activate</label>
                  <span className="font-mono text-xs font-bold text-primary">{settings.trailActivatePct}%</span>
                </div>
                <Slider value={[settings.trailActivatePct]} min={0.5} max={5} step={0.5} onValueChange={(v) => update({ trailActivatePct: v[0] })} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Trail distance</label>
                  <span className="font-mono text-xs font-bold text-primary">{settings.trailDistancePct}%</span>
                </div>
                <Slider value={[settings.trailDistancePct]} min={0.5} max={5} step={0.5} onValueChange={(v) => update({ trailDistancePct: v[0] })} />
              </div>
            </>
          )}

          <div className="flex items-center justify-between rounded bg-secondary/30 px-2.5 py-2 sm:col-span-2">
            <span className="text-[11px] font-mono text-foreground">Daily loss circuit-breaker</span>
            <Switch checked={settings.dailyStopEnabled} onCheckedChange={(v) => update({ dailyStopEnabled: v })} />
          </div>

          {settings.dailyStopEnabled && (
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Daily max loss</label>
                <span className="font-mono text-xs font-bold text-red-400">{settings.dailyMaxLossPct}%</span>
              </div>
              <Slider value={[settings.dailyMaxLossPct]} min={1} max={50} step={1} onValueChange={(v) => update({ dailyMaxLossPct: v[0] })} />
            </div>
          )}

          {/* ── Risk Guardian — highest-level capital protection ── */}
          <div className="sm:col-span-2 mt-1 flex items-center gap-2">
            <ShieldAlert className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-primary">Risk Guardian</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="flex items-center justify-between rounded bg-secondary/30 px-2.5 py-2 sm:col-span-2">
            <span className="text-[11px] font-mono text-foreground">Pre-liquidation emergency exit</span>
            <Switch checked={settings.catastrophicExitEnabled} onCheckedChange={(v) => update({ catastrophicExitEnabled: v })} />
          </div>

          {settings.catastrophicExitEnabled && (
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Force-exit at loss of margin</label>
                <span className="font-mono text-xs font-bold text-red-400">{settings.maxLossPerTradePct}%</span>
              </div>
              <Slider value={[settings.maxLossPerTradePct]} min={30} max={95} step={5} onValueChange={(v) => update({ maxLossPerTradePct: v[0] })} />
            </div>
          )}

          <div className="flex items-center justify-between rounded bg-secondary/30 px-2.5 py-2 sm:col-span-2">
            <span className="text-[11px] font-mono text-foreground">Portfolio kill-switch (max drawdown)</span>
            <Switch checked={settings.portfolioStopEnabled} onCheckedChange={(v) => update({ portfolioStopEnabled: v })} />
          </div>

          {settings.portfolioStopEnabled && (
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Flatten everything at drawdown</label>
                <span className="font-mono text-xs font-bold text-red-400">{settings.portfolioMaxDrawdownPct}%</span>
              </div>
              <Slider value={[settings.portfolioMaxDrawdownPct]} min={5} max={60} step={5} onValueChange={(v) => update({ portfolioMaxDrawdownPct: v[0] })} />
            </div>
          )}

          <p className="sm:col-span-2 text-[9px] font-mono text-amber-400/80 leading-snug">
            ⚠ Demo-only automation. Opens paper positions with virtual funds; 10-min cooldown per asset, exits on signal SL/TP or trailing stop. The Risk Guardian force-closes losers before liquidation and flattens the book on a catastrophic drawdown.
          </p>
        </div>
      )}
    </div>
  );
}

export default function ScalpPage() {
  const [filter, setFilter] = useState<DirFilter>("ALL");
  const { data, isLoading, isFetching } = useGetScalpSignals({
    query: {
      queryKey: getGetScalpSignalsQueryKey(),
      refetchInterval: 60000,
      staleTime: 45000,
    },
  });

  const signals = data ?? [];
  const filtered = filter === "ALL" ? signals : signals.filter((s) => s.direction === filter);
  const longCount = signals.filter((s) => s.direction === "LONG").length;
  const shortCount = signals.filter((s) => s.direction === "SHORT").length;

  const tabs: { key: DirFilter; label: string }[] = [
    { key: "ALL", label: `All (${signals.length})` },
    { key: "LONG", label: `Long (${longCount})` },
    { key: "SHORT", label: `Short (${shortCount})` },
  ];

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-black tracking-tight">Scalp Signals</h1>
            {isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            15m fast-trade setups — RSI, EMA(9/21), ATR &amp; swing structure with entry, stop &amp; target.
          </p>
        </div>
      </div>

      {/* Risk note */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
        <p className="text-[10px] font-mono text-amber-400/90 leading-snug">
          ⚠ Educational signals from technical indicators — not financial advice. Always confirm with your own analysis and size positions responsibly.
        </p>
      </div>

      {/* Auto-Trader */}
      <AutoTraderPanel />

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5">
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
            <Skeleton key={i} className="h-56 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">No signals match this filter right now.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((s) => (
            <SignalCard key={s.symbol} s={s} />
          ))}
        </div>
      )}
    </div>
  );
}
