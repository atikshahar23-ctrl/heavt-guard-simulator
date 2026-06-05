import { useEffect, useMemo, useRef } from "react";
import {
  useGetMarketOverview, getGetMarketOverviewQueryKey,
  useGetStocks, getGetStocksQueryKey,
} from "@workspace/api-client-react";
import type { CoinTicker, StockQuote } from "@workspace/api-client-react";
import { usePortfolio } from "@/contexts/portfolio-context";
import { useAutoTrader, type NewBotId } from "@/contexts/autotrader-context";
import { useLivePrices } from "@/contexts/live-price-context";
import { recommendLevels } from "@/lib/recommend-levels";
import { toast } from "@/hooks/use-toast";

/** Don't re-open the same asset within this window after an auto action. */
const COOLDOWN_MS = 10 * 60 * 1000;
/** Boost mode: collapse the per-asset cooldown to a few seconds for rapid churn. */
const BOOST_COOLDOWN_MS = 4 * 1000;

/** Unique per-bot source labels — also used to attribute closed-trade results. */
const SOURCE: Record<NewBotId, string> = {
  dipbuyer: "Dip Buyer",
  breakout: "Breakout Hunter",
  dca: "Blue-Chip DCA",
};
const SOURCE_TO_BOT: Record<string, NewBotId> = {
  "Dip Buyer": "dipbuyer",
  "Breakout Hunter": "breakout",
  "Blue-Chip DCA": "dca",
};

/** Rotating large-cap universe for the accumulation bot. */
const BLUE_CHIPS: { symbol: string; name: string }[] = [
  { symbol: "AAPL", name: "Apple" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "GOOGL", name: "Alphabet" },
  { symbol: "META", name: "Meta Platforms" },
  { symbol: "JPM", name: "JPMorgan Chase" },
  { symbol: "V", name: "Visa" },
];

/**
 * Headless engine for the three additional simulator bots (Dip Buyer, Breakout
 * Hunter, Blue-Chip DCA). It is fully isolated from the original AutoTraderEngine
 * — it self-attributes each closed paper trade back to its bot (by openedAt) and
 * feeds the result to the adaptive manager so each bot tunes its own selectivity.
 */
