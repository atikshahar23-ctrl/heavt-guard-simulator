import { useEffect, useMemo, useRef } from "react";
import {
  useGetMarketOverview, getGetMarketOverviewQueryKey,
} from "@workspace/api-client-react";
import type { CoinTicker } from "@workspace/api-client-react";
import { usePortfolio } from "@/contexts/portfolio-context";
import { useAutoTrader, resolveSizing, cashReserveFloor, intensityProfile } from "@/contexts/autotrader-context";
import { useLivePrices } from "@/contexts/live-price-context";
import { recommendLevels } from "@/lib/recommend-levels";
import { checkPreTrade } from "@/lib/fees";
import { toast } from "@/hooks/use-toast";

/** Source label — attributes and closes Range Bot positions. */
export const RANGE_SOURCE = "Range Bot";

/** Don't re-open the same asset within this window after an auto action. */
const COOLDOWN_MS = 10 * 60 * 1000;
/** Boost mode: collapse the per-asset cooldown to a few seconds for rapid churn. */
const BOOST_COOLDOWN_MS = 4 * 1000;

/** Tight mean-reversion SL/TP — a "range" trade banks a small reversion, not a trend. */
const RANGE_SL_PCT = 0.02;
const RANGE_TP_PCT = 0.015;

/** How often we sample the rolling-average buffer (ms). */
const SAMPLE_INTERVAL_MS = 60_000;

/** One price sample: timestamp + price. */
interface PriceSample { ts: number; price: number; }

/**
 * Headless engine for the Range Bot — a mean-reversion / range strategy.
 *
 * For each crypto asset it maintains a rolling buffer of recent price samples
 * (one per minute, capped to the configured lookback window). When the live
 * price deviates by more than `rangeDeviationPct` from that rolling average,
 * the bot opens a contrarian position betting on reversion back toward the
 * mean: price far BELOW its average -> LONG, price far ABOVE its average ->
 * SHORT. Exits are a tight take-profit (reversion banked quickly) or a wider
 * stop-loss in case the move keeps trending instead of reverting.
 *
 * This is intentionally distinct from Dip Buyer (one-directional contrarian
 * LONG on 24h losers) and Breakout Hunter (momentum continuation on 24h
 * gainers): Range Bot trades BOTH directions purely off a short-term rolling
 * average, independent of the 24h change.
 */
