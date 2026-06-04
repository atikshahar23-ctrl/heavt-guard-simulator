import { useMemo } from "react";
import {
  Bot, Power, Gauge, Rocket, Megaphone, Timer, TrendingDown, TrendingUp,
  Layers, Brain, RotateCcw, Activity, ShieldCheck,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePortfolio } from "@/contexts/portfolio-context";
import {
  useAutoTrader, type AutoTraderSettings, type NewBotId,
} from "@/contexts/autotrader-context";

function StatChip({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-red-400" : "text-foreground";
  return (
    <div className="flex flex-col">
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono">{label}</span>
      <span className={`text-sm font-mono font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function NumField({
  label, value, min, max, step, onChange, suffix,
}: {
  label: string; value: number; min?: number; max?: number; step?: number;
  onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono">{label}</span>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          inputMode="decimal"
          value={value}
          min={min}
          max={max}
          step={step ?? 1}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(v);
          }}
          className="h-8 text-xs font-mono bg-secondary/40"
          aria-label={label}
        />
        {suffix && <span className="text-[10px] text-muted-foreground font-mono">{suffix}</span>}
      </div>
    </label>
  );
}

/** A bot tile with an arm switch, description, live open count and a body. */
function BotCard({
  icon: Icon, title, subtitle, hint, active, onToggle, open, children, accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; subtitle: string; hint: string;
  active: boolean; onToggle: (v: boolean) => void;
  open: number; children?: React.ReactNode; accent?: string;
}) {
  return (
    <div
      className="relative rounded-lg border border-border bg-secondary/20 p-4 transition-all"
      style={active ? { borderColor: accent ?? "hsl(43 74% 52% / 0.5)", boxShadow: `0 0 0 1px ${accent ?? "hsl(43 74% 52% / 0.25)"}` } : {}}
    >
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 h-9 w-9 shrink-0 rounded-md flex items-center justify-center"
          style={{ background: active ? (accent ?? "hsl(43 74% 52% / 0.15)") + "" : "hsl(0 0% 12%)" }}
        >
          <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold tracking-wide truncate">{title}</h3>
            <Switch checked={active} onCheckedChange={onToggle} aria-label={`Toggle ${title}`} />
          </div>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5" dir="rtl">{hint}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] font-mono text-muted-foreground">
          {open > 0 ? (
            <span className="text-primary">{open} פוזיציות פתוחות</span>
          ) : (
            <span>אין פוזיציות פתוחות</span>
          )}
        </span>
        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${active ? "bg-emerald-500/15 text-emerald-400" : "bg-muted/40 text-muted-foreground"}`}>
          {active ? "ON" : "OFF"}
        </span>
      </div>
      {children && <div className="mt-3 pt-3 border-t border-border/60">{children}</div>}
    </div>
  );
}

const NEW_BOT_META: {
  id: NewBotId; icon: React.ComponentType<{ className?: string }>; title: string; subtitle: string; hint: string;
  enabledKey: keyof AutoTraderSettings; stakeKey: keyof AutoTraderSettings; maxKey: keyof AutoTraderSettings;
  thrKey: keyof AutoTraderSettings; thrLabel: string; source: string; market: "crypto" | "stock";
}[] = [
  {
    id: "dipbuyer", icon: TrendingDown, title: "Dip Buyer", subtitle: "Contrarian crypto LONG",
    hint: "קונה את מטבעות הקריפטו עם הירידה הגדולה ביותר ב-24 שעות",
    enabledKey: "dipEnabled", stakeKey: "dipStake", maxKey: "dipMaxOpen", thrKey: "dipMinDropPct",
    thrLabel: "ירידה מינ' %", source: "Dip Buyer", market: "crypto",
  },
  {
    id: "breakout", icon: TrendingUp, title: "Breakout Hunter", subtitle: "Momentum continuation LONG",
    hint: "קונה את מטבעות הקריפטו עם העלייה החזקה ביותר ב-24 שעות",
    enabledKey: "breakoutEnabled", stakeKey: "breakoutStake", maxKey: "breakoutMaxOpen", thrKey: "breakoutMinGainPct",
    thrLabel: "עלייה מינ' %", source: "Breakout Hunter", market: "crypto",
  },
  {
    id: "dca", icon: Layers, title: "Blue-Chip DCA", subtitle: "Scheduled stock accumulation",
    hint: "צובר מניות גדולות במנות קבועות לאורך זמן",
    enabledKey: "dcaEnabled", stakeKey: "dcaStake", maxKey: "dcaMaxOpen", thrKey: "dcaIntervalMin",
    thrLabel: "מרווח (דק')", source: "Blue-Chip DCA", market: "stock",
  },
];

export default function Bots() {
  const { settings, update, getBotStat, resetBotStats } = useAutoTrader();
  const { binancePositions, stockPositions, polyPositions } = usePortfolio();

  // ── Existing core bots, derived from the original engine's settings ──
  const scalpOn = settings.enabled && (settings.strategy === "SCALP" || settings.strategy === "BOTH");
  const momOn = settings.enabled && (settings.strategy === "MOMENTUM" || settings.strategy === "BOTH");
  const applyCrypto = (scalp: boolean, mom: boolean) => {
    if (!scalp && !mom) { update({ enabled: false }); return; }
    update({ enabled: true, strategy: scalp && mom ? "BOTH" : scalp ? "SCALP" : "MOMENTUM" });
  };

  const counts = useMemo(() => {
    const bn = (m: string) => binancePositions.filter((p) => (p.source ?? "").includes(m)).length;
    const st = (m: string) => stockPositions.filter((p) => (p.source ?? "").includes(m)).length;
    return {
      scalp: bn("Scalp"), momentum: bn("Momentum"), smart: st("Smart-Money"), poly: polyPositions.length,
      dipbuyer: binancePositions.filter((p) => p.source === "Dip Buyer").length,
      breakout: binancePositions.filter((p) => p.source === "Breakout Hunter").length,
      dca: stockPositions.filter((p) => p.source === "Blue-Chip DCA").length,
    };
  }, [binancePositions, stockPositions, polyPositions]);

  const anyOn = scalpOn || momOn || settings.stocksEnabled || settings.polyEnabled ||
    settings.dipEnabled || settings.breakoutEnabled || settings.dcaEnabled;

  const armAll = (on: boolean) => {
    update({
      enabled: on,
      strategy: on ? "BOTH" : settings.strategy,
      stocksEnabled: on, polyEnabled: on,
      dipEnabled: on, breakoutEnabled: on, dcaEnabled: on,
    });
  };

  const totalOpenAuto = binancePositions.filter((p) => p.auto).length +
    stockPositions.filter((p) => p.auto).length + polyPositions.length;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" /> Bot Command Center
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5" dir="rtl">
            מרכז שליטה אחד לכל הבוטים — סימולציית מסחר בלבד (כסף וירטואלי).
          </p>
        </div>
        <Button
          onClick={() => armAll(!anyOn)}
          className="gap-2 font-mono"
          variant={anyOn ? "destructive" : "default"}
          aria-pressed={anyOn}
        >
          <Power className="h-4 w-4" />
          {anyOn ? "כבה הכול" : "הפעל הכול"}
        </Button>
      </header>

      {/* Live summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg border border-border bg-secondary/20 p-4">
        <StatChip label="Bots Active" value={`${[scalpOn, momOn, settings.stocksEnabled, settings.polyEnabled, settings.dipEnabled, settings.breakoutEnabled, settings.dcaEnabled].filter(Boolean).length} / 7`} />
        <StatChip label="Open Auto Pos." value={String(totalOpenAuto)} tone={totalOpenAuto > 0 ? "good" : undefined} />
        <StatChip label="Adaptive Mgr" value={settings.adaptiveEnabled ? "ON" : "OFF"} tone={settings.adaptiveEnabled ? "good" : undefined} />
        <StatChip label="Leverage (new)" value={`${settings.newBotLeverage}x`} />
      </div>

      {/* Adaptive Manager */}
      <section className="rounded-lg border p-4" style={{ borderColor: "hsl(43 74% 52% / 0.35)", background: "hsl(43 74% 52% / 0.04)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-wide">Adaptive Manager</h2>
              <p className="text-[11px] text-muted-foreground" dir="rtl">
                סוכן שמנהל את הבוטים: עוקב אחרי התוצאות של כל בוט בסימולציה ומכוונן את רמת הסלקטיביות שלו אוטומטית.
              </p>
            </div>
          </div>
          <Switch
            checked={settings.adaptiveEnabled}
            onCheckedChange={(v) => update({ adaptiveEnabled: v })}
            aria-label="Toggle adaptive manager"
          />
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {NEW_BOT_META.map((b) => {
            const s = getBotStat(b.id);
            const wr = s.trades > 0 ? (s.wins / s.trades) * 100 : 0;
            return (
              <div key={b.id} className="rounded-md border border-border/60 bg-background/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{b.title}</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">edge {s.edge.toFixed(2)}</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <StatChip label="Trades" value={String(s.trades)} />
                  <StatChip label="Win %" value={s.trades > 0 ? `${wr.toFixed(0)}%` : "—"} tone={s.trades >= 4 ? (wr >= 50 ? "good" : "bad") : undefined} />
                  <StatChip label="Net PnL" value={`${s.netPnl >= 0 ? "+" : ""}$${s.netPnl.toFixed(0)}`} tone={s.netPnl > 0 ? "good" : s.netPnl < 0 ? "bad" : undefined} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={() => resetBotStats()}>
            <RotateCcw className="h-3 w-3" /> אפס נתוני למידה
          </Button>
        </div>
      </section>

      {/* New bots */}
      <section className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
          <Rocket className="h-3.5 w-3.5" /> בוטים חדשים
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {NEW_BOT_META.map((b) => {
            const active = settings[b.enabledKey] as boolean;
            return (
              <BotCard
                key={b.id}
                icon={b.icon}
                title={b.title}
                subtitle={b.subtitle}
                hint={b.hint}
                active={active}
                onToggle={(v) => update({ [b.enabledKey]: v } as Partial<AutoTraderSettings>)}
                open={counts[b.id]}
              >
                <div className="grid grid-cols-2 gap-3">
                  <NumField
                    label="Stake $"
                    value={settings[b.stakeKey] as number}
                    min={10}
                    step={10}
                    onChange={(v) => update({ [b.stakeKey]: v } as Partial<AutoTraderSettings>)}
                  />
                  <NumField
                    label="Max Open"
                    value={settings[b.maxKey] as number}
                    min={1}
                    max={20}
                    onChange={(v) => update({ [b.maxKey]: v } as Partial<AutoTraderSettings>)}
                  />
                  <NumField
                    label={b.thrLabel}
                    value={settings[b.thrKey] as number}
                    min={1}
                    step={b.id === "dca" ? 5 : 1}
                    onChange={(v) => update({ [b.thrKey]: v } as Partial<AutoTraderSettings>)}
                  />
                  {b.market === "crypto" && (
                    <NumField
                      label="Leverage"
                      value={settings.newBotLeverage}
                      min={1}
                      max={50}
                      onChange={(v) => update({ newBotLeverage: v })}
                      suffix="x"
                    />
                  )}
                </div>
              </BotCard>
            );
          })}
        </div>
      </section>

      {/* Existing core bots */}
      <section className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5" /> בוטים קיימים
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <BotCard icon={Gauge} title="Scalp Bot" subtitle="RSI / EMA / ATR scalps" hint="עסקאות קצרות לפי איתותי סקאלפ" active={scalpOn} onToggle={(v) => applyCrypto(v, momOn)} open={counts.scalp} />
          <BotCard icon={Rocket} title="Momentum Bot" subtitle="Volume-surge runners" hint="רוכב על מטבעות עם זינוק נפח ומומנטום" active={momOn} onToggle={(v) => applyCrypto(scalpOn, v)} open={counts.momentum} />
          <BotCard icon={Megaphone} title="Smart-Money Stocks" subtitle="Technical + influencer fusion" hint="מניות לפי שילוב טכני וסנטימנט משפיענים" active={settings.stocksEnabled} onToggle={(v) => update({ stocksEnabled: v })} open={counts.smart} />
          <BotCard icon={Timer} title="Polymarket BTC" subtitle="Same-day up/down bets" hint="הימורי כיוון יומיים על ביטקוין" active={settings.polyEnabled} onToggle={(v) => update({ polyEnabled: v })} open={counts.poly} />
        </div>
      </section>

      <p className="text-[10px] text-muted-foreground/70 text-center flex items-center justify-center gap-1.5" dir="rtl">
        <Activity className="h-3 w-3" />
        כל הבוטים פועלים על תיק נייר (paper trading) בלבד — אין כאן כסף אמיתי או ייעוץ השקעות.
      </p>
    </div>
  );
}
