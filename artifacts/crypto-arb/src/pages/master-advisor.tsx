import { useMemo, useState } from "react";
import {
  Compass, Languages, Check, X, ShieldCheck, Siren, TrendingDown, TrendingUp,
  Gauge, Rocket, Zap, Wallet, Scissors, Brain, Turtle, Sparkles, Activity,
  ArrowUpRight, ArrowDownRight, Minus, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePortfolio } from "@/contexts/portfolio-context";
import { useAutoTrader, type TradeMode } from "@/contexts/autotrader-context";
import { useLivePrices } from "@/contexts/live-price-context";
import { toast } from "@/hooks/use-toast";
import {
  useGetMarketOverview, getGetMarketOverviewQueryKey,
  useGetScalpSignals, getGetScalpSignalsQueryKey,
  useGetMomentumCoins, getGetMomentumCoinsQueryKey,
  useGetStockRecommendations, getGetStockRecommendationsQueryKey,
  useGetShortTermMarkets, getGetShortTermMarketsQueryKey,
  useGetMarketMovers, getGetMarketMoversQueryKey,
  useGetStocks, getGetStocksQueryKey,
  type PolymarketMarket,
} from "@workspace/api-client-react";
import {
  buildAdvisorRead, buildAdvisorMoves, classifyBots,
  type AdvisorSnapshot, type AdvisorMove, type AdvisorActionSpec,
  type AdvisorIcon, type Lang, type MoveTone, type AdvisorBot,
} from "@/lib/master-advisor";

/** Bot keys + bilingual labels + closed-trade attribution (mirrors Bot Command). */
const BOT_DEFS: { key: string; he: string; en: string; match: (src: string, type: string) => boolean }[] = [
  { key: "scalp", he: "בוט סקאלפ", en: "Scalp Bot", match: (src) => src.includes("Scalp") },
  { key: "momentum", he: "בוט מומנטום", en: "Momentum Bot", match: (src) => src.includes("Momentum") },
  { key: "smart", he: "כסף חכם", en: "Smart-Money", match: (src) => src.includes("Smart-Money") },
  { key: "poly", he: "פולימרקט BTC", en: "Polymarket BTC", match: (src, type) => type === "POLYMARKET" && src === "Polymarket BTC" },
  { key: "dipbuyer", he: "קונה ירידות", en: "Dip Buyer", match: (src) => src === "Dip Buyer" },
  { key: "breakout", he: "צייד פריצות", en: "Breakout Hunter", match: (src) => src === "Breakout Hunter" },
  { key: "dca", he: "DCA שבבי-כחול", en: "Blue-Chip DCA", match: (src) => src === "Blue-Chip DCA" },
];

const ICONS: Record<AdvisorIcon, React.ComponentType<{ className?: string }>> = {
  shield: ShieldCheck, siren: Siren, trendingDown: TrendingDown, trendingUp: TrendingUp,
  gauge: Gauge, rocket: Rocket, zap: Zap, wallet: Wallet, scissors: Scissors,
  brain: Brain, turtle: Turtle, sparkles: Sparkles,
};

const TONE_STYLE: Record<MoveTone, { border: string; bg: string; chip: string; label: { he: string; en: string } }> = {
  critical: {
    border: "hsl(0 72% 51% / 0.4)", bg: "hsl(0 72% 51% / 0.05)",
    chip: "bg-red-500/15 text-red-400", label: { he: "הגנה", en: "Protect" },
  },
  opportunity: {
    border: "hsl(207 30% 70% / 0.45)", bg: "hsl(207 30% 70% / 0.05)",
    chip: "bg-primary/15 text-primary", label: { he: "הזדמנות", en: "Opportunity" },
  },
  tune: {
    border: "hsl(39 28% 72% / 0.35)", bg: "hsl(39 28% 72% / 0.04)",
    chip: "bg-cyan-500/15 text-cyan-400", label: { he: "כוונון", en: "Tune-up" },
  },
};

/** Today's realized PnL across the wallet's closed trades. */
function realizedToday(history: { pnl: number; closedAt: string }[]): number {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  return history
    .filter((h) => new Date(h.closedAt) >= start)
    .reduce((a, h) => a + h.pnl, 0);
}