export function RangeBotEngine() {
  const { binancePositions, cash, totalDeposited, tradeHistory, openBinancePosition } = usePortfolio();
  const { settings, getBotStat, getAssetCaution } = useAutoTrader();
  const { get: getLivePrice } = useLivePrices();

  const boostActive = settings.boostUntil > Date.now();
  const prof = intensityProfile(settings.intensity, settings.tradeMode);
  const cooldownMs = boostActive ? BOOST_COOLDOWN_MS : Math.round(COOLDOWN_MS * prof.cooldownMult);
  const armed = settings.rangeEnabled;

  const { data: overview } = useGetMarketOverview({
    query: {
      queryKey: getGetMarketOverviewQueryKey(),
      refetchInterval: armed ? (boostActive ? 12000 : 30000) : false,
      staleTime: boostActive ? 8000 : 20000,
      enabled: armed,
    },
  });

  /** asset -> rolling price-sample buffer (newest last). */
  const historyRef = useRef<Map<string, PriceSample[]>>(new Map());
  /** asset -> epoch-ms of last auto-open. */
  const cooldownRef = useRef<Record<string, number>>({});

  const cryptoPrice = (asset: string): number | undefined => {
    const lp = getLivePrice(asset);
    if (lp) return lp.price;
    const c = (overview ?? []).find((o) => o.asset === asset);
    return c?.price;
  };

  // ── Sample live prices into the rolling-average buffer ──
  useEffect(() => {
    if (!armed) return;
    const now = Date.now();
    const lookbackMs = Math.max(1, settings.rangeLookbackMin) * 60_000;
    const history = historyRef.current;
    for (const c of (overview ?? []) as CoinTicker[]) {
      if (!Number.isFinite(c.price) || c.price <= 0) continue;
      const price = cryptoPrice(c.asset) ?? c.price;
      const buf = history.get(c.asset) ?? [];
      const last = buf[buf.length - 1];
      if (!last || now - last.ts >= SAMPLE_INTERVAL_MS) {
        buf.push({ ts: now, price });
        // Drop samples older than the lookback window.
        while (buf.length > 1 && now - buf[0].ts > lookbackMs) buf.shift();
        history.set(c.asset, buf);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview, armed, settings.rangeLookbackMin]);

  // ── Range Bot — mean-reversion entries on both sides ──
  useEffect(() => {
    if (!armed) return;
    if (settings.fleetPaused) return;
    const sizing = resolveSizing(settings, cash, totalDeposited, tradeHistory, "rangebot");
    const lev = Math.max(1, sizing.leverage);
    const stake = sizing.margin;
    if (!(stake > 0)) return;
    const cashFloor = cashReserveFloor(totalDeposited, settings.cashFloorPct);
    const edge = getBotStat("rangebot").edge;
    // Intensity gear: calm demands a wider deviation; turbo reacts to smaller wobbles.
    const minDeviation = settings.rangeDeviationPct * edge * prof.selectivityMult;
    const maxOpen = Math.max(1, Math.round(settings.rangeMaxOpen * prof.maxOpenMult));
    const now = Date.now();
    const minSamples = 3;

    let open = binancePositions.filter((p) => p.source === RANGE_SOURCE).length;
    let avail = cash;
    const openAssets = new Set(binancePositions.map((p) => p.asset));

    type Candidate = { asset: string; price: number; deviationPct: number; direction: "LONG" | "SHORT"; changePercent: number };
    const candidates: Candidate[] = [];
    for (const c of (overview ?? []) as CoinTicker[]) {
      if (!Number.isFinite(c.price) || c.price <= 0) continue;
      if (openAssets.has(c.asset)) continue;
      if (now - (cooldownRef.current[c.asset] ?? 0) <= cooldownMs) continue;
      const buf = historyRef.current.get(c.asset);
      if (!buf || buf.length < minSamples) continue;
      const avg = buf.reduce((a, s) => a + s.price, 0) / buf.length;
      if (!(avg > 0)) continue;
      const price = cryptoPrice(c.asset) ?? c.price;
      const deviationPct = ((price - avg) / avg) * 100;
      const threshold = minDeviation * getAssetCaution(c.asset);
      if (Math.abs(deviationPct) < threshold) continue;
      // Below-average -> bet on reversion UP (LONG); above-average -> reversion DOWN (SHORT).
      const direction = deviationPct < 0 ? "LONG" : "SHORT";
      if (direction === "SHORT" && !settings.allowShort) continue;
      if (direction === "LONG" && !settings.allowLong) continue;
      candidates.push({ asset: c.asset, price, deviationPct, direction, changePercent: c.changePercent });
    }
    // Trade the most stretched assets first — the strongest reversion setups.
    candidates.sort((a, b) => Math.abs(b.deviationPct) - Math.abs(a.deviationPct));

    for (const c of candidates) {
      if (open >= maxOpen) break;
      if (avail - stake < cashFloor) break;
      const pre = checkPreTrade(Math.abs(c.changePercent), 0, c.direction);
      if (pre) continue;
      const { sl, tp } = recommendLevels(c.price, c.direction, { slPct: RANGE_SL_PCT, tpPct: RANGE_TP_PCT });
      const err = openBinancePosition({
        asset: c.asset, direction: c.direction, notional: stake * lev,
        entryPrice: c.price, leverage: lev, slPrice: sl, tpPrice: tp,
        auto: true, source: RANGE_SOURCE,
      }, cashFloor);
      if (err) continue;
      cooldownRef.current[c.asset] = now;
      avail -= stake;
      open += 1;
      toast({
        title: `Range Bot · ${c.direction} ${c.asset}`,
        description: `${c.deviationPct > 0 ? "+" : ""}${c.deviationPct.toFixed(2)}% vs ${settings.rangeLookbackMin}m avg · ${lev}x · $${stake} @ $${c.price}`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview, settings, cash, binancePositions]);

  return null;
}
