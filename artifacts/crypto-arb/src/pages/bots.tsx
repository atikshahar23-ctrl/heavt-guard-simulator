import { useMemo, useState, useEffect } from "react";
import {
  Bot, Power, Gauge, Rocket, Megaphone, Timer, TrendingDown, TrendingUp,
  Layers, Brain, RotateCcw, Activity, ShieldCheck, ShieldAlert, Scissors, Zap, Square, Cpu,
  Network, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePortfolio, type ClosedTrade } from "@/contexts/portfolio-context";
import {
  useAutoTrader, computeDynamicSizing, intensityProfile,
  ALPHA_COMMIT_PCT, ALPHA_STRONG_PCT,
  type AutoTraderSettings, type NewBotId, type RiskGuard,
} from "@/contexts/autotrader-context";
import { AlphaBotEmblem } from "@/components/alpha-bot-emblem";

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
      style={active ? { borderColor: accent ?? "hsl(32 84% 55% / 0.5)", boxShadow: `0 0 0 1px ${accent ?? "hsl(32 84% 55% / 0.25)"}` } : {}}
    >
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 h-9 w-9 shrink-0 rounded-md flex items-center justify-center"
          style={{ background: active ? (accent ?? "hsl(32 84% 55% / 0.15)") + "" : "hsl(0 0% 12%)" }}
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
  const { settings, update, startBoost, stopBoost, getBotStat, resetBotStats, getAssetCaution, resetAssetStats, getRiskGuard, resetRiskGuard, alpha } = useAutoTrader();
  const { binancePositions, stockPositions, polyPositions, cash, totalDeposited, tradeHistory } = usePortfolio();

  // Live boost countdown — tick once a second only while a boost is running.
  const [now, setNow] = useState(() => Date.now());
  const boostActive = settings.boostUntil > now;
  const boostRemainMs = Math.max(0, settings.boostUntil - now);
  useEffect(() => {
    if (settings.boostUntil <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [settings.boostUntil]);
  const boostClock = `${Math.floor(boostRemainMs / 60000)}:${String(
    Math.floor((boostRemainMs % 60000) / 1000),
  ).padStart(2, "0")}`;

  // Coins the bots have learned to be cautious on (caution multiplier > 1),
  // sorted by how cautious the bots have become, then by how badly they bled.
  const cautionedCoins = useMemo(() => {
    return Object.entries(settings.assetStats)
      .map(([asset, s]) => ({ asset, s, caution: getAssetCaution(asset) }))
      .filter((x) => x.caution > 1)
      .sort((a, b) => b.caution - a.caution || a.s.netPnl - b.s.netPnl);
  }, [settings.assetStats, getAssetCaution]);

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

  // ── Mega-Agent Coordinator ──
  // One supervisor view over the whole fleet: every bot's realized track record
  // (from the wallet's closed-trade history, attributed by `source`/type) fused
  // with its live open count, armed state and risk-pause status. This is purely
  // a read-only roll-up — it never opens trades itself.
  const fleet = useMemo(() => {
    const defs: {
      key: keyof typeof counts; title: string; icon: React.ComponentType<{ className?: string }>;
      market: string; armed: boolean; match: (t: ClosedTrade) => boolean;
    }[] = [
      { key: "scalp", title: "Scalp Bot", icon: Gauge, market: "קריפטו", armed: scalpOn, match: (t) => (t.source ?? "").includes("Scalp") },
      { key: "momentum", title: "Momentum Bot", icon: Rocket, market: "קריפטו", armed: momOn, match: (t) => (t.source ?? "").includes("Momentum") },
      { key: "smart", title: "Smart-Money", icon: Megaphone, market: "מניות", armed: settings.stocksEnabled, match: (t) => (t.source ?? "").includes("Smart-Money") },
      { key: "poly", title: "Polymarket BTC", icon: Timer, market: "תחזיות", armed: settings.polyEnabled, match: (t) => t.type === "POLYMARKET" },
      { key: "dipbuyer", title: "Dip Buyer", icon: TrendingDown, market: "קריפטו", armed: settings.dipEnabled, match: (t) => t.source === "Dip Buyer" },
      { key: "breakout", title: "Breakout Hunter", icon: TrendingUp, market: "קריפטו", armed: settings.breakoutEnabled, match: (t) => t.source === "Breakout Hunter" },
      { key: "dca", title: "Blue-Chip DCA", icon: Layers, market: "מניות", armed: settings.dcaEnabled, match: (t) => t.source === "Blue-Chip DCA" },
    ];
    const rows = defs.map((d) => {
      const ts = tradeHistory.filter((t) => d.match(t));
      const trades = ts.length;
      const wins = ts.filter((t) => t.pnl > 0).length;
      const net = ts.reduce((a, t) => a + t.pnl, 0);
      return {
        ...d,
        trades, wins, net,
        wr: trades > 0 ? (wins / trades) * 100 : 0,
        open: counts[d.key] ?? 0,
        paused: getRiskGuard(d.key).paused,
        edge: getBotStat(d.key).edge,
      };
    });
    const totTrades = rows.reduce((a, r) => a + r.trades, 0);
    const totWins = rows.reduce((a, r) => a + r.wins, 0);
    return {
      rows,
      totTrades,
      totWins,
      totNet: rows.reduce((a, r) => a + r.net, 0),
      totOpen: rows.reduce((a, r) => a + r.open, 0),
      activeCount: rows.filter((r) => r.armed).length,
      pausedCount: rows.filter((r) => r.paused).length,
      wr: totTrades > 0 ? (totWins / totTrades) * 100 : 0,
      best: rows.filter((r) => r.trades > 0).sort((a, b) => b.net - a.net)[0],
      worst: rows.filter((r) => r.trades > 0).sort((a, b) => a.net - b.net)[0],
    };
  }, [tradeHistory, counts, scalpOn, momOn, settings, getRiskGuard, getBotStat]);

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
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:pr-44">
        <div className="flex items-center gap-3">
          <AlphaBotEmblem className="h-11 w-11 shrink-0" active={settings.alphaCoordinatorEnabled && alpha.direction !== "NEUTRAL"} />
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Bot className="h-6 w-6 text-primary" /> Bot Command Center
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5" dir="rtl">
              מרכז שליטה אחד לכל הבוטים — סימולציית מסחר בלבד (כסף וירטואלי).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {boostActive ? (
            <div
              className="flex items-center gap-2 rounded-md border px-3 py-1.5 animate-pulse"
              style={{ borderColor: "hsl(43 74% 52% / 0.6)", background: "hsl(43 74% 52% / 0.12)" }}
            >
              <Zap className="h-4 w-4 text-primary" />
              <span className="font-mono text-base font-bold text-primary tabular-nums">{boostClock}</span>
              <span className="text-[10px] text-muted-foreground" dir="rtl">בוסט פעיל</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[10px] gap-1"
                onClick={stopBoost}
              >
                <Square className="h-3 w-3" /> עצור
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => startBoost()}
              variant="outline"
              className="gap-2 font-mono border-primary/60 text-primary hover:bg-primary/10"
              title="מפעיל את כל הבוטים במצב מסחר מהיר ל-5 דקות"
            >
              <Zap className="h-4 w-4" />
              בוסט · 5 דק'
            </Button>
          )}
          <Button
            onClick={() => armAll(!anyOn)}
            className="gap-2 font-mono"
            variant={anyOn ? "destructive" : "default"}
            aria-pressed={anyOn}
          >
            <Power className="h-4 w-4" />
            {anyOn ? "כבה הכול" : "הפעל הכול"}
          </Button>
        </div>
      </header>

      {boostActive && (
        <div
          className="rounded-lg border px-4 py-2.5 flex items-center gap-3"
          style={{ borderColor: "hsl(43 74% 52% / 0.4)", background: "hsl(43 74% 52% / 0.06)" }}
          dir="rtl"
        >
          <Zap className="h-4 w-4 text-primary shrink-0" />
          <p className="text-[11px] text-muted-foreground">
            <span className="text-primary font-semibold">מצב בוסט פעיל</span> — כל הבוטים סוחרים בקצב המהיר ביותר (קירור מינימלי, מימוש רווחים זריז) כדי לבצע הרבה עסקאות קטנות. הקצב חוזר לרגיל בעוד <span className="font-mono text-primary">{boostClock}</span>.
          </p>
        </div>
      )}

      {/* ── Alpha Convergence Coordinator — סוכן אלפא (מתאם-על) ── */}
      {(() => {
        const on = settings.alphaCoordinatorEnabled;
        const dir = on ? alpha.direction : "NEUTRAL";
        const isLong = dir === "LONG";
        const isShort = dir === "SHORT";
        const committed = on && dir !== "NEUTRAL";
        const strong = committed && alpha.confluence >= ALPHA_STRONG_PCT;
        const totVotes = Math.max(1, alpha.longVotes + alpha.shortVotes);
        const longPct = Math.round((alpha.longVotes / totVotes) * 100);
        const accent = isLong ? "152 60% 45%" : isShort ? "0 72% 51%" : "43 74% 52%";
        const dirLabel = isLong ? "עלייה (LONG)" : isShort ? "ירידה (SHORT)" : on ? "ממתין לקונצנזוס" : "כבוי";
        const DirIcon = isLong ? ArrowUpRight : isShort ? ArrowDownRight : Minus;
        return (
          <section
            className="alpha-coordinator relative overflow-hidden rounded-xl border p-4 sm:p-5 anim-rise-in"
            style={{
              borderColor: `hsl(${accent} / ${committed ? 0.55 : 0.35})`,
              background: `radial-gradient(120% 120% at 85% 0%, hsl(${accent} / 0.12), hsl(0 0% 6% / 0.4) 60%)`,
            }}
            dir="rtl"
          >
            {committed && <div className="alpha-scan-line" style={{ background: `linear-gradient(90deg, transparent, hsl(${accent} / 0.5), transparent)` }} />}
            <div className="relative flex items-start gap-3 sm:gap-4">
              <div className={`shrink-0 ${committed ? "alpha-emblem-bob" : ""}`}>
                <AlphaBotEmblem className="h-12 w-12 sm:h-14 sm:w-14" active={committed} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-bold tracking-wide flex items-center gap-1.5">
                    סוכן אלפא — מתאם-העל
                    <Network className="h-4 w-4 text-primary" />
                  </h2>
                  <Switch checked={on} onCheckedChange={(v) => update({ alphaCoordinatorEnabled: v })} aria-label="הפעלת סוכן אלפא" />
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  המוח המתאם של כל הצי: קורא את מידת ההסכמה בין כל מקורות האיתות — סקאלפ, מומנטום והסוכן החכם של המניות — ומגבש <span className="text-foreground font-medium">כיוון אחד לכל הבוטים</span>. כשהבוטים מאוחדים בכיוון הם נעים יחד כמערך אחד: עסקאות שמסכימות עם הקונצנזוס עוברות סף קל יותר ומקבלות יותר מקום, ועסקאות שנוגדות אותו חייבות סטאפ חזק בהרבה. סימולציה חינוכית בלבד — הוא מתאם את הבוטים, לא מזיז שום שוק אמיתי.
                </p>
              </div>
            </div>

            {/* Live conviction readout */}
            <div className="relative mt-4 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
              <div
                className="flex items-center gap-2 rounded-lg border px-3 py-2 justify-center"
                style={{ borderColor: `hsl(${accent} / 0.5)`, background: `hsl(${accent} / 0.1)` }}
              >
                <DirIcon className="h-5 w-5" style={{ color: `hsl(${accent})` }} />
                <div className="text-center leading-tight">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono">כיוון הצי</div>
                  <div className="text-sm font-bold" style={{ color: `hsl(${accent})` }}>{dirLabel}</div>
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mb-1">
                  <span>עוצמת קונצנזוס</span>
                  <span className="tabular-nums" style={{ color: committed ? `hsl(${accent})` : undefined }}>
                    {on ? `${alpha.confluence}%` : "—"}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-secondary/40 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${on ? alpha.confluence : 0}%`, background: `hsl(${accent})` }}
                  />
                </div>
                {/* Long vs short tug-of-war */}
                <div className="mt-2 flex h-1.5 rounded-full overflow-hidden bg-secondary/40">
                  <div className="h-full transition-all duration-700" style={{ width: `${on ? longPct : 50}%`, background: "hsl(152 60% 45% / 0.8)" }} />
                  <div className="h-full transition-all duration-700" style={{ width: `${on ? 100 - longPct : 50}%`, background: "hsl(0 72% 51% / 0.8)" }} />
                </div>
                <div className="mt-1 flex items-center justify-between text-[9px] font-mono text-muted-foreground">
                  <span className="text-emerald-400">▲ {on ? alpha.longVotes : 0}</span>
                  <span>{on ? `${alpha.sources} מקורות פעילים` : "מכובה"}</span>
                  <span className="text-red-400">{on ? alpha.shortVotes : 0} ▼</span>
                </div>
              </div>
            </div>

            <div className="relative mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatChip label="מצב" value={!on ? "כבוי" : committed ? "במערך" : "מסנכרן"} tone={committed ? "good" : undefined} />
              <StatChip label="סף כניסה (תואם)" value={committed ? "מרוכך" : "רגיל"} tone={committed ? "good" : undefined} />
              <StatChip label="סף כניסה (נוגד)" value={committed ? "מחמיר" : "רגיל"} tone={committed ? "bad" : undefined} />
              <StatChip label="תוספת מקומות" value={strong ? "+2 כשהצי חזק" : "—"} tone={strong ? "good" : undefined} />
            </div>

            {on && committed && (
              <p className="relative mt-2 text-[10px]" style={{ color: `hsl(${accent})` }}>
                {strong
                  ? `הצי מאוחד בעוצמה (${alpha.confluence}%) לכיוון ${isLong ? "עלייה" : "ירידה"} — הבוטים נכנסים יחד למערך ולוחצים על היתרון.`
                  : `הצי מתכנס לכיוון ${isLong ? "עלייה" : "ירידה"} (${alpha.confluence}%) — הבוטים מתחילים לנוע באותו כיוון.`}
              </p>
            )}
            {on && !committed && (
              <p className="relative mt-2 text-[10px] text-muted-foreground">
                אין עדיין רוב ברור ({ALPHA_COMMIT_PCT}%+ נדרש כדי לגבש כיוון) — כל בוט פועל לפי הסטאפ שלו עד שמופיע קונצנזוס.
              </p>
            )}
          </section>
        );
      })()}

      {/* Live summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg border border-border bg-secondary/20 p-4">
        <StatChip label="Bots Active" value={`${[scalpOn, momOn, settings.stocksEnabled, settings.polyEnabled, settings.dipEnabled, settings.breakoutEnabled, settings.dcaEnabled].filter(Boolean).length} / 7`} />
        <StatChip label="Open Auto Pos." value={String(totalOpenAuto)} tone={totalOpenAuto > 0 ? "good" : undefined} />
        <StatChip label="Adaptive Mgr" value={settings.adaptiveEnabled ? "ON" : "OFF"} tone={settings.adaptiveEnabled ? "good" : undefined} />
        <StatChip label="Leverage (new)" value={`${settings.newBotLeverage}x`} />
      </div>

      {/* ── Trading-intensity gear (one selector for the whole fleet) ── */}
      {(() => {
        const prof = intensityProfile(settings.intensity ?? 3);
        return (
          <section className="rounded-lg border p-4" style={{ borderColor: "hsl(43 74% 52% / 0.4)", background: "hsl(43 74% 52% / 0.05)" }} dir="rtl">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
                <Gauge className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold tracking-wide">עוצמת מסחר — בורר הילוכים</h2>
                <p className="text-[11px] text-muted-foreground">
                  בורר אחד שמשפיע על <span className="text-foreground font-medium">כל הבוטים</span> יחד. כל הילוך מעלה מגדיל את כמות העסקאות בכ-50% ומרכך את הסלקטיביות. הילוך <span className="text-foreground font-medium">1 (רגוע)</span> פותח מעט עסקאות אך מחפש סטאפים חזקים ומכוון לרווח גדול; הילוך <span className="text-foreground font-medium">5 (טורבו קיצוני)</span> סוחר בקצב מקסימלי. כמו מצב חסכוני מול ספורט.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((lvl) => {
                const p = intensityProfile(lvl);
                const sel = (settings.intensity ?? 3) === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => update({ intensity: lvl })}
                    aria-pressed={sel}
                    className={`rounded-md border p-2.5 text-center transition-all ${
                      sel ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(43_74%_52%/0.4)]" : "border-border/60 bg-background/40 hover:bg-secondary/40"
                    }`}
                  >
                    <div className={`text-lg font-mono font-bold leading-none ${sel ? "text-primary" : "text-muted-foreground"}`}>{lvl}</div>
                    <div className={`text-[10px] font-medium leading-tight mt-1 ${sel ? "text-foreground" : "text-muted-foreground"}`}>{p.label}</div>
                    <div className="text-[9px] font-mono text-muted-foreground/80 mt-0.5">{p.tradeRate.toFixed(2)}×</div>
                  </button>
                );
              })}
            </div>

            {/* economy → sport gradient cue */}
            <div className="mt-3 h-1.5 rounded-full" style={{ background: "linear-gradient(to left, hsl(152 60% 45% / 0.5), hsl(43 74% 52% / 0.6), hsl(0 72% 51% / 0.7))" }} />

            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatChip label="הילוך נוכחי" value={`${prof.level} · ${prof.label}`} tone="good" />
              <StatChip label="קצב עסקאות" value={`${prof.tradeRate.toFixed(2)}× מהילוך 1`} />
              <StatChip label="קירור בין עסקאות" value={`${Math.round(prof.cooldownMult * 100)}%`} tone={prof.cooldownMult < 1 ? "good" : undefined} />
              <StatChip label="סלקטיביות" value={prof.selectivityMult > 1 ? "מחמירה" : prof.selectivityMult < 1 ? "מרוככת" : "רגילה"} />
            </div>
            {boostActive && (
              <p className="mt-2 text-[10px] text-primary/90" dir="rtl">
                בזמן בוסט הקצב נדרס לקצב המהיר ביותר ללא קשר להילוך; ההילוך חוזר לפעול כשהבוסט מסתיים.
              </p>
            )}
          </section>
        );
      })()}

      {/* ── Mega-Agent Coordinator — סוכן-על מתאם ── */}
      <section className="rounded-lg border p-4" style={{ borderColor: "hsl(265 70% 60% / 0.4)", background: "hsl(265 70% 60% / 0.05)" }} dir="rtl">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-md flex items-center justify-center shrink-0" style={{ background: "hsl(265 70% 60% / 0.15)" }}>
            <Cpu className="h-4 w-4" style={{ color: "hsl(265 70% 68%)" }} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold tracking-wide">סוכן-על מתאם — Mega-Agent</h2>
            <p className="text-[11px] text-muted-foreground">
              מבט-על אחד על כל 7 הבוטים יחד, בכל הזירות (קריפטו, מניות ותחזיות): ביצועים מצטברים מההיסטוריה, פוזיציות פתוחות, מצב הפעלה ונעילות סיכון. זהו סיכום בלבד — הוא לא פותח עסקאות בעצמו.
            </p>
          </div>
        </div>

        {/* Fleet summary */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 rounded-md border border-border/40 bg-background/40 p-3">
          <StatChip label="בוטים פעילים" value={`${fleet.activeCount} / 7`} tone={fleet.activeCount > 0 ? "good" : undefined} />
          <StatChip label="פוזיציות פתוחות" value={String(fleet.totOpen)} tone={fleet.totOpen > 0 ? "good" : undefined} />
          <StatChip label="עסקאות סגורות" value={String(fleet.totTrades)} />
          <StatChip label="אחוז ניצחון" value={fleet.totTrades > 0 ? `${fleet.wr.toFixed(0)}%` : "—"} tone={fleet.totTrades >= 4 ? (fleet.wr >= 50 ? "good" : "bad") : undefined} />
          <StatChip label="רווח/הפסד כולל" value={`${fleet.totNet >= 0 ? "+" : ""}$${fleet.totNet.toFixed(0)}`} tone={fleet.totNet > 0 ? "good" : fleet.totNet < 0 ? "bad" : undefined} />
          <StatChip label="מושהים" value={String(fleet.pausedCount)} tone={fleet.pausedCount > 0 ? "bad" : undefined} />
        </div>

        {(fleet.best || fleet.worst) && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fleet.best && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">הבוט המוביל</span>
                <span className="text-xs font-semibold">{fleet.best.title} <span className="font-mono text-emerald-400">{fleet.best.net >= 0 ? "+" : ""}${fleet.best.net.toFixed(0)}</span></span>
              </div>
            )}
            {fleet.worst && fleet.worst.key !== fleet.best?.key && (
              <div className="rounded-md border border-red-500/30 bg-red-500/5 p-2.5 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">זקוק לתשומת לב</span>
                <span className="text-xs font-semibold">{fleet.worst.title} <span className="font-mono text-red-400">{fleet.worst.net >= 0 ? "+" : ""}${fleet.worst.net.toFixed(0)}</span></span>
              </div>
            )}
          </div>
        )}

        {/* Per-bot roll-up */}
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {fleet.rows.map((r) => (
            <div
              key={r.key}
              className={`rounded-md border p-3 ${r.paused ? "border-red-500/40 bg-red-500/5" : r.armed ? "border-primary/40 bg-primary/5" : "border-border/60 bg-background/40"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <r.icon className={`h-3.5 w-3.5 shrink-0 ${r.armed ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-xs font-semibold truncate">{r.title}</span>
                </div>
                <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded-full shrink-0 ${r.paused ? "bg-red-500/20 text-red-400" : r.armed ? "bg-emerald-500/15 text-emerald-400" : "bg-muted/40 text-muted-foreground"}`}>
                  {r.paused ? "הושהת" : r.armed ? "פעיל" : "כבוי"}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <StatChip label="עסקאות" value={String(r.trades)} />
                <StatChip label="ניצחון" value={r.trades > 0 ? `${r.wr.toFixed(0)}%` : "—"} tone={r.trades >= 4 ? (r.wr >= 50 ? "good" : "bad") : undefined} />
                <StatChip label="P/L" value={`${r.net >= 0 ? "+" : ""}$${r.net.toFixed(0)}`} tone={r.net > 0 ? "good" : r.net < 0 ? "bad" : undefined} />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[9px] font-mono text-muted-foreground">
                <span>{r.market}</span>
                <span>{r.open > 0 ? <span className="text-primary">{r.open} פתוחות</span> : "אין פתוחות"}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Dynamic Capital Agent ── */}
      {(() => {
        const dyn = computeDynamicSizing(cash, totalDeposited, tradeHistory);
        const portfolioRatio = totalDeposited > 0 ? cash / totalDeposited : 1;
        const ratioLabel = portfolioRatio >= 1.05 ? "מצב רווח" : portfolioRatio <= 0.92 ? "מצב הפסד" : "מאוזן";
        const ratioTone = portfolioRatio >= 1.05 ? "good" : portfolioRatio <= 0.92 ? "bad" : undefined;
        const recent = tradeHistory.slice(0, 10);
        const wr = recent.length >= 3 ? (recent.filter((t) => t.pnl > 0).length / recent.length * 100).toFixed(0) + "%" : "—";
        return (
          <section className="rounded-lg border p-4" style={{ borderColor: "hsl(196 80% 55% / 0.35)", background: "hsl(196 80% 55% / 0.04)" }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-md flex items-center justify-center shrink-0" style={{ background: "hsl(196 80% 55% / 0.15)" }}>
                  <Cpu className="h-4 w-4" style={{ color: "hsl(196 80% 60%)" }} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold tracking-wide">מנהל הון דינמי</h2>
                  <p className="text-[11px] text-muted-foreground" dir="rtl">
                    עוקף את כל הגדרות המרג׳ין והמינוף של הבוטים — מחשב אוטומטית גודל פוזיציה ומינוף לפי שווי תיק המסחר, יחס בריאות ואחוז הניצחונות האחרון.
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.dynamicCapitalEnabled}
                onCheckedChange={(v) => update({ dynamicCapitalEnabled: v })}
                aria-label="Toggle dynamic capital agent"
              />
            </div>
            {/* Live preview */}
            <div className="mt-4 rounded-md border border-border/40 bg-background/40 p-3">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono mb-2">
                {settings.dynamicCapitalEnabled ? "ערכים פעילים כעת (עוקפים הגדרות ידניות)" : "תצוגה מקדימה — מה יהיה אם תופעל"}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatChip label="מרג׳ין לעסקה" value={`$${dyn.margin}`} tone={settings.dynamicCapitalEnabled ? "good" : undefined} />
                <StatChip label="מינוף" value={`${dyn.leverage}x`} tone={settings.dynamicCapitalEnabled ? "good" : undefined} />
                <StatChip label="מצב תיק" value={ratioLabel} tone={ratioTone} />
                <StatChip label="אחוז ניצחון (10 אחרונות)" value={wr} />
              </div>
              {settings.dynamicCapitalEnabled && (
                <p className="mt-2 text-[10px] text-muted-foreground" dir="rtl">
                  הגדרות המרג׳ין, המינוף וגודל ה-Stake שהגדרת ידנית <span className="text-amber-400 font-semibold">מושבתות זמנית</span> — הסוכן הדינמי מחשב הכל מחדש לפי מצב התיק הנוכחי.
                </p>
              )}
            </div>
          </section>
        );
      })()}

      {/* Adaptive Manager */}
      <section className="rounded-lg border p-4" style={{ borderColor: "hsl(32 84% 55% / 0.35)", background: "hsl(32 84% 55% / 0.04)" }}>
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

      {/* Per-coin caution — זהירות לפי מטבע */}
      <section className="rounded-lg border p-4" style={{ borderColor: "hsl(43 74% 52% / 0.35)", background: "hsl(43 74% 52% / 0.04)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-wide">זהירות לפי מטבע</h2>
              <p className="text-[11px] text-muted-foreground" dir="rtl">
                הבוטים לומדים על אילו מטבעות הם נכשלים בעסקאות, ומעלים אוטומטית את רמת הזהירות והדיוק — דורשים סטאפ חזק יותר לפני שפותחים שם עסקה שוב, כדי לא לחזור על אותן טעויות.
              </p>
            </div>
          </div>
          <Switch
            checked={settings.assetCautionEnabled}
            onCheckedChange={(v) => update({ assetCautionEnabled: v })}
            aria-label="Toggle per-coin caution"
          />
        </div>

        {settings.assetCautionEnabled ? (
          cautionedCoins.length > 0 ? (
            <>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {cautionedCoins.map(({ asset, s, caution }) => {
                  const wr = s.trades > 0 ? (s.wins / s.trades) * 100 : 0;
                  return (
                    <div key={asset} className="rounded-md border border-border/60 bg-background/40 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold font-mono">{asset}</span>
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${
                            caution >= 1.5 ? "bg-red-500/15 text-red-400" : "bg-primary/10 text-primary"
                          }`}
                        >
                          זהירות {caution.toFixed(2)}×
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <StatChip label="Trades" value={String(s.trades)} />
                        <StatChip label="Win %" value={s.trades > 0 ? `${wr.toFixed(0)}%` : "—"} tone={wr >= 50 ? "good" : "bad"} />
                        <StatChip label="Net PnL" value={`${s.netPnl >= 0 ? "+" : ""}$${s.netPnl.toFixed(0)}`} tone={s.netPnl > 0 ? "good" : s.netPnl < 0 ? "bad" : undefined} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex justify-end">
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={() => resetAssetStats()}>
                  <RotateCcw className="h-3 w-3" /> אפס זהירות מטבעות
                </Button>
              </div>
            </>
          ) : (
            <p className="mt-4 text-[11px] text-muted-foreground" dir="rtl">
              אין עדיין מטבעות בזהירות מוגברת. ככל שהבוטים יסחרו, מטבעות שיפסידו בהם שוב ושוב יופיעו כאן עם רמת זהירות גבוהה יותר.
            </p>
          )
        ) : (
          <p className="mt-4 text-[11px] text-muted-foreground" dir="rtl">
            הלמידה לפי מטבע כבויה — הבוטים מתייחסים לכל המטבעות באותה רמת זהירות.
          </p>
        )}
      </section>

      {/* Risk Manager — סוכן ניהול סיכונים */}
      <section className="rounded-lg border p-4" style={{ borderColor: "hsl(0 72% 51% / 0.35)", background: "hsl(0 72% 51% / 0.03)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-md bg-red-500/15 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-4 w-4 text-red-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-wide">Risk Manager — סוכן ניהול סיכונים</h2>
              <p className="text-[11px] text-muted-foreground" dir="rtl">
                סופר-סוחר שעוצר בוטים מהביזוי ושומר על הון-ריט, הפסד יומי, ודד-דאון. אם בוט מוזיה שובו הושהת אוטומטית.
              </p>
            </div>
          </div>
          <Switch
            checked={settings.riskManagerEnabled}
            onCheckedChange={(v) => update({ riskManagerEnabled: v })}
            aria-label="Toggle risk manager"
          />
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {NEW_BOT_META.map((b) => {
            const g: RiskGuard = getRiskGuard(b.id);
            const stat = getBotStat(b.id);
            const wr = stat.trades > 0 ? (stat.wins / stat.trades) * 100 : 0;
            return (
              <div key={b.id} className={`rounded-md border p-3 ${g.paused ? "border-red-500/40 bg-red-500/5" : "border-border/60 bg-background/40"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{b.title}</span>
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${g.paused ? "bg-red-500/20 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                    {g.paused ? "הושהת" : "פועל"}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <StatChip label="Win %" value={stat.trades > 0 ? `${wr.toFixed(0)}%` : "—"} tone={stat.trades >= 4 ? (wr >= 50 ? "good" : "bad") : undefined} />
                  <StatChip label="DD" value={`${g.maxDrawdownPct.toFixed(1)}%`} tone={g.maxDrawdownPct >= 20 ? "bad" : undefined} />
                  <StatChip label="היום" value={g.dailyLossHalt ? "STOP" : "OK"} tone={g.dailyLossHalt ? "bad" : "good"} />
                </div>
                {g.paused && g.reason && (
                  <p className="mt-2 text-[10px] text-red-400/90 leading-snug" dir="rtl">{g.reason}</p>
                )}
                {g.paused && (
                  <div className="mt-2 flex justify-end">
                    <Button variant="ghost" size="sm" className="gap-1 text-[10px] text-muted-foreground" onClick={() => resetRiskGuard(b.id)}>
                      <RotateCcw className="h-3 w-3" /> אפשר בוט
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={() => resetRiskGuard()}>
            <RotateCcw className="h-3 w-3" /> אפס כל ההושהות
          </Button>
        </div>
      </section>

      {/* Smart Exit — סגירה חכמה */}
      <section className="rounded-lg border p-4" style={{ borderColor: "hsl(152 60% 45% / 0.35)", background: "hsl(152 60% 45% / 0.04)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-md bg-emerald-500/15 flex items-center justify-center shrink-0">
              <Scissors className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-wide">Smart Exit — סגירה חכמה</h2>
              <p className="text-[11px] text-muted-foreground" dir="rtl">
                סוכן הסגירה: נועל רווחים קטנים מהר כמו סופרמרקט — אפילו עסקאות של דקה או חצי דקה. אבל כשיש פוטנציאל לרווח גדול הוא נותן לעסקה לרוץ עד שהמומנטום מתהפך.
              </p>
            </div>
          </div>
          <Switch
            checked={settings.smartExitEnabled}
            onCheckedChange={(v) => update({ smartExitEnabled: v })}
            aria-label="Toggle smart exit"
          />
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          <NumField label="נעילת רווח %" value={settings.scalpTakeProfitPct} min={0.1} step={0.1} suffix="%" onChange={(v) => update({ scalpTakeProfitPct: v })} />
          <NumField label="החזר סקאלפ %" value={settings.scalpGivebackPct} min={0.1} step={0.1} suffix="%" onChange={(v) => update({ scalpGivebackPct: v })} />
          <NumField label="סף ריצה %" value={settings.runnerTriggerPct} min={0.2} step={0.1} suffix="%" onChange={(v) => update({ runnerTriggerPct: v })} />
          <NumField label="טריילינג ריצה %" value={settings.runnerTrailPct} min={0.1} step={0.1} suffix="%" onChange={(v) => update({ runnerTrailPct: v })} />
          <NumField label="מחזור אחרי (ש')" value={settings.maxScalpHoldSec} min={0} step={15} suffix="ש'" onChange={(v) => update({ maxScalpHoldSec: v })} />
        </div>
        <p className="mt-3 text-[10px] text-muted-foreground/70" dir="rtl">
          חל על עסקאות הקריפטו של כל הבוטים. נעילת הרווח מתחילה רק כשהעסקה בירוק; עסקאות חזקות שעוברות את "סף הריצה" מקבלות מרחב טריילינג גדול יותר כדי להמשיך לרוץ. הסוכן אף פעם לא מעמיק הפסד.
        </p>
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
                    max={50}
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
