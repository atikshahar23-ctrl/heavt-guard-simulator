import { useEffect, useRef } from "react";
import {
  useGetScalpSignals, getGetScalpSignalsQueryKey,
  useGetMomentumCoins, getGetMomentumCoinsQueryKey,
  useGetMarketOverview, getGetMarketOverviewQueryKey,
  useGetStocks, getGetStocksQueryKey,
  useGetStockRecommendations, getGetStockRecommendationsQueryKey,
  useGetInfluencerSignals, getGetInfluencerSignalsQueryKey,
} from "@workspace/api-client-react";
import type {
  ScalpSignal, MomentumCoin, StockRecommendation, InfluencerSignal,
} from "@workspace/api-client-react";
import { usePortfolio } from "@/contexts/portfolio-context";
import { useAutoTrader, cashReserveFloor, intensityProfile } from "@/contexts/autotrader-context";
import { useLivePrices } from "@/contexts/live-price-context";
import {
  DEFAULT_VOL, blackScholesPrice, pickStrike, optionPositionValue,
  yearsToExpiry, type OptionKind,
} from "@/lib/options-model";
import { toast } from "@/hooks/use-toast";

/** Source label — attributes and closes Options Agent positions. */
const SOURCE = "Options Agent";

/** Don't re-open an option on the same underlying within this window. */
const COOLDOWN_MS = 20 * 60 * 1000;
const BOOST_COOLDOWN_MS = 10 * 1000;

/** Mark-to-market + exit-management cadence. */
const MANAGE_INTERVAL_MS = 5 * 1000;

/** How far out-of-the-money the agent buys (cheaper, higher-convexity contracts). */
const OTM_PCT: Record<"CRYPTO" | "STOCK", number> = { CRYPTO: 4, STOCK: 3 };

/** Premium-based exits — long options swing hard, so take profit early and cap losses. */
const TAKE_PROFIT_PCT = 60; // close at +60% of premium paid
const STOP_LOSS_PCT = 50;   // close at −50% of premium paid

/** Map a coarse confidence label to a 0–100 score for the min-confidence gate. */
const LABEL_SCORE: Record<string, number> = { HIGH: 85, MEDIUM: 65, LOW: 45 };

interface OptionCandidate {
  underlying: string;
  market: "CRYPTO" | "STOCK";
  kind: OptionKind;
  /** Underlying spot price at evaluation. */
  spot: number;
  /** 0–100 conviction used for ranking + the min-confidence gate. */
  confidence: number;
  label: string;
}

/**
 * Headless engine for the paper Options Agent. It reads the same live signal
 * feeds as the other bots and buys long CALL/PUT contracts: bullish signals →
 * CALLs, bearish → PUTs, across crypto (scalp + momentum) and stocks
 * (smart-money recs + influencer headlines). Every contract is long-only, so
 * the committed premium is the maximum possible loss. Positions are marked to
 * market with a simplified Black–Scholes model and closed on a premium-based
 * take-profit / stop-loss or at expiry. Educational paper trading only — it
 * makes no predictions and never promises returns.
 */