export default function MasterAdvisor() {
  const [lang, setLang] = useState<Lang>("he");
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const he = lang === "he";

  const {
    cash, totalDeposited, tradeHistory,
    binancePositions, stockPositions, polyPositions,
    closeAllBotPositions, wallets, activeWalletId,
  } = usePortfolio();
  const { settings, update, startBoost, alpha, getBotStat, getRiskGuard } = useAutoTrader();
  const { get: getLivePrice } = useLivePrices();

  // Shared query keys + cadence with the rest of the app → no extra fan-out.
  const { data: overview } = useGetMarketOverview({
    query: { queryKey: getGetMarketOverviewQueryKey(), refetchInterval: 30000, staleTime: 20000 },
  });
  const { data: scalp } = useGetScalpSignals({
    query: { queryKey: getGetScalpSignalsQueryKey(), refetchInterval: 60000, staleTime: 45000 },
  });
  const { data: momentum } = useGetMomentumCoins({
    query: { queryKey: getGetMomentumCoinsQueryKey(), refetchInterval: 60000, staleTime: 45000 },
  });
  const { data: stockRecs } = useGetStockRecommendations({
    query: { queryKey: getGetStockRecommendationsQueryKey(), refetchInterval: 60000, staleTime: 45000 },
  });
  const { data: shortTerm } = useGetShortTermMarkets({
    query: { queryKey: getGetShortTermMarketsQueryKey(), refetchInterval: 90000, staleTime: 60000 },
  });
  const { data: movers } = useGetMarketMovers({
    query: { queryKey: getGetMarketMoversQueryKey(), refetchInterval: 180000, staleTime: 120000 },
  });
  const { data: stocks } = useGetStocks({
    query: { queryKey: getGetStocksQueryKey(), refetchInterval: 30000, staleTime: 20000 },
  });

  const snapshot = useMemo<AdvisorSnapshot>(() => {
    const coins = overview ?? [];
    const btc = coins.find((c) => c.asset === "BTC");
    const avgChange = coins.length ? coins.reduce((s, c) => s + c.changePercent, 0) / coins.length : 0;

    // Estimated equity = free cash + capital committed to open positions (margin /
    // cost), so locked margin isn't mistaken for a loss. MTM-agnostic on purpose.
    const committed =
      binancePositions.reduce((a, p) => a + p.notional / Math.max(1, p.leverage), 0) +
      stockPositions.reduce((a, p) => a + p.cost, 0) +
      polyPositions.reduce((a, p) => a + p.cost, 0);
    const estEquity = cash + committed;
    const drawdownPct = totalDeposited > 0 ? Math.max(0, ((totalDeposited - estEquity) / totalDeposited) * 100) : 0;
    const dailyRealizedPct = totalDeposited > 0 ? (realizedToday(tradeHistory) / totalDeposited) * 100 : 0;

    const scalpOn = settings.enabled && (settings.strategy === "SCALP" || settings.strategy === "BOTH");
    const momOn = settings.enabled && (settings.strategy === "MOMENTUM" || settings.strategy === "BOTH");
    const anyBotsOn = scalpOn || momOn || settings.stocksEnabled || settings.polyEnabled ||
      settings.dipEnabled || settings.breakoutEnabled || settings.dcaEnabled;

    const openAuto = binancePositions.filter((p) => p.auto).length +
      stockPositions.filter((p) => p.auto).length + polyPositions.filter((p) => p.auto).length;

    // ── Per-bot standing (active wallet): realized track record by `source`,
    // armed state + risk-pause + adaptive edge — mirrors the Bot Command roll-up.
    const armedFor: Record<string, boolean> = {
      scalp: scalpOn, momentum: momOn, smart: settings.stocksEnabled, poly: settings.polyEnabled,
      dipbuyer: settings.dipEnabled, breakout: settings.breakoutEnabled, dca: settings.dcaEnabled,
    };
    const openFor: Record<string, number> = {
      scalp: binancePositions.filter((p) => (p.source ?? "").includes("Scalp")).length,
      momentum: binancePositions.filter((p) => (p.source ?? "").includes("Momentum")).length,
      smart: stockPositions.filter((p) => (p.source ?? "").includes("Smart-Money")).length,
      poly: polyPositions.filter((p) => p.source === "Polymarket BTC").length,
      dipbuyer: binancePositions.filter((p) => p.source === "Dip Buyer").length,
      breakout: binancePositions.filter((p) => p.source === "Breakout Hunter").length,
      dca: stockPositions.filter((p) => p.source === "Blue-Chip DCA").length,
    };
    const bots: AdvisorBot[] = BOT_DEFS.map((d) => {
      const ts = tradeHistory.filter((t) => d.match(t.source ?? "", t.type ?? ""));
      const trades = ts.length;
      const wins = ts.filter((t) => t.pnl > 0).length;
      const net = ts.reduce((a, t) => a + t.pnl, 0);
      return {
        key: d.key, he: d.he, en: d.en,
        armed: armedFor[d.key] ?? false,
        paused: getRiskGuard(d.key).paused,
        trades, wins,
        winRate: trades > 0 ? (wins / trades) * 100 : 0,
        net,
        open: openFor[d.key] ?? 0,
        edge: getBotStat(d.key).edge,
      };
    });

    // ── Multi-wallet health (cash buffer per wallet) for cross-portfolio ranking.
    const advisorWallets = wallets.map((w) => ({
      id: w.id, name: w.name,
      cashRatio: w.totalDeposited > 0 ? w.cash / w.totalDeposited : 1,
      openPositions: w.openPositions,
      active: w.id === activeWalletId,
    }));

    // ── Cross-source signal strength, distilled from every live feed. ──
    const scalpLongHigh = (scalp ?? []).filter((x) => x.confidence === "HIGH" && x.direction === "LONG").length;
    const scalpShortHigh = (scalp ?? []).filter((x) => x.confidence === "HIGH" && x.direction === "SHORT").length;
    const momentumSurges = (momentum ?? []).filter((x) => x.rvol >= 3 && x.roc15m > 0).length;
    const stockBuyHigh = (stockRecs ?? []).filter((x) => x.action === "BUY" && x.confidence === "HIGH").length;
    const stockSellHigh = (stockRecs ?? []).filter((x) => x.action === "SELL" && x.confidence === "HIGH").length;
    const polyStrong = ((shortTerm ?? []) as PolymarketMarket[]).filter((m) => Math.max(m.yesPrice, m.noPrice) >= 0.72).length;
    // How many distinct sources lean the same way as the fleet's alpha read.
    let sourcesAgreeing = 0;
    if (alpha.direction === "LONG") {
      if (scalpLongHigh > scalpShortHigh) sourcesAgreeing++;
      if (momentumSurges > 0) sourcesAgreeing++;
      if (stockBuyHigh > stockSellHigh) sourcesAgreeing++;
      if ((btc?.changePercent ?? 0) > 0) sourcesAgreeing++;
    } else if (alpha.direction === "SHORT") {
      if (scalpShortHigh > scalpLongHigh) sourcesAgreeing++;
      if (stockSellHigh > stockBuyHigh) sourcesAgreeing++;
      if ((btc?.changePercent ?? 0) < 0) sourcesAgreeing++;
    }

    return {
      btcChange: btc ? btc.changePercent : null,
      avgChange,
      fearGreed: movers?.fearGreed?.value ?? null,
      alpha,
      signals: { scalpLongHigh, scalpShortHigh, momentumSurges, stockBuyHigh, stockSellHigh, polyStrong, sourcesAgreeing },
      cashRatio: totalDeposited > 0 ? cash / totalDeposited : 1,
      drawdownPct,
      dailyRealizedPct,
      openAuto,
      bots,
      wallets: advisorWallets,
      anyBotsOn,
      autoPilotOn: settings.autoPilotEnabled,
      alphaEnabled: settings.alphaCoordinatorEnabled,
      riskManagerEnabled: settings.riskManagerEnabled,
      smartExitEnabled: settings.smartExitEnabled,
      dailyStopEnabled: settings.dailyStopEnabled,
      intensity: settings.intensity,
      tradeMode: settings.tradeMode,
      cashFloorPct: settings.cashFloorPct,
    };
  }, [overview, movers, alpha, cash, totalDeposited, tradeHistory, binancePositions, stockPositions, polyPositions, settings, wallets, activeWalletId, scalp, momentum, stockRecs, shortTerm, getBotStat, getRiskGuard]);

  const read = useMemo(() => buildAdvisorRead(snapshot), [snapshot]);
  const moves = useMemo(
    () => buildAdvisorMoves(snapshot).filter((m) => !dismissed.has(m.id)).slice(0, 6),
    [snapshot, dismissed],
  );

  // ── Fleet standing for the briefing: good / weak / paused buckets ──
  const fleetView = useMemo(() => {
    const { rated, good, weak, paused } = classifyBots(snapshot.bots);
    const goodKeys = new Set(good.map((b) => b.key));
    const weakKeys = new Set(weak.map((b) => b.key));
    const rows = snapshot.bots
      .filter((b) => b.armed || b.trades > 0)
      .map((b) => {
        const standing: "good" | "weak" | "neutral" = b.paused
          ? "weak"
          : goodKeys.has(b.key) ? "good" : weakKeys.has(b.key) ? "weak" : "neutral";
        return { ...b, standing };
      });
    return { rows, good: good.length, weak: weak.length, paused: paused.length, ratedCount: rated.length };
  }, [snapshot.bots]);

  // ── Wallet ranking by free-cash buffer (only meaningful with >1 wallet) ──
  const walletRanking = useMemo(
    () => (snapshot.wallets.length > 1
      ? [...snapshot.wallets].sort((a, b) => b.cashRatio - a.cashRatio)
      : []),
    [snapshot.wallets],
  );

  // ── Watch list (educational, no action) — top live setups from each source ──
  const watching = useMemo(() => {
    const items: { icon: React.ComponentType<{ className?: string }>; text: string; tone: "up" | "down" | "flat" }[] = [];
    const s = (scalp ?? []).find((x) => x.confidence === "HIGH");
    if (s) {
      const up = s.direction === "LONG";
      items.push({
        icon: up ? TrendingUp : TrendingDown,
        tone: up ? "up" : "down",
        text: he
          ? `סקאלפ: ${s.asset} בכיוון ${up ? "עולה" : "יורד"} בביטחון גבוה — נקודה לעקוב אחריה.`
          : `Scalp: ${s.asset} leaning ${up ? "up" : "down"} at high confidence — one to watch.`,
      });
    }
    const m = (momentum ?? []).find((x) => x.rvol >= 3 && x.roc15m > 0);
    if (m) {
      items.push({
        icon: Rocket, tone: "up",
        text: he
          ? `מומנטום: ${m.asset} עם זינוק נפח חריג — תרחיש לימוד של פריצה.`
          : `Momentum: ${m.asset} on an unusual volume surge — a breakout to study.`,
      });
    }
    const b = (stockRecs ?? []).find((x) => x.action === "BUY" && x.confidence === "HIGH");
    if (b) {
      items.push({
        icon: ArrowUpRight, tone: "up",
        text: he
          ? `כסף חכם: ${b.symbol} מסומן לקנייה בביטחון גבוה — שווה מעקב.`
          : `Smart money: ${b.symbol} flagged BUY at high confidence — worth tracking.`,
      });
    }
    return items;
  }, [scalp, momentum, stockRecs, he]);

  function armAll(on: boolean) {
    update({
      enabled: on,
      strategy: on ? "BOTH" : settings.strategy,
      stocksEnabled: on, polyEnabled: on,
      dipEnabled: on, breakoutEnabled: on, dcaEnabled: on,
    });
  }

  function closeBotPositions(): number {
    // Mirror the Bot Command Center emergency-close: prefer the sub-second WS
    // price, then the cached REST quote, then entry price so nothing hangs open.
    const bnPrices: Record<string, number> = {};
    for (const c of overview ?? []) bnPrices[c.asset] = c.price;
    for (const p of binancePositions) {
      if (!p.auto) continue;
      const live = getLivePrice(p.asset)?.price;
      if (live && Number.isFinite(live)) bnPrices[p.asset] = live;
      else if (!Number.isFinite(bnPrices[p.asset])) bnPrices[p.asset] = p.entryPrice;
    }
    const stPrices: Record<string, number> = {};
    for (const s of stocks ?? []) stPrices[s.symbol] = s.price;
    for (const p of stockPositions) {
      if (p.auto && !Number.isFinite(stPrices[p.symbol])) stPrices[p.symbol] = p.entryPrice;
    }
    const polyLive = new Map(((shortTerm ?? []) as PolymarketMarket[]).map((m) => [m.conditionId, m]));
    const polyPrices: Record<string, number> = {};
    for (const p of polyPositions) {
      if (!p.auto) continue;
      const m = polyLive.get(p.conditionId);
      if (m) polyPrices[p.conditionId] = p.side === "YES" ? m.yesPrice : m.noPrice;
    }
    return closeAllBotPositions(bnPrices, stPrices, polyPrices);
  }

  function runAction(spec: AdvisorActionSpec): string {
    switch (spec.kind) {
      case "ARM_ALL": armAll(true); return he ? "כל הבוטים חומשו." : "All bots armed.";
      case "DISARM_ALL": armAll(false); return he ? "כל הבוטים כובו." : "All bots disarmed.";
      case "SET_INTENSITY":
        update({ intensity: spec.intensity ?? settings.intensity });
        return he ? `הילוך המסחר עודכן לדרגה ${spec.intensity}.` : `Trading gear set to level ${spec.intensity}.`;
      case "SET_TRADE_MODE":
        update({ tradeMode: (spec.tradeMode ?? "NORMAL") as TradeMode });
        return he
          ? `מצב המסחר עודכן ל${spec.tradeMode === "CALCULATED" ? "מחושב" : "רגיל"}.`
          : `Trade mode set to ${spec.tradeMode === "CALCULATED" ? "Calculated" : "Normal"}.`;
      case "SET_CASH_FLOOR":
        update({ cashFloorPct: spec.cashFloorPct ?? settings.cashFloorPct });
        return he ? `רזרבת המזומן נקבעה ל-${spec.cashFloorPct} אחוז.` : `Cash reserve set to ${spec.cashFloorPct} percent.`;
      case "ENABLE_AUTOPILOT":
        update({
          autoPilotEnabled: true, dynamicCapitalEnabled: true, smartExitEnabled: true,
          trailingEnabled: true, adaptiveEnabled: true, riskManagerEnabled: true,
          alphaCoordinatorEnabled: true, catastrophicExitEnabled: true, dailyStopEnabled: true,
        });
        armAll(true);
        return he ? "מצב אוטומטי מלא הופעל." : "Full Auto-Pilot enabled.";
      case "ENABLE_ALPHA":
        update({ alphaCoordinatorEnabled: true });
        return he ? "מתאם האלפא הודלק." : "Alpha Coordinator enabled.";
      case "START_BOOST":
        startBoost(settings.boostDurationMin * 60_000);
        return he ? "בוסט הופעל." : "Boost started.";
      case "ENABLE_RISK_MANAGER":
        update({ riskManagerEnabled: true });
        return he ? "מנהל הסיכונים הודלק." : "Risk Manager enabled.";
      case "ENABLE_SMART_EXIT":
        update({ smartExitEnabled: true });
        return he ? "סגירה חכמה הודלקה." : "Smart Exit enabled.";
      case "ENABLE_DAILY_STOP":
        update({ dailyStopEnabled: true });
        return he ? "עצירת הפסד יומית הודלקה." : "Daily loss stop enabled.";
      case "CLOSE_BOT_POSITIONS": {
        const n = closeBotPositions();
        return he
          ? n > 0 ? `${n} פוזיציות בוט נסגרו.` : "לא היו פוזיציות בוט פתוחות."
          : n > 0 ? `${n} bot positions closed.` : "No open bot positions.";
      }
      default: return "";
    }
  }

  function approve(m: AdvisorMove) {
    const result = runAction(m.action);
    setDismissed((prev) => new Set(prev).add(m.id));
    toast({ title: he ? "היועץ ביצע את המהלך" : "Advisor applied the move", description: result });
  }

  function dismiss(m: AdvisorMove) {
    setDismissed((prev) => new Set(prev).add(m.id));
  }

  const t = read[lang];
  const regimeIcon = read.regime === "RISK_ON" ? ArrowUpRight : read.regime === "RISK_OFF" ? ArrowDownRight : Minus;
  const RegimeIcon = regimeIcon;
  const regimeColor = read.regime === "RISK_ON" ? "text-emerald-400" : read.regime === "RISK_OFF" ? "text-red-400" : "text-cyan-400";

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6" dir={he ? "rtl" : "ltr"}>
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:pr-44">
        <div className="flex items-center gap-3">
          <div
            className="h-11 w-11 shrink-0 rounded-xl flex items-center justify-center"
            style={{ background: "hsl(207 30% 70% / 0.12)", boxShadow: "0 0 18px hsl(207 30% 70% / 0.25)" }}
          >
            <Compass className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              {he ? "היועץ הראשי" : "Master Advisor"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {he
                ? "קריאה אחת מסכמת של השוק והתיק, עם מהלכים מדורגים לאישורך — סימולציה בלבד."
                : "One synthesized read of the market and your book, with ranked moves for your approval — simulation only."}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 font-mono shrink-0"
          onClick={() => setLang((p) => (p === "he" ? "en" : "he"))}
          aria-label="Toggle language"
        >
          <Languages className="h-4 w-4" />
          {he ? "English" : "עברית"}
        </Button>
      </header>

      {/* Educational disclaimer */}
      <div
        className="rounded-lg border px-4 py-2.5 flex items-start gap-2.5"
        style={{ borderColor: "hsl(207 30% 70% / 0.4)", background: "hsl(207 30% 70% / 0.06)" }}
      >
        <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {he
            ? "היועץ הראשי הוא מנוע חוקים חינוכי בלבד — הוא אינו AI, אינו מבטיח רווחים ואינו ייעוץ השקעות. כל מהלך הוא תרחיש ללימוד שמופעל רק לאחר שתאשר אותו, על תיק נייר."
            : "The Master Advisor is a rule-based educational engine only — not AI, no promised returns, not financial advice. Every move is a learning scenario that runs only after you approve it, on a paper portfolio."}
        </p>
      </div>

      {/* The top-level read */}
      <section className="rounded-xl border border-border bg-secondary/20 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-mono uppercase tracking-[0.2em] text-muted-foreground">
            {he ? "הקריאה של היועץ" : "The Advisor's read"}
          </h2>
        </div>
        <div className="flex items-start gap-3">
          <RegimeIcon className={`h-7 w-7 shrink-0 ${regimeColor}`} />
          <div className="min-w-0">
            <p className={`text-lg font-bold ${regimeColor}`}>{t.tag}</p>
            <p className="text-sm text-foreground/90 mt-1 leading-relaxed">{t.headline}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/60 bg-background/40 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{he ? "שוק" : "Market"}</span>
            </div>
            <p className="text-xs text-foreground/85 leading-relaxed">{t.market}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/40 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Wallet className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{he ? "תיק" : "Portfolio"}</span>
            </div>
            <p className="text-xs text-foreground/85 leading-relaxed">{t.portfolio}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4 text-[10px] font-mono text-muted-foreground">
          <span>{he ? "נטיית סיכון" : "Risk bias"}: <span className={regimeColor}>{read.bias > 0 ? "+" : ""}{read.bias}</span></span>
          <span>{he ? "ביטחון בקריאה" : "Read conviction"}: <span className="text-foreground">{read.conviction}%</span></span>
        </div>
      </section>

      {/* Fleet standing — which bots are in good vs weak shape */}
      {fleetView.rows.length > 0 && (
        <section className="rounded-xl border border-border bg-secondary/20 p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Gauge className="h-3.5 w-3.5" /> {he ? "מצב הצי" : "Fleet standing"}
            </h2>
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="text-emerald-400">{fleetView.good} {he ? "טובים" : "good"}</span>
              <span className="text-red-400">{fleetView.weak} {he ? "חלשים" : "weak"}</span>
              {fleetView.paused > 0 && (
                <span className="text-amber-400">{fleetView.paused} {he ? "מושהים" : "paused"}</span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {fleetView.rows.map((b) => {
              const color = b.standing === "good" ? "text-emerald-400" : b.standing === "weak" ? "text-red-400" : "text-muted-foreground";
              const dot = b.standing === "good" ? "bg-emerald-400" : b.standing === "weak" ? "bg-red-400" : "bg-muted-foreground";
              const wr = b.trades > 0 ? `${Math.round(b.winRate)}%` : (he ? "—" : "—");
              return (
                <div key={b.key} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${dot}`} />
                    <span className="text-xs font-medium truncate">{he ? b.he : b.en}</span>
                    {b.paused && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 shrink-0">
                        {he ? "מושהה" : "paused"}
                      </span>
                    )}
                    {!b.armed && !b.paused && (
                      <span className="text-[9px] font-mono text-muted-foreground/70 shrink-0">{he ? "כבוי" : "off"}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono shrink-0">
                    <span className="text-muted-foreground">{b.trades} {he ? "עסקאות" : "trades"}</span>
                    <span className={color}>{he ? "הצלחה" : "win"} {wr}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Wallet ranking — only when more than one paper wallet exists */}
      {walletRanking.length > 0 && (
        <section className="rounded-xl border border-border bg-secondary/20 p-4">
          <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 mb-3">
            <Wallet className="h-3.5 w-3.5" /> {he ? "דירוג הארנקים לפי מזומן פנוי" : "Wallets ranked by free cash"}
          </h2>
          <div className="space-y-2">
            {walletRanking.map((w, i) => {
              const pct = Math.round(Math.max(0, Math.min(5, w.cashRatio)) * 100);
              const color = pct >= 60 ? "text-emerald-400" : pct >= 30 ? "text-cyan-400" : "text-red-400";
              return (
                <div key={w.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-5 w-5 rounded-full bg-background/60 border border-border flex items-center justify-center text-[9px] font-mono text-muted-foreground shrink-0">{i + 1}</span>
                    <span className="text-xs font-medium truncate">{w.name}</span>
                    {w.active && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-primary/15 text-primary shrink-0">
                        {he ? "פעיל" : "active"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono shrink-0">
                    <span className="text-muted-foreground">{w.openPositions} {he ? "פוזיציות" : "open"}</span>
                    <span className={color}>{pct}% {he ? "מזומן" : "cash"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Ranked moves */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <Compass className="h-3.5 w-3.5" /> {he ? "מהלכים מדורגים לאישורך" : "Ranked moves for your approval"}
          </h2>
          {moves.length > 0 && (
            <span className="text-[10px] font-mono text-muted-foreground">{moves.length} {he ? "מהלכים" : "moves"}</span>
          )}
        </div>

        {moves.length === 0 ? (
          <div className="rounded-lg border border-border bg-secondary/20 p-6 text-center">
            <ShieldCheck className="h-7 w-7 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm text-foreground/85">
              {he ? "אין כרגע מהלך שדורש את תשומת ליבך." : "Nothing needs your attention right now."}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {he
                ? "היועץ ימשיך לקרוא את השוק והתיק ויציע מהלך כשיזהה הזדמנות או סיכון."
                : "The advisor keeps reading the market and your book, and will surface a move when it spots an opportunity or a risk."}
            </p>
          </div>
        ) : (
          moves.map((m, i) => {
            const Icon = ICONS[m.icon];
            const tone = TONE_STYLE[m.tone];
            const c = m[lang];
            return (
              <div
                key={m.id}
                className="rounded-lg border p-4 transition-all"
                style={{ borderColor: tone.border, background: tone.bg }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <span className="h-6 w-6 rounded-full bg-background/60 border border-border flex items-center justify-center text-[10px] font-mono font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                  </div>
                  <div className="h-9 w-9 shrink-0 rounded-md bg-background/50 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-foreground/80" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold tracking-wide">{c.title}</h3>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${tone.chip}`}>
                        {tone.label[lang]}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{c.body}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        size="sm"
                        className="h-8 gap-1.5 font-mono"
                        onClick={() => approve(m)}
                      >
                        <Check className="h-3.5 w-3.5" /> {c.cta}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1.5 font-mono text-muted-foreground"
                        onClick={() => dismiss(m)}
                      >
                        <X className="h-3.5 w-3.5" /> {he ? "התעלם" : "Dismiss"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* What I'm watching (educational, no action) */}
      {watching.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <Eye className="h-3.5 w-3.5" /> {he ? "מה שאני עוקב אחריו" : "What I'm watching"}
          </h2>
          <div className="rounded-lg border border-border bg-secondary/20 divide-y divide-border/60">
            {watching.map((w, i) => {
              const WIcon = w.icon;
              const color = w.tone === "up" ? "text-emerald-400" : w.tone === "down" ? "text-red-400" : "text-cyan-400";
              return (
                <div key={i} className="flex items-start gap-2.5 px-4 py-2.5">
                  <WIcon className={`h-4 w-4 shrink-0 mt-0.5 ${color}`} />
                  <p className="text-[11px] text-foreground/85 leading-relaxed">{w.text}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <p className="text-[10px] text-muted-foreground/70 text-center flex items-center justify-center gap-1.5">
        <Activity className="h-3 w-3" />
        {he
          ? "כל המהלכים פועלים על תיק נייר בלבד — אין כאן כסף אמיתי, הבטחת תשואה או ייעוץ השקעות."
          : "All moves run on a paper portfolio only — no real money, no promised returns, no investment advice."}
      </p>
    </div>
  );
}