export function ExtraBotsEngine() {
  const {
    binancePositions, stockPositions, tradeHistory, cash,
    openBinancePosition, openStockPosition,
  } = usePortfolio();
  const { settings, getBotStat, recordBotResult, getAssetCaution, evaluateRisk } = useAutoTrader();
  const { get: getLivePrice } = useLivePrices();

  // Boost mode: tiny cooldowns + faster polling so these bots churn quickly too.
  const boostActive = settings.boostUntil > Date.now();
  const cooldownMs = boostActive ? BOOST_COOLDOWN_MS : COOLDOWN_MS;
  const cryptoArmed = settings.dipEnabled || settings.breakoutEnabled;

  const { data: overview } = useGetMarketOverview({
    query: {
      queryKey: getGetMarketOverviewQueryKey(),
      refetchInterval: cryptoArmed ? (boostActive ? 12000 : 30000) : false,
      staleTime: boostActive ? 8000 : 20000,
      enabled: cryptoArmed,
    },
  });
  const { data: stocks } = useGetStocks({
    query: {
      queryKey: getGetStocksQueryKey(),
      refetchInterval: settings.dcaEnabled ? (boostActive ? 12000 : 30000) : false,
      staleTime: boostActive ? 8000 : 20000,
      enabled: settings.dcaEnabled,
    },
  });

  const cryptoCooldownRef = useRef<Record<string, number>>({});
  const lastDcaRef = useRef<number>(0);
  const dcaIdxRef = useRef<number>(0);
  /** position id → owning bot + openedAt, so we can score the trade on close. */
  const trackedRef = useRef<Map<string, { botId: NewBotId; openedAt: string }>>(new Map());

  // Live crypto price map (freshest WS price wins over the 30s poll).
  const cryptoPrice = (asset: string): number | undefined => {
    const lp = getLivePrice(asset);
    if (lp) return lp.price;
    const c = (overview ?? []).find((o) => o.asset === asset);
    return c?.price;
  };

  // ── Reconcile: capture new bot positions, score them when they close ──
  useEffect(() => {
    const tracked = trackedRef.current;
    const openIds = new Set<string>();

    for (const p of binancePositions) {
      openIds.add(p.id);
      const bot = p.source ? SOURCE_TO_BOT[p.source] : undefined;
      if (bot && !tracked.has(p.id)) tracked.set(p.id, { botId: bot, openedAt: p.openedAt });
    }
    for (const p of stockPositions) {
      openIds.add(p.id);
      const bot = p.source ? SOURCE_TO_BOT[p.source] : undefined;
      if (bot && !tracked.has(p.id)) tracked.set(p.id, { botId: bot, openedAt: p.openedAt });
    }

    for (const [id, info] of [...tracked.entries()]) {
      if (openIds.has(id)) continue; // still open
      // Closed: match by the preserved openedAt timestamp.
      const closed = tradeHistory.find((t) => t.openedAt === info.openedAt);
      if (closed) recordBotResult(info.botId, closed.pnl);
      tracked.delete(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binancePositions, stockPositions, tradeHistory]);

  // ── Risk Manager supervision — runs on a separate timer, not inside trading effects ──
  const pausedBots = useMemo(() => {
    const set = new Set<string>();
    for (const [id, g] of Object.entries(settings.riskGuards ?? {})) {
      if (g.paused) set.add(id);
    }
    return set;
  }, [settings.riskGuards]);

  useEffect(() => {
    if (!settings.riskManagerEnabled) return;
    const timer = setInterval(() => {
      const totalDeposited = 10_000; // default baseline
      evaluateRisk("dipbuyer", tradeHistory, cash, totalDeposited);
      evaluateRisk("breakout", tradeHistory, cash, totalDeposited);
      evaluateRisk("dca", tradeHistory, cash, totalDeposited);
    }, 30000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.riskManagerEnabled, evaluateRisk, tradeHistory, cash]);

  // ── Dip Buyer — buys the biggest crypto 24h losers (contrarian LONG) ──
  useEffect(() => {
    if (!settings.dipEnabled || !(settings.dipStake > 0)) return;
    if (pausedBots.has("dipbuyer")) return;
    const lev = Math.max(1, settings.newBotLeverage);
    const edge = getBotStat("dipbuyer").edge;
    const minDrop = settings.dipMinDropPct * edge;
    const now = Date.now();

    let open = binancePositions.filter((p) => p.source === SOURCE.dipbuyer).length;
    let avail = cash;
    const openAssets = new Set(binancePositions.map((p) => p.asset));

    const ranked = ((overview ?? []) as CoinTicker[])
      .filter((c) => Number.isFinite(c.price) && c.price > 0)
      // Per-asset caution: coins this bot keeps losing on need a deeper dip.
      .filter((c) => c.changePercent <= -(minDrop * getAssetCaution(c.asset)))
      .filter((c) => !openAssets.has(c.asset))
      .filter((c) => now - (cryptoCooldownRef.current[c.asset] ?? 0) > cooldownMs)
      .sort((a, b) => a.changePercent - b.changePercent);

    for (const c of ranked) {
      if (open >= settings.dipMaxOpen) break;
      if (avail < settings.dipStake) break;
      const price = cryptoPrice(c.asset) ?? c.price;
      const { sl, tp } = recommendLevels(price, "LONG", { slPct: 0.03, tpPct: 0.06 });
      const err = openBinancePosition({
        asset: c.asset, direction: "LONG", notional: settings.dipStake * lev,
        entryPrice: price, leverage: lev, slPrice: sl, tpPrice: tp,
        auto: true, source: SOURCE.dipbuyer,
      });
      if (err) continue;
      cryptoCooldownRef.current[c.asset] = now;
      avail -= settings.dipStake;
      open += 1;
      toast({ title: `Dip Buyer · LONG ${c.asset}`, description: `24h ${c.changePercent.toFixed(1)}% · ${lev}x · $${settings.dipStake} @ $${price}` });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview, settings, cash, binancePositions]);

  // ── Breakout Hunter — buys the strongest crypto 24h gainers (LONG) ──
  useEffect(() => {
    if (!settings.breakoutEnabled || !(settings.breakoutStake > 0)) return;
    if (pausedBots.has("breakout")) return;
    const lev = Math.max(1, settings.newBotLeverage);
    const edge = getBotStat("breakout").edge;
    const minGain = settings.breakoutMinGainPct * edge;
    const now = Date.now();

    let open = binancePositions.filter((p) => p.source === SOURCE.breakout).length;
    let avail = cash;
    const openAssets = new Set(binancePositions.map((p) => p.asset));

    const ranked = ((overview ?? []) as CoinTicker[])
      .filter((c) => Number.isFinite(c.price) && c.price > 0)
      // Per-asset caution: coins this bot keeps losing on need a stronger breakout.
      .filter((c) => c.changePercent >= minGain * getAssetCaution(c.asset))
      .filter((c) => !openAssets.has(c.asset))
      .filter((c) => now - (cryptoCooldownRef.current[c.asset] ?? 0) > cooldownMs)
      .sort((a, b) => b.changePercent - a.changePercent);

    for (const c of ranked) {
      if (open >= settings.breakoutMaxOpen) break;
      if (avail < settings.breakoutStake) break;
      const price = cryptoPrice(c.asset) ?? c.price;
      const { sl, tp } = recommendLevels(price, "LONG", { slPct: 0.04, tpPct: 0.08 });
      const err = openBinancePosition({
        asset: c.asset, direction: "LONG", notional: settings.breakoutStake * lev,
        entryPrice: price, leverage: lev, slPrice: sl, tpPrice: tp,
        auto: true, source: SOURCE.breakout,
      });
      if (err) continue;
      cryptoCooldownRef.current[c.asset] = now;
      avail -= settings.breakoutStake;
      open += 1;
      toast({ title: `Breakout Hunter · LONG ${c.asset}`, description: `24h +${c.changePercent.toFixed(1)}% · ${lev}x · $${settings.breakoutStake} @ $${price}` });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview, settings, cash, binancePositions]);

  // ── Blue-Chip DCA — periodic small large-cap accumulation buys ──
  useEffect(() => {
    if (!settings.dcaEnabled || !(settings.dcaStake > 0)) return;
    if (pausedBots.has("dca")) return;
    const now = Date.now();
    // Boost mode buys on a tight 10s cadence instead of the configured minutes.
    const intervalMs = boostActive ? 10_000 : Math.max(1, settings.dcaIntervalMin) * 60_000;
    if (now - lastDcaRef.current < intervalMs) return;

    const open = stockPositions.filter((p) => p.source === SOURCE.dca).length;
    if (open >= settings.dcaMaxOpen) return;
    if (cash < settings.dcaStake) return;

    const priceOf = (sym: string): number | undefined =>
      ((stocks ?? []) as StockQuote[]).find((s) => s.symbol === sym)?.price;

    // Rotate through the universe until we find one with a live price.
    for (let i = 0; i < BLUE_CHIPS.length; i++) {
      const pick = BLUE_CHIPS[(dcaIdxRef.current + i) % BLUE_CHIPS.length];
      const price = priceOf(pick.symbol);
      if (!price || price <= 0) continue;
      const err = openStockPosition(
        { symbol: pick.symbol, name: pick.name, direction: "LONG", entryPrice: price, auto: true, source: SOURCE.dca },
        settings.dcaStake, 1,
      );
      if (err) continue;
      dcaIdxRef.current = (dcaIdxRef.current + i + 1) % BLUE_CHIPS.length;
      lastDcaRef.current = now;
      toast({ title: `Blue-Chip DCA · ${pick.symbol}`, description: `Accumulated $${settings.dcaStake} @ $${price}` });
      break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stocks, settings, cash, stockPositions]);

  return null;
}
