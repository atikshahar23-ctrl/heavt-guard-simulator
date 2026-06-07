import { useMemo, useState, useEffect } from "react";
import {
  Bot, Power, Gauge, Rocket, Megaphone, Timer, TrendingDown, TrendingUp,
  Layers, Brain, RotateCcw, Activity, ShieldCheck, ShieldAlert, Scissors, Zap, Square, Cpu,
  Network, ArrowUpRight, ArrowDownRight, Minus, Trophy, Siren, Crosshair, Turtle, Rabbit, Sparkles, Coins,
  PauseCircle, PlayCircle,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { usePortfolio, type ClosedTrade } from "@/contexts/portfolio-context";
import {
  useAutoTrader, computeDynamicSizing, intensityProfile, SCALP_SQUAD,
  ALPHA_COMMIT_PCT, ALPHA_STRONG_PCT,
  type AutoTraderSettings, type NewBotId, type RiskGuard, type TradeMode,
} from "@/contexts/autotrader-context";
import { useLivePrices } from "@/contexts/live-price-context";
import { useSquadComms, clearSquadMessages, type SquadMessage } from "@/lib/squad-comms";
import { toast } from "@/hooks/use-toast";
import {
  useGetMarketOverview, getGetMarketOverviewQueryKey,
  useGetStocks, getGetStocksQueryKey,
  useGetShortTermMarkets, getGetShortTermMarketsQueryKey,
  type PolymarketMarket,
} from "@workspace/api-client-react";
import { AlphaBotEmblem } from "@/components/alpha-bot-emblem";

/** Preset boost durations in minutes (5 min → 5 h, the BOOST_MAX_MS ceiling). */
const BOOST_PRESETS = [5, 15, 30, 60, 120, 180, 300] as const;

/** Hebrew label for a boost duration given in minutes. */
function boostDurationLabel(min: number): string {
  if (min < 60) return `${min} דק'`;
  const h = min / 60;
  return Number.isInteger(h) ? `${h} שע'` : `${h.toFixed(1)} שע'`;
}

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
  id, icon: Icon, title, subtitle, hint, active, onToggle, open, children, accent,
}: {
  id?: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string; subtitle: string; hint: string;
  active: boolean; onToggle: (v: boolean) => void;
  open: number; children?: React.ReactNode; accent?: string;
}) {
  return (
    <div
      id={id}
      className="relative rounded-lg border border-border bg-secondary/20 p-4 transition-all scroll-mt-24"
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

/** Lucide icon per squad member id. */
const SQUAD_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  vanguard: Crosshair,
  longrider: TrendingUp,
  shorthunter: TrendingDown,
  scout: Rabbit,
  sweeper: ShieldCheck,
};

/** Color accent per comms message kind. */
const COMMS_TONE: Record<SquadMessage["kind"], string> = {
  entry: "text-emerald-400",
  exit: "text-amber-300",
  backup: "text-primary",
  info: "text-muted-foreground",
};

/** Short HH:MM:SS clock for a comms timestamp. */
function commsClock(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function Bots() {
  const { settings, update, startBoost, stopBoost, getBotStat, resetBotStats, getAssetCaution, resetAssetStats, getRiskGuard, resetRiskGuard, alpha } = useAutoTrader();
  const { binancePositions, stockPositions, polyPositions, fundingPositions, optionPositions, cash, totalDeposited, tradeHistory, closeAllBotPositions } = usePortfolio();
  const { get: getLivePrice } = useLivePrices();

  // Cached market data shared with the trading engines (same query keys), used to
  // close positions at a real mark price during an emergency stop. Crypto also
  // reads the sub-second live WS price below; stocks/poly use these REST quotes.
  const { data: overview } = useGetMarketOverview({ query: { queryKey: getGetMarketOverviewQueryKey() } });
  const { data: stocks } = useGetStocks({ query: { queryKey: getGetStocksQueryKey() } });
  const { data: shortTerm } = useGetShortTermMarkets({ query: { queryKey: getGetShortTermMarketsQueryKey() } });

  // Scroll to and briefly highlight a specific bot card when navigated from a trade badge.
  useEffect(() => {
    const botId = sessionStorage.getItem("scrollToBotId");
    if (!botId) return;
    sessionStorage.removeItem("scrollToBotId");
    const timer = setTimeout(() => {
      const el = document.getElementById(botId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.add("ring-2", "ring-primary/70", "ring-offset-2", "ring-offset-background");
        setTimeout(() => el.classList.remove("ring-2", "ring-primary/70", "ring-offset-2", "ring-offset-background"), 2000);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // Live boost countdown — tick once a second only while a boost is running.
  const [now, setNow] = useState(() => Date.now());
  const boostActive = settings.boostUntil > now;
  const boostRemainMs = Math.max(0, settings.boostUntil - now);
  useEffect(() => {
    if (settings.boostUntil <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [settings.boostUntil]);
  const boostClock = (() => {
    const totalSec = Math.floor(boostRemainMs / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  })();

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
      scalp: bn("Scalp"), momentum: bn("Momentum"), smart: st("Smart-Money"), poly: polyPositions.filter((p) => p.source === "Polymarket BTC").length,
      dipbuyer: binancePositions.filter((p) => p.source === "Dip Buyer").length,
      breakout: binancePositions.filter((p) => p.source === "Breakout Hunter").length,
      dca: stockPositions.filter((p) => p.source === "Blue-Chip DCA").length,
      funding: fundingPositions.filter((p) => p.source === "Funding Arb Agent").length,
      options: optionPositions.filter((p) => p.source === "Options Agent").length,
    };
  }, [binancePositions, stockPositions, polyPositions, fundingPositions, optionPositions]);

  // ── Scalp Squad ── per-member live open count + realized track record,
  // attributed by the member's exact `source` tag.
  const squadRows = useMemo(() => {
    return SCALP_SQUAD.map((m) => {
      const open = binancePositions.filter((p) => p.source === m.source).length;
      const ts = tradeHistory.filter((t) => t.source === m.source);
      const trades = ts.length;
      const wins = ts.filter((t) => t.pnl > 0).length;
      const net = ts.reduce((a, t) => a + t.pnl, 0);
      return { member: m, open, trades, wins, net, wr: trades > 0 ? (wins / trades) * 100 : 0 };
    });
  }, [binancePositions, tradeHistory]);
  const squadOpen = squadRows.reduce((a, r) => a + r.open, 0);

  // Live squad coordination feed (entries, exits, hand-offs, backup calls).
  const comms = useSquadComms();

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
      { key: "poly", title: "Polymarket BTC", icon: Timer, market: "תחזיות", armed: settings.polyEnabled, match: (t) => t.type === "POLYMARKET" && t.source === "Polymarket BTC" },
      { key: "dipbuyer", title: "Dip Buyer", icon: TrendingDown, market: "קריפטו", armed: settings.dipEnabled, match: (t) => t.source === "Dip Buyer" },
      { key: "breakout", title: "Breakout Hunter", icon: TrendingUp, market: "קריפטו", armed: settings.breakoutEnabled, match: (t) => t.source === "Breakout Hunter" },
      { key: "dca", title: "Blue-Chip DCA", icon: Layers, market: "מניות", armed: settings.dcaEnabled, match: (t) => t.source === "Blue-Chip DCA" },
      { key: "funding", title: "Funding Arb Agent", icon: Coins, market: "קריפטו", armed: settings.fundingEnabled, match: (t) => t.type === "FUNDING" && t.source === "Funding Arb Agent" },
      { key: "options", title: "Options Agent", icon: Sparkles, market: "אופציות", armed: settings.optionsEnabled, match: (t) => t.type === "OPTION" && t.source === "Options Agent" },
    ];
    const rows = defs.map((d) => {
      const ts = tradeHistory.filter((t) => d.match(t));
      const trades = ts.length;
      const wins = ts.filter((t) => t.pnl > 0).length;
      const net = ts.reduce((a, t) => a + t.pnl, 0);
      const isNewBot = d.key === "dipbuyer" || d.key === "breakout" || d.key === "dca";
      return {
        ...d,
        trades, wins, net,
        wr: trades > 0 ? (wins / trades) * 100 : 0,
        open: counts[d.key] ?? 0,
        paused: isNewBot ? getRiskGuard(d.key).paused : false,
        edge: isNewBot ? getBotStat(d.key).edge : 1,
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
    settings.dipEnabled || settings.breakoutEnabled || settings.dcaEnabled || settings.fundingEnabled ||
    settings.optionsEnabled;

  const armAll = (on: boolean) => {
    update({
      enabled: on,
      strategy: on ? "BOTH" : settings.strategy,
      stocksEnabled: on, polyEnabled: on,
      dipEnabled: on, breakoutEnabled: on, dcaEnabled: on, fundingEnabled: on,
      optionsEnabled: on,
    });
  };

  // ── Speed-of-light cancel ("ביטול מסחר במהירות האור") ──
  // One emergency kill-switch: instantly disarm every bot, end any active boost
  // and close ALL bot-placed positions at the latest live price (falling back to
  // the entry price so nothing is ever left hanging open). Manual trades the user
  // opened by hand are untouched. Paper-trading only.
  const emergencyStop = () => {
    // Crypto: prefer the sub-second WS price, then the cached REST overview quote,
    // and only fall back to entry price if neither exists — so a position is never
    // left hanging open just because a single quote is missing.
    const bnPrices: Record<string, number> = {};
    for (const c of overview ?? []) bnPrices[c.asset] = c.price;
    for (const p of binancePositions) {
      if (!p.auto) continue;
      const live = getLivePrice(p.asset)?.price;
      if (live && Number.isFinite(live)) bnPrices[p.asset] = live;
      else if (!Number.isFinite(bnPrices[p.asset])) bnPrices[p.asset] = p.entryPrice;
    }
    // Stocks: cached REST quotes, entry price as a last resort.
    const stPrices: Record<string, number> = {};
    for (const s of stocks ?? []) stPrices[s.symbol] = s.price;
    for (const p of stockPositions) {
      if (p.auto && !Number.isFinite(stPrices[p.symbol])) stPrices[p.symbol] = p.entryPrice;
    }
    // Polymarket: mark each open side at its current live yes/no price; if the
    // market isn't in the live feed, closeAllBotPositions falls back to entry.
    const polyLive = new Map(((shortTerm ?? []) as PolymarketMarket[]).map((m) => [m.conditionId, m]));
    const polyPrices: Record<string, number> = {};
    for (const p of polyPositions) {
      if (!p.auto) continue;
      const m = polyLive.get(p.conditionId);
      if (m) polyPrices[p.conditionId] = p.side === "YES" ? m.yesPrice : m.noPrice;
    }
    const closed = closeAllBotPositions(bnPrices, stPrices, polyPrices);
    armAll(false);
    stopBoost();
    toast({
      title: "עצירת חירום — מסחר בוטל במהירות האור",
      description: closed > 0
        ? `כל הבוטים כובו ו-${closed} פוזיציות נסגרו מיידית.`
        : "כל הבוטים כובו. לא היו פוזיציות בוט פתוחות לסגירה.",
      variant: "destructive",
    });
  };

  // ── Cancel "light speed" — end the boost flood but KEEP trading calmly ──
  // Turning light-speed off must NOT stop the bots: they keep trading at the
  // normal, considered cadence (one sensible trade per opportunity, no flooding
  // many micro-trades onto the same position). Positions stay open; bots stay
  // armed. The full kill remains available via the separate "עצירת חירום" button.
  const cancelLightSpeed = () => {
    if (!boostActive) {
      toast({
        title: "מהירות האור כבר כבויה",
        description: "הבוטים סוחרים בקצב רגיל ושקול.",
      });
      return;
    }
    stopBoost();
    toast({
      title: "מהירות האור בוטלה",
      description: "הבוטים ממשיכים לסחור בקצב רגיל — עסקה אחת הגיונית לכל הזדמנות, בלי הצפה.",
    });
  };

  // ── Auto-Pilot ("אוטומטי") — one switch hands every trade decision to the system ──
  // When on, the engines size every trade themselves (margin, leverage and stake
  // from portfolio health/win-rate), set their own SL/TP, and run the full
  // management stack (smart exits, trailing, adaptive selectivity, risk manager,
  // daily loss guard). Paper-trading/educational only. Turning it on also arms
  // every bot so it is genuinely hands-off.
  const autoPilotOn = settings.autoPilotEnabled;
  const toggleAutoPilot = () => {
    if (autoPilotOn) {
      update({ autoPilotEnabled: false });
      toast({
        title: "מצב אוטומטי כבוי",
        description: "ההגדרות שנבחרו נשארות — אפשר לכוונן כל פרמטר ידנית.",
      });
      return;
    }
    update({
      autoPilotEnabled: true,
      dynamicCapitalEnabled: true,
      smartExitEnabled: true,
      trailingEnabled: true,
      adaptiveEnabled: true,
      riskManagerEnabled: true,
      alphaCoordinatorEnabled: true,
      catastrophicExitEnabled: true,
      dailyStopEnabled: true,
    });
    armAll(true);
    toast({
      title: "מצב אוטומטי מופעל",
      description: "המערכת מנהלת הכל לבד — מינוף, גודל עסקה, SL/TP וכל הפרמטרים נקבעים פר עסקה.",
    });
  };

  // ── Max Performance ("מצב מקסימום") — one tap pushes the whole fleet to the top ──
  // Sets max intensity, top fleet-wide leverage, the fastest cadence and the
  // highest open caps (all computed in effectiveSettings, so turning it off
  // restores the user's values), and arms every bot. It honors the user's
  // fixed-vs-dynamic sizing choice and KEEPS the $3,000 cash floor and the
  // auto-pause-on-losses risk guards active. Paper-trading/educational only.
  const maxPerfOn = settings.maxPerfEnabled;
  const toggleMaxPerf = () => {
    if (maxPerfOn) {
      update({ maxPerfEnabled: false });
      toast({
        title: "מצב מקסימום כבוי",
        description: "ההגדרות חוזרות לערכים שבחרת — עוצמה, מינוף ותקרות פוזיציות.",
      });
      return;
    }
    update({ maxPerfEnabled: true });
    armAll(true);
    toast({
      title: "מצב מקסימום מופעל",
      description: "כל הבוטים חמושים בעוצמה מקסימלית — מינוף, קצב ותקרות במקס. רשתות הביטחון ($3,000 ומגני ההפסד) נשארות פעילות.",
    });
  };

  const totalOpenAuto = binancePositions.filter((p) => p.auto).length +
    stockPositions.filter((p) => p.auto).length + polyPositions.filter((p) => p.auto).length +
    fundingPositions.filter((p) => p.auto).length + optionPositions.filter((p) => p.auto).length;

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
          <Button
            onClick={toggleAutoPilot}
            className="gap-2 font-mono font-bold"
            variant={autoPilotOn ? "default" : "outline"}
            aria-pressed={autoPilotOn}
            title="מצב אוטומטי מלא: המערכת קובעת מינוף, גודל עסקה, SL/TP וכל הפרמטרים — פר עסקה"
            style={autoPilotOn ? { boxShadow: "0 0 18px hsl(43 74% 52% / 0.5)" } : undefined}
          >
            <Sparkles className="h-4 w-4" />
            {autoPilotOn ? "אוטומטי פעיל" : "אוטומטי"}
          </Button>
          <Button
            onClick={toggleMaxPerf}
            className="gap-2 font-mono font-bold"
            variant={maxPerfOn ? "default" : "outline"}
            aria-pressed={maxPerfOn}
            title="מצב מקסימום: עוצמה, מינוף, קצב ותקרות פוזיציות במקסימום — מכבד בחירת סכום קבוע/דינמי ושומר על רצפת ה-$3,000 ומגני ההפסד"
            style={maxPerfOn ? { boxShadow: "0 0 18px hsl(43 74% 52% / 0.5)" } : undefined}
          >
            <Rocket className="h-4 w-4" />
            {maxPerfOn ? "מקסימום פעיל" : "מצב מקסימום"}
          </Button>
          <Button
            onClick={() => {
              const next = !settings.fleetPaused;
              update({ fleetPaused: next });
              toast({
                title: next ? "הצי מושהה" : "הצי חזר לפעולה",
                description: next
                  ? "הבוטים לא יפתחו עסקאות חדשות. פוזיציות פתוחות וניהול SL/TP ממשיכים לפעול."
                  : "הבוטים חוזרים לפתוח עסקאות חדשות בהתאם לאיתותים.",
              });
            }}
            className="gap-2 font-mono font-bold"
            variant={settings.fleetPaused ? "default" : "outline"}
            aria-pressed={settings.fleetPaused}
            title={settings.fleetPaused ? "בטל השהיה — הבוטים יחזרו לפתוח עסקאות" : "השהה את כל הבוטים — לא תיפתחנה עסקאות חדשות; פוזיציות קיימות ממשיכות"}
            style={settings.fleetPaused ? { boxShadow: "0 0 14px hsl(38 95% 60% / 0.45)" } : undefined}
          >
            {settings.fleetPaused ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
            {settings.fleetPaused ? "בטל השהיה" : "השהה בוטים"}
          </Button>
          <Button
            onClick={() => boostActive ? stopBoost() : startBoost(settings.boostDurationMin * 60_000)}
            className="gap-2 font-mono font-bold"
            variant={boostActive ? "default" : "outline"}
            aria-pressed={boostActive}
            title={boostActive ? "מכבה את מהירות האור" : "מפעיל את כל הבוטים במצב מסחר מהיר"}
            style={boostActive ? { boxShadow: "0 0 18px hsl(43 74% 52% / 0.5)" } : undefined}
          >
            <Zap className="h-4 w-4" />
            {boostActive ? "מהירות האור פעילה" : "מהירות האור"}
          </Button>
          {boostActive ? (
            <span className="font-mono text-base font-bold text-primary tabular-nums">{boostClock}</span>
          ) : (
            <select
              value={settings.boostDurationMin}
              onChange={(e) => update({ boostDurationMin: Number(e.target.value) })}
              className="h-9 rounded-md border border-primary/40 bg-background/60 px-2 text-xs font-mono text-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
              aria-label="Boost duration"
              title="משך הבוסט"
            >
              {BOOST_PRESETS.map((m) => (
                <option key={m} value={m}>{boostDurationLabel(m)}</option>
              ))}
            </select>
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
          <Button
            onClick={emergencyStop}
            variant="ghost"
            size="sm"
            className="gap-1.5 font-mono text-red-400 hover:text-red-300 hover:bg-red-500/10"
            title="עצירת חירום: מכבה את כל הבוטים וסוגר מיד את כל פוזיציות הבוט"
          >
            <Siren className="h-4 w-4" />
            עצירת חירום
          </Button>
        </div>
      </header>

      {settings.fleetPaused && (
        <div
          className="rounded-lg border px-4 py-2.5 flex items-center justify-between gap-3"
          style={{ borderColor: "hsl(38 95% 60% / 0.45)", background: "hsl(38 95% 60% / 0.06)" }}
          dir="rtl"
        >
          <div className="flex items-center gap-3 min-w-0">
            <PauseCircle className="h-4 w-4 text-amber-400 shrink-0" />
            <p className="text-[11px] text-muted-foreground">
              <span className="text-amber-400 font-semibold">הצי מושהה</span> — הבוטים לא יפתחו עסקאות חדשות. פוזיציות פתוחות ממשיכות להיות מנוהלות (SL/TP פעיל). לחץ &quot;בטל השהיה&quot; כדי לחדש את המסחר.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 gap-1.5 text-amber-400 border-amber-400/40 hover:bg-amber-400/10 font-mono text-xs"
            onClick={() => {
              update({ fleetPaused: false });
              toast({ title: "הצי חזר לפעולה", description: "הבוטים חוזרים לפתוח עסקאות חדשות בהתאם לאיתותים." });
            }}
          >
            <PlayCircle className="h-3.5 w-3.5" />
            בטל השהיה
          </Button>
        </div>
      )}

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

            {/* Earned control level — the master's track record turns into conviction */}
            <div className="relative mt-3 rounded-lg border border-primary/25 bg-primary/[0.06] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Trophy className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-bold">רמת שליטה של המאסטר</span>
                </div>
                <span className="text-sm font-black tabular-nums text-primary">{alpha.masteryScore}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-secondary/40 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${alpha.masteryScore}%`, background: "hsl(43 74% 52%)" }} />
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground leading-relaxed">
                {alpha.recentSample > 0
                  ? `נמדד מ-${alpha.recentSample} העסקאות האוטומטיות האחרונות (אחוז הצלחה ${alpha.recentWinRate}%). ככל שהמאסטר מצליח לאורך זמן הוא מקבל מעט יותר ביטחון בעסקאות התואמות לכיוון הצי — בגבול מבוקר, אף פעם לא בעסקאות נוגדות.`
                  : "עדיין אין מספיק עסקאות אוטומטיות שנסגרו כדי לדרג את המאסטר. רמת השליטה תיבנה מאחוז ההצלחה האמיתי שלו לאורך זמן."}
              </p>
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
        <StatChip label="Bots Active" value={`${[scalpOn, momOn, settings.stocksEnabled, settings.polyEnabled, settings.dipEnabled, settings.breakoutEnabled, settings.dcaEnabled, settings.fundingEnabled, settings.optionsEnabled].filter(Boolean).length} / 9`} />
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

      {/* ── Trade mode — סגנון מסחר: רגיל ↔ מחושב אקסטרא ↔ מצב שלומי ── */}
      {(() => {
        const mode = settings.tradeMode;
        const calc = mode === "CALCULATED";
        const shlomi = mode === "SHLOMI";
        const longTerm = calc || shlomi;
        const accent = shlomi ? "152 60% 50%" : calc ? "199 89% 55%" : "43 74% 52%";
        const setMode = (m: TradeMode) => update({ tradeMode: m });
        const HeaderIcon = shlomi ? Sparkles : Crosshair;
        const modeBtn = (
          target: TradeMode,
          active: boolean,
          Icon: typeof Rabbit,
          activeColor: string,
          shadow: string,
          title: string,
          sub: string,
        ) => (
          <button
            type="button"
            onClick={() => setMode(target)}
            aria-pressed={active}
            className={`flex items-center justify-center gap-2 rounded-md border p-3 transition-all ${
              active ? `${shadow}` : "border-border/60 bg-background/40 hover:bg-secondary/40"
            }`}
          >
            <Icon className={`h-4 w-4 ${active ? activeColor : "text-muted-foreground"}`} />
            <div className="text-right">
              <div className={`text-sm font-semibold leading-none ${active ? "text-foreground" : "text-muted-foreground"}`}>{title}</div>
              <div className="text-[9px] text-muted-foreground mt-0.5">{sub}</div>
            </div>
          </button>
        );
        const modeIdx = shlomi ? 2 : calc ? 1 : 0;
        const idxToMode = (v: number): TradeMode => (v >= 2 ? "SHLOMI" : v >= 1 ? "CALCULATED" : "NORMAL");
        return (
          <section className="rounded-lg border p-4" style={{ borderColor: `hsl(${accent} / 0.4)`, background: `hsl(${accent} / 0.05)` }} dir="rtl">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-md flex items-center justify-center shrink-0" style={{ background: `hsl(${accent} / 0.15)` }}>
                <HeaderIcon className="h-4 w-4" style={{ color: `hsl(${accent})` }} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold tracking-wide">סגנון מסחר — בורר לכל הבוטים</h2>
                <p className="text-[11px] text-muted-foreground">
                  בורר נוסף שמשפיע על <span className="text-foreground font-medium">כל הבוטים</span> יחד, בנוסף להילוך העוצמה. <span className="text-foreground font-medium">רגיל</span> — ההתנהגות הרגילה. <span className="text-foreground font-medium">מחושב אקסטרא</span> — מצב סבלני לטווח ארוך: בררני יותר, פחות עסקאות, נותן לרווחים לרוץ. <span style={{ color: "hsl(152 60% 50%)" }} className="font-medium">מצב שלומי</span> — הסוחר הנבון: הסבלנות הגבוהה ביותר, עסקאות לטווח ארוך, ניהול סיכונים ברמת-על, מינוף נמוך (עד {`x${2}`}) ומקסימום איכות לכל עסקה.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {modeBtn("NORMAL", mode === "NORMAL", Rabbit, "text-primary", "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(43_74%_52%/0.4)]", "רגיל", "קצב ובררנות לפי ההילוך")}
              {modeBtn("CALCULATED", calc, Turtle, "text-sky-400", "border-sky-400 bg-sky-400/10 shadow-[0_0_0_1px_hsl(199_89%_55%/0.45)]", "מחושב אקסטרא", "בררני וסבלני · טווח ארוך")}
              {modeBtn("SHLOMI", shlomi, Sparkles, "text-emerald-400", "border-emerald-400 bg-emerald-400/10 shadow-[0_0_0_1px_hsl(152_60%_50%/0.45)]", "מצב שלומי", "סוחר נבון · מינוף נמוך · איכות מקס")}
            </div>

            <div className="mt-4 px-1">
              <Slider
                value={[modeIdx]}
                min={0}
                max={2}
                step={1}
                onValueChange={(v) => setMode(idxToMode(v[0]))}
                aria-label="בורר סגנון מסחר"
                dir="rtl"
              />
              <div className="mt-1.5 flex items-center justify-between text-[9px] font-mono text-muted-foreground">
                <span className={mode === "NORMAL" ? "text-primary" : ""}>רגיל</span>
                <span className={calc ? "text-sky-400" : ""}>מחושב</span>
                <span className={shlomi ? "text-emerald-400" : ""}>שלומי</span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatChip label="מצב נוכחי" value={shlomi ? "מצב שלומי" : calc ? "מחושב אקסטרא" : "רגיל"} tone={longTerm ? "good" : undefined} />
              <StatChip label="בררנות" value={shlomi ? "קיצונית" : calc ? "מחמירה מאוד" : "לפי ההילוך"} tone={longTerm ? "good" : undefined} />
              <StatChip label="תדירות עסקאות" value={shlomi ? "מינימלית" : calc ? "נמוכה בהרבה" : "רגילה"} />
              <StatChip label="מינוף" value={shlomi ? "נמוך (עד x2)" : "לפי ההגדרות"} tone={shlomi ? "good" : undefined} />
            </div>
            {longTerm && boostActive && (
              <p className="mt-2 text-[10px] text-amber-400/90" dir="rtl">
                שים לב: בוסט פעיל דורס את הקצב למהיר ביותר וסותר את מצב טווח ארוך. כדאי לעצור את הבוסט כדי לתת למצב {shlomi ? "שלומי" : "המחושב"} לעבוד.
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

        {/* Per-bot roll-up — click any card to jump to that bot's settings */}
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {fleet.rows.map((r) => (
            <div
              key={r.key}
              role="button"
              tabIndex={0}
              title="לחץ להגדרות הבוט"
              onClick={() => {
                const el = document.getElementById(`bot-${r.key}`);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  const el = document.getElementById(`bot-${r.key}`);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
              className={`rounded-md border p-3 cursor-pointer transition-all hover:ring-1 hover:ring-primary/50 hover:shadow-[0_0_0_2px_hsl(43_74%_52%/0.15)] ${r.paused ? "border-red-500/40 bg-red-500/5" : r.armed ? "border-primary/40 bg-primary/5" : "border-border/60 bg-background/40"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <r.icon className={`h-3.5 w-3.5 shrink-0 ${r.armed ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-xs font-semibold truncate">{r.title}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded-full ${r.paused ? "bg-red-500/20 text-red-400" : r.armed ? "bg-emerald-500/15 text-emerald-400" : "bg-muted/40 text-muted-foreground"}`}>
                    {r.paused ? "הושהת" : r.armed ? "פעיל" : "כבוי"}
                  </span>
                  <span className="text-[8px] font-mono text-muted-foreground/40">↓ הגדרות</span>
                </div>
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
        const dyn = computeDynamicSizing(cash, totalDeposited, tradeHistory, settings.cashFloorPct);
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

            {/* Account Manager — cash reserve (never run the account dry) */}
            {(() => {
              const floor = (totalDeposited * Math.max(0, Math.min(90, settings.cashFloorPct))) / 100;
              const freeCash = Math.max(0, cash - floor);
              return (
                <div className="mt-3 rounded-md border border-border/40 bg-background/40 p-3" dir="rtl">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5" style={{ color: "hsl(196 80% 60%)" }} />
                      <span className="text-xs font-semibold">מנהל החשבון — רזרבת מזומן</span>
                    </div>
                    <span className="font-mono text-sm font-bold" style={{ color: "hsl(196 80% 60%)" }}>
                      {settings.cashFloorPct}%
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-2">
                    המנהל הוותיק שומר תמיד אחוז מההון כמזומן פנוי ואף פעם לא פותח עסקה שתוריד את המזומן מתחת לרצפה הזו — כך החשבון לא נתקע ליד אפס וממשיך לצמוח. מטרתו: למלא את החשבון במזומן.
                  </p>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    step={5}
                    value={settings.cashFloorPct}
                    onChange={(e) => update({ cashFloorPct: Number(e.target.value) })}
                    className="w-full accent-cyan-500"
                    aria-label="Cash reserve floor percent"
                  />
                  <div className="mt-2 grid grid-cols-3 gap-3">
                    <StatChip label="רצפת רזרבה" value={`$${floor.toFixed(0)}`} />
                    <StatChip label="מזומן פנוי למסחר" value={`$${freeCash.toFixed(0)}`} tone={freeCash > 0 ? "good" : "bad"} />
                    <StatChip
                      label="מצב מנהל"
                      value={dyn.recoveryMode ? "מצב התאוששות" : "צמיחה"}
                      tone={dyn.recoveryMode ? "bad" : "good"}
                    />
                  </div>
                  {dyn.recoveryMode && (
                    <p className="mt-2 text-[10px] text-amber-400">
                      מצב התאוששות פעיל — המנהל מקטין פוזיציות ומגביל מינוף (עד 3x) כדי להגן על ההון שנותר עד שהחשבון יתמלא מחדש.
                    </p>
                  )}
                </div>
              );
            })()}
          </section>
        );
      })()}

      {/* ── Global fleet overrides ── */}
      <section className="rounded-lg border p-4" style={{ borderColor: "hsl(43 74% 52% / 0.35)", background: "hsl(43 74% 52% / 0.04)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
              <Layers className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-wide">הגדרות גלובליות לכל הבוטים</h2>
              <p className="text-[11px] text-muted-foreground" dir="rtl">
                מינוף וסכום השקעה אחיד לכל הבוטים בבת אחת. הגדרות האלה מופעלות את ההגדרות המקומיות של כל בוט.
                {settings.dynamicCapitalEnabled && <span className="text-amber-400 font-semibold"> (מושבת בזמן שהמנהל הדינמי פעיל.)</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Global leverage */}
        <div className="mt-3 rounded-md border border-border/40 bg-background/40 p-3" dir="rtl">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">מינוף גלובלי</span>
              <span className="font-mono text-sm font-bold text-primary">{settings.globalLeverage}x</span>
            </div>
            <Switch
              checked={settings.globalLeverageEnabled}
              onCheckedChange={(v) => update({ globalLeverageEnabled: v })}
              aria-label="Toggle global leverage"
              disabled={settings.dynamicCapitalEnabled}
            />
          </div>
          <Slider
            value={[settings.globalLeverage]}
            min={1}
            max={10}
            step={1}
            onValueChange={([v]) => update({ globalLeverage: v })}
            disabled={!settings.globalLeverageEnabled || settings.dynamicCapitalEnabled}
            className="w-full"
            aria-label="Global leverage"
          />
          <p className="mt-2 text-[10px] text-muted-foreground">
            {settings.globalLeverageEnabled
              ? `כל הבוטים סוחרים במינוף ${settings.globalLeverage}x. ההגדרות האישיות של כל בוט מושבתות זמנית.`
              : "כל בוט משתמש בהגדרת המינוף של עצמו."}
          </p>
        </div>

        {/* Fixed amount */}
        <div className="mt-3 rounded-md border border-border/40 bg-background/40 p-3" dir="rtl">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">סכום השקעה קבוע</span>
              <span className="font-mono text-sm font-bold text-primary">${settings.fixedAmount}</span>
            </div>
            <Switch
              checked={settings.fixedAmountEnabled}
              onCheckedChange={(v) => update({ fixedAmountEnabled: v })}
              aria-label="Toggle fixed amount"
              disabled={settings.dynamicCapitalEnabled}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">$</span>
            <Input
              type="number"
              min={10}
              max={10000}
              step={10}
              value={settings.fixedAmount}
              onChange={(e) => update({ fixedAmount: Math.max(10, Math.min(10000, Number(e.target.value) || 10)) })}
              disabled={!settings.fixedAmountEnabled || settings.dynamicCapitalEnabled}
              className="h-8 font-mono text-sm bg-background/60"
              aria-label="Fixed amount USD"
            />
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            {settings.fixedAmountEnabled
              ? `כל הבוטים משקיעים $${settings.fixedAmount} לעסקה. ההגדרות האישיות של כל בוט מושבתות זמנית.`
              : "כל בוט משתמש בהגדרת הסכום של עצמו."}
          </p>
        </div>
      </section>

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
                id={`bot-${b.id}`}
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
          <BotCard
            id="bot-funding"
            icon={Coins}
            title="Funding Arb Agent"
            subtitle="Delta-neutral cash-and-carry"
            hint="פותח פוזיציות דלתא-נייטרל (בסיס + פרפ הפוך) שצוברות מימון מדומה — לימודי בלבד, ללא הבטחת תשואה"
            active={settings.fundingEnabled}
            onToggle={(v) => update({ fundingEnabled: v })}
            open={counts.funding}
          >
            <div className="grid grid-cols-2 gap-3">
              <NumField
                label="Stake $ / leg"
                value={settings.fundingStake}
                min={10}
                step={10}
                onChange={(v) => update({ fundingStake: v })}
              />
              <NumField
                label="Max Open"
                value={settings.fundingMaxOpen}
                min={1}
                max={50}
                onChange={(v) => update({ fundingMaxOpen: v })}
              />
              <NumField
                label="מימון מינ' (% שנתי)"
                value={settings.fundingMinAnnualizedPct}
                min={1}
                step={1}
                onChange={(v) => update({ fundingMinAnnualizedPct: v })}
              />
            </div>
          </BotCard>
          <BotCard
            id="bot-options"
            icon={Sparkles}
            title="Options Agent"
            subtitle="Long CALL / PUT convexity"
            hint="קונה אופציות CALL/PUT לונג בלבד על קריפטו ומניות לפי האותות החזקים — ההפסד המרבי הוא הפרמיה ששולמה בלבד. מדומה ולימודי בלבד, ללא הבטחת תשואה"
            active={settings.optionsEnabled}
            onToggle={(v) => update({ optionsEnabled: v })}
            open={counts.options}
          >
            <div className="grid grid-cols-2 gap-3">
              <NumField
                label="פרמיה $ / עסקה"
                value={settings.optionStakePerTrade}
                min={10}
                step={10}
                onChange={(v) => update({ optionStakePerTrade: v })}
              />
              <NumField
                label="Max Open"
                value={settings.optionMaxOpen}
                min={1}
                max={50}
                onChange={(v) => update({ optionMaxOpen: v })}
              />
              <NumField
                label="ביטחון מינ' %"
                value={settings.optionMinConfidence}
                min={1}
                max={100}
                onChange={(v) => update({ optionMinConfidence: v })}
              />
              <NumField
                label="תפוגה (ימים)"
                value={settings.optionExpiryDays}
                min={1}
                max={90}
                onChange={(v) => update({ optionExpiryDays: v })}
              />
            </div>
          </BotCard>
        </div>
      </section>

      {/* Scalp Squad — five coordinated scalp bots under one master switch */}
      <section id="bot-scalp" className="space-y-3 scroll-mt-24">
        <div
          className="rounded-lg border border-border bg-secondary/20 p-4 transition-all"
          style={scalpOn ? { borderColor: "hsl(32 84% 55% / 0.5)", boxShadow: "0 0 0 1px hsl(32 84% 55% / 0.25)" } : {}}
        >
          {/* Squad header + master arm/disarm */}
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 h-9 w-9 shrink-0 rounded-md flex items-center justify-center"
              style={{ background: scalpOn ? "hsl(32 84% 55% / 0.15)" : "hsl(0 0% 12%)" }}
            >
              <Network className={`h-4 w-4 ${scalpOn ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold tracking-wide truncate">Scalp Squad · חמ״ל הסקאלפרים</h3>
                <Switch checked={scalpOn} onCheckedChange={(v) => applyCrypto(v, momOn)} aria-label="Toggle Scalp Squad" />
              </div>
              <p className="text-[11px] text-muted-foreground">5 בוטים מתואמים שמחלקים ביניהם את איתותי הסקאלפ</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5" dir="rtl">
                כל בוט מתמחה בפלח אחר (לונג / שורט / חזק / זריז / גיבוי); שניים לא נכנסים לאותו מטבע אלא בקונצנזוס גבוה
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[10px] font-mono text-muted-foreground">
              {squadOpen > 0 ? (
                <span className="text-primary">{squadOpen} פוזיציות פתוחות</span>
              ) : (
                <span>אין פוזיציות פתוחות</span>
              )}
            </span>
            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${scalpOn ? "bg-emerald-500/15 text-emerald-400" : "bg-muted/40 text-muted-foreground"}`}>
              {scalpOn ? "ON" : "OFF"}
            </span>
          </div>

          {/* Member roster */}
          <div className="mt-3 pt-3 border-t border-border/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {squadRows.map(({ member, open, trades, wins, net }) => {
              const Icon = SQUAD_ICONS[member.id] ?? Gauge;
              return (
                <div
                  key={member.id}
                  className="rounded-md border border-border/60 bg-background/40 p-3"
                  style={scalpOn && open > 0 ? { borderColor: "hsl(32 84% 55% / 0.4)" } : {}}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 shrink-0 rounded-md flex items-center justify-center" style={{ background: scalpOn ? "hsl(32 84% 55% / 0.12)" : "hsl(0 0% 12%)" }}>
                      <Icon className={`h-3.5 w-3.5 ${scalpOn ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <h4 className="text-xs font-semibold truncate" dir="rtl">{member.name}</h4>
                        <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-muted/40 text-muted-foreground shrink-0">{member.role}</span>
                      </div>
                      <p className="text-[9px] text-muted-foreground/70 leading-tight mt-0.5" dir="rtl">{member.tagline}</p>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1">
                    <StatChip label="פתוח" value={String(open)} tone={open > 0 ? "good" : undefined} />
                    <StatChip label="עסקאות" value={trades > 0 ? `${wins}/${trades}` : "—"} />
                    <StatChip label="רווח" value={trades > 0 ? `${net >= 0 ? "+" : "-"}$${Math.abs(Math.round(net))}` : "—"} tone={trades > 0 ? (net >= 0 ? "good" : "bad") : undefined} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live comms feed */}
          <div className="mt-3 pt-3 border-t border-border/60">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Megaphone className="h-3 w-3" /> תקשורת הצוות
              </h4>
              {comms.length > 0 && (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1 text-muted-foreground" onClick={clearSquadMessages}>
                  <RotateCcw className="h-3 w-3" /> ניקוי
                </Button>
              )}
            </div>
            <div className="max-h-44 overflow-y-auto space-y-1 pr-1" dir="rtl">
              {comms.length === 0 ? (
                <p className="text-[10px] text-muted-foreground/60 py-3 text-center">
                  {scalpOn ? "ממתין לאיתותים — הצוות ידווח על כניסות, יציאות וגיבוי בזמן אמת." : "הפעל את הצוות כדי לראות תקשורת חיה."}
                </p>
              ) : (
                comms.map((m) => (
                  <div key={m.id} className="flex items-start gap-2 text-[10px] font-mono leading-snug">
                    <span className="text-muted-foreground/50 tabular-nums shrink-0" dir="ltr">{commsClock(m.at)}</span>
                    <span className={`${COMMS_TONE[m.kind]} min-w-0`}>{m.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Existing core bots */}
      <section className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5" /> בוטים קיימים
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <BotCard id="bot-momentum" icon={Rocket} title="Momentum Bot" subtitle="Volume-surge runners" hint="רוכב על מטבעות עם זינוק נפח ומומנטום" active={momOn} onToggle={(v) => applyCrypto(scalpOn, v)} open={counts.momentum} />
          <BotCard id="bot-smart" icon={Megaphone} title="Smart-Money Stocks" subtitle="Technical + influencer fusion" hint="מניות לפי שילוב טכני וסנטימנט משפיענים" active={settings.stocksEnabled} onToggle={(v) => update({ stocksEnabled: v })} open={counts.smart} />
          <BotCard id="bot-poly" icon={Timer} title="Polymarket BTC" subtitle="Same-day up/down bets" hint="הימורי כיוון יומיים על ביטקוין" active={settings.polyEnabled} onToggle={(v) => update({ polyEnabled: v })} open={counts.poly} />
        </div>
      </section>

      <p className="text-[10px] text-muted-foreground/70 text-center flex items-center justify-center gap-1.5" dir="rtl">
        <Activity className="h-3 w-3" />
        כל הבוטים פועלים על תיק נייר (paper trading) בלבד — אין כאן כסף אמיתי או ייעוץ השקעות.
      </p>
    </div>
  );
}