export function OptionsBotEngine() {
  const {
    optionPositions, cash, totalDeposited,
    openOptionPosition, closeOptionPosition,
  } = usePortfolio();
  const { settings, getAssetCaution } = useAutoTrader();
  const { get: getLivePrice } = useLivePrices();

  const armed = settings.optionsEnabled;
  const boostActive = settings.boostUntil > Date.now();
  const prof = intensityProfile(settings.intensity, settings.tradeMode);
  const cooldownMs = boostActive ? BOOST_COOLDOWN_MS : Math.round(COOLDOWN_MS * prof.cooldownMult);

  // Shared market quotes (same query keys as the other engines — no extra fan-out).
  const { data: overview } = useGetMarketOverview({
    query: { queryKey: getGetMarketOverviewQueryKey(), refetchInterval: 30000, staleTime: 20000 },
  });
  const { data: stocks } = useGetStocks({
    query: { queryKey: getGetStocksQueryKey(), refetchInterval: 30000, staleTime: 20000 },
  });

  // Signal feeds — only polled while the agent is armed.
  const { data: signals } = useGetScalpSignals({
    query: {
      queryKey: getGetScalpSignalsQueryKey(),
      refetchInterval: armed ? (boostActive ? 12000 : 60000) : false,
      staleTime: boostActive ? 8000 : 45000,
      enabled: armed,
    },
  });
  const { data: momentum } = useGetMomentumCoins({
    query: {
      queryKey: getGetMomentumCoinsQueryKey(),
      refetchInterval: armed ? (boostActive ? 12000 : 60000) : false,
      staleTime: boostActive ? 8000 : 45000,
      enabled: armed,
    },
  });
  const { data: stockRecs } = useGetStockRecommendations({
    query: {
      queryKey: getGetStockRecommendationsQueryKey(),
      refetchInterval: armed ? (boostActive ? 15000 : 60000) : false,
      staleTime: boostActive ? 10000 : 45000,
      enabled: armed,
    },
  });
  const { data: influencers } = useGetInfluencerSignals({
    query: {
      queryKey: getGetInfluencerSignalsQueryKey(),
      refetchInterval: armed ? (boostActive ? 20000 : 120000) : false,
      staleTime: boostActive ? 15000 : 90000,
      enabled: armed,
    },
  });

  const cooldownRef = useRef<Record<string, number>>({});

  // Build a price map for marking option positions: crypto from overview + live
  // WS, stocks from the stock feed.
  const priceMap: Record<string, number> = {};
  for (const c of overview ?? []) priceMap[c.asset] = c.price;
  for (const s of stocks ?? []) priceMap[s.symbol] = s.price;
  for (const pos of optionPositions) {
    if (pos.market !== "CRYPTO") continue;
    const lp = getLivePrice(pos.underlying);
    if (lp) priceMap[pos.underlying] = lp.price;
  }

  // Mirror the latest marks + positions + close handler into refs so the
  // management interval always reads fresh quotes (avoids a stale-closure that
  // would freeze TP/SL marks at the price from when the timer was created).
  const priceMapRef = useRef(priceMap);
  priceMapRef.current = priceMap;
  const positionsRef = useRef(optionPositions);
  positionsRef.current = optionPositions;
  const closeRef = useRef(closeOptionPosition);
  closeRef.current = closeOptionPosition;

  // ── Manage open options: premium-based TP/SL + expiry close ──
  useEffect(() => {
    const manage = () => {
      const now = Date.now();
      const own = positionsRef.current.filter((p) => p.source === SOURCE);
      const marks = priceMapRef.current;
      for (const pos of own) {
        const mark = marks[pos.underlying];
        const expired = yearsToExpiry(pos.expiryMs, now) <= 0;
        // Need a live mark to evaluate TP/SL; expiry can close on entry price.
        if (!expired && (!mark || !Number.isFinite(mark))) continue;
        const underlying = mark && Number.isFinite(mark) ? mark : pos.entryUnderlying;
        const value = optionPositionValue({
          kind: pos.kind, underlying, strike: pos.strike,
          expiryMs: pos.expiryMs, vol: pos.entryVol, contracts: pos.contracts,
        });
        if (!Number.isFinite(value)) continue;
        const pnlPct = ((value - pos.premiumPaid) / pos.premiumPaid) * 100;
        if (expired) {
          closeRef.current(pos.id, underlying, "EXPIRY");
        } else if (pnlPct >= TAKE_PROFIT_PCT) {
          closeRef.current(pos.id, underlying, "TP");
        } else if (pnlPct <= -STOP_LOSS_PCT) {
          closeRef.current(pos.id, underlying, "SL");
        }
      }
    };

    const timer = setInterval(manage, MANAGE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  // ── Auto-open long options on the strongest directional signals ──
  useEffect(() => {
    if (!armed) return;
    if (settings.fleetPaused) return;
    const stake = settings.optionStakePerTrade;
    if (!(stake > 0)) return;

    const cashFloor = cashReserveFloor(totalDeposited, settings.cashFloorPct);
    const maxOpen = Math.max(1, Math.round(settings.optionMaxOpen * prof.maxOpenMult));
    const minConf = settings.optionMinConfidence;
    const expiryDays = Math.max(1, settings.optionExpiryDays);
    const now = Date.now();

    let open = optionPositions.filter((p) => p.source === SOURCE).length;
    let avail = cash;
    const openUnderlyings = new Set(optionPositions.map((p) => p.underlying));

    // Collect directional candidates, keeping the best per underlying.
    const byUnderlying = new Map<string, OptionCandidate>();
    const consider = (c: OptionCandidate) => {
      if (!(c.spot > 0) || !Number.isFinite(c.spot)) return;
      const existing = byUnderlying.get(c.underlying);
      if (!existing || c.confidence > existing.confidence) byUnderlying.set(c.underlying, c);
    };

    // Crypto — scalp signals (LONG→CALL, SHORT→PUT).
    for (const s of (signals ?? []) as ScalpSignal[]) {
      if (s.direction === "NEUTRAL") continue;
      consider({
        underlying: s.asset, market: "CRYPTO",
        kind: s.direction === "LONG" ? "CALL" : "PUT",
        spot: s.price, confidence: LABEL_SCORE[s.confidence] ?? 50,
        label: `${s.confidence} scalp`,
      });
    }
    // Crypto — momentum runners (long-biased → CALL).
    for (const m of (momentum ?? []) as MomentumCoin[]) {
      consider({
        underlying: m.asset, market: "CRYPTO", kind: "CALL",
        spot: m.price, confidence: Math.min(100, m.score),
        label: `momentum ${Math.round(m.score)}`,
      });
    }
    // Stocks — smart-money recommendations (BUY→CALL, SELL→PUT).
    for (const r of (stockRecs ?? []) as StockRecommendation[]) {
      if (r.action === "HOLD") continue;
      consider({
        underlying: r.symbol, market: "STOCK",
        kind: r.action === "BUY" ? "CALL" : "PUT",
        spot: r.price, confidence: LABEL_SCORE[r.confidence] ?? 50,
        label: `${r.confidence} ${r.action.toLowerCase()}`,
      });
    }
    // Stocks — influencer headlines (LONG→CALL, SHORT→PUT).
    for (const inf of (influencers ?? []) as InfluencerSignal[]) {
      const spot = priceMap[inf.ticker];
      if (!spot) continue;
      consider({
        underlying: inf.ticker, market: "STOCK",
        kind: inf.direction === "LONG" ? "CALL" : "PUT",
        spot, confidence: Math.min(100, inf.confidence),
        label: "headline",
      });
    }

    const ranked = [...byUnderlying.values()]
      .filter((c) => c.confidence >= minConf * getAssetCaution(c.underlying))
      .filter((c) => !openUnderlyings.has(c.underlying))
      .filter((c) => now - (cooldownRef.current[c.underlying] ?? 0) > cooldownMs)
      .sort((a, b) => b.confidence - a.confidence);

    for (const c of ranked) {
      if (open >= maxOpen) break;
      if (avail - stake < cashFloor) break;

      const vol = DEFAULT_VOL[c.market];
      const strike = pickStrike(c.spot, c.kind, OTM_PCT[c.market]);
      const expiryMs = now + expiryDays * 24 * 60 * 60 * 1000;
      const years = yearsToExpiry(expiryMs, now);
      const premiumPerUnit = blackScholesPrice({ kind: c.kind, spot: c.spot, strike, years, vol });
      if (!(premiumPerUnit > 0)) continue;
      const contracts = stake / premiumPerUnit;

      const err = openOptionPosition({
        underlying: c.underlying,
        market: c.market,
        kind: c.kind,
        strike,
        entryUnderlying: c.spot,
        expiryMs,
        contracts,
        premiumPaid: stake,
        entryVol: vol,
        auto: true,
        source: SOURCE,
      }, cashFloor);
      if (err) continue;

      cooldownRef.current[c.underlying] = now;
      avail -= stake;
      open += 1;
      toast({
        title: `Options Agent · ${c.underlying}`,
        description: `${c.kind} @ $${strike.toLocaleString(undefined, { maximumFractionDigits: 2 })} · ${expiryDays}d · $${stake} premium · ${c.label}`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signals, momentum, stockRecs, influencers, settings, cash, optionPositions]);

  return null;
}
