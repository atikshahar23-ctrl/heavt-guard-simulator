import { useEffect, useRef } from "react";
import {
  useGetScalpSignals, getGetScalpSignalsQueryKey,
  useGetMomentumCoins, getGetMomentumCoinsQueryKey,
  useGetMarketOverview, getGetMarketOverviewQueryKey,
  useGetStocks, getGetStocksQueryKey,
  useGetShortTermMarkets, getGetShortTermMarketsQueryKey,
} from "@workspace/api-client-react";
import type { ScalpSignal, MomentumCoin, PolymarketMarket } from "@workspace/api-client-react";
import { usePortfolio, type TrailConfig } from "@/contexts/portfolio-context";
import { useAutoTrader, type ScalpConfidence } from "@/contexts/autotrader-context";
import { useFavorites } from "@/contexts/favorites-context";
import { useLivePrices } from "@/contexts/live-price-context";
import { toast } from "@/hooks/use-toast";

const CONF_RANK: Record<ScalpConfidence, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
/** Don't re-open the same asset within this window after an auto action. */
const COOLDOWN_MS = 10 * 60 * 1000;
/** Don't re-bet the same Polymarket condition within this window. */
const POLY_COOLDOWN_MS = 30 * 60 * 1000;

const BTC_RE = /bitcoin|\bbtc\b/i;
/** Words signalling the YES outcome means BTC goes UP. */
const UP_RE = /\b(up|above|over|higher|exceed|surpass|reach|hit|greater|more than|at least|≥|>=|new (all[- ]?time )?high|all[- ]?time high|\bath\b|breakout|moon|rise|gain|close higher|end higher)\b/i;
/** Words signalling the YES outcome means BTC goes DOWN. */
const DOWN_RE = /\b(down|below|under|lower|dip|drop|fall|crash|less than|fewer|≤|<=|decline|sink|close lower|end lower)\b/i;

/**
 * Decide whether a market's YES outcome corresponds to BTC moving UP.
 * Returns true (YES = up), false (YES = down) or null when undecidable.
 */
function yesMeansUp(question: string): boolean | null {
  const up = UP_RE.test(question);
  const down = DOWN_RE.test(question);
  if (up && !down) return true;
  if (down && !up) return false;
  // "Up or Down" style markets list "up" first → YES = up by convention.
  if (/up or down|higher or lower/i.test(question)) return true;
  return null;
}

/** Normalized trade candidate from any signal source. */
interface Candidate {
  asset: string;
  direction: "LONG" | "SHORT";
  entry: number;
  stopLoss: number;
  takeProfit: number;
  score: number;
  source: string;
  label: string;
}

/** Sum realized PnL from trades closed today (local time). */
function realizedPnlToday(history: { pnl: number; closedAt: string }[]): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const startMs = start.getTime();
  let sum = 0;
  for (const t of history) {
    const ts = new Date(t.closedAt).getTime();
    if (ts >= startMs) sum += t.pnl;
  }
  return sum;
}

/**
 * Headless engine mounted once under the providers. It (1) trails + runs SL/TP
 * across all open Binance demo positions using live prices, and (2) opens new
 * auto-trades from scalp + momentum signals at a "warrior" cadence when armed.
 */
export function AutoTraderEngine() {
  const {
    binancePositions, stockPositions, polyPositions, cash, totalDeposited, tradeHistory,
    openBinancePosition, openPolyPosition, closePolyPosition,
    checkSlTp, updateTrailingStops, checkRiskGuards, flattenAll,
  } = usePortfolio();
  const { settings, update } = useAutoTrader();
  const { isFavorite } = useFavorites();
  // Sub-second crypto prices from the free Binance WebSocket — lets SL/TP and the
  // pre-liquidation guard react near-instantly instead of waiting on 30s polling.
  const { get: getLivePrice, version: liveVersion } = useLivePrices();

  const { data: overview } = useGetMarketOverview({
    query: { queryKey: getGetMarketOverviewQueryKey(), refetchInterval: 30000, staleTime: 20000 },
  });
  const { data: stocks } = useGetStocks({
    query: { queryKey: getGetStocksQueryKey(), refetchInterval: 30000, staleTime: 20000 },
  });

  // Same-day crypto prediction markets — only polled while the BTC bot is armed.
  const { data: shortTerm } = useGetShortTermMarkets({
    query: {
      queryKey: getGetShortTermMarketsQueryKey(),
      refetchInterval: settings.polyEnabled ? 90000 : false,
      staleTime: 60000,
      enabled: settings.polyEnabled,
    },
  });

  const useScalp = settings.strategy === "SCALP" || settings.strategy === "BOTH";
  const useMomentum = settings.strategy === "MOMENTUM" || settings.strategy === "BOTH";

  const { data: signals } = useGetScalpSignals({
    query: {
      queryKey: getGetScalpSignalsQueryKey(),
      refetchInterval: settings.enabled && useScalp ? 60000 : false,
      staleTime: 45000,
      enabled: settings.enabled && useScalp,
    },
  });
  const { data: momentum } = useGetMomentumCoins({
    query: {
      queryKey: getGetMomentumCoinsQueryKey(),
      refetchInterval: settings.enabled && useMomentum ? 60000 : false,
      staleTime: 45000,
      enabled: settings.enabled && useMomentum,
    },
  });

  const cooldownRef = useRef<Record<string, number>>({});
  const polyCooldownRef = useRef<Record<string, number>>({});
  /** Running peak of total equity, for the max-drawdown kill-switch. */
  const equityPeakRef = useRef<number>(0);

  // Build a live price map (crypto + stocks); trail first, then SL/TP exits.
  const priceMap: Record<string, number> = {};
  for (const c of overview ?? []) priceMap[c.asset] = c.price;
  for (const s of stocks ?? []) priceMap[s.symbol] = s.price;
  // Overlay sub-second live crypto prices (freshest wins) for everything we may
  // need to mark to market — open positions and the polled universe.
  for (const pos of binancePositions) {
    const lp = getLivePrice(pos.asset);
    if (lp) priceMap[pos.asset] = lp.price;
  }
  for (const c of overview ?? []) {
    const lp = getLivePrice(c.asset);
    if (lp) priceMap[c.asset] = lp.price;
  }

  // ── Risk pipeline: trail → pre-liquidation guard → SL/TP → drawdown kill-switch.
  // Guard runs before SL/TP so a position past its emergency threshold exits as
  // "LIQ" rather than slipping through as an ordinary SL.
  useEffect(() => {
    if (Object.keys(priceMap).length === 0) return;
    updateTrailingStops(priceMap);
    if (settings.catastrophicExitEnabled) {
      checkRiskGuards(priceMap, settings.maxLossPerTradePct);
    }
    checkSlTp(priceMap);

    // Portfolio kill-switch: track equity peak, flatten everything once the
    // drawdown from that peak crosses the configured (unrecoverable) threshold.
    if (settings.portfolioStopEnabled) {
      let equity = cash;
      for (const pos of binancePositions) {
        const price = priceMap[pos.asset];
        if (!price) { equity += pos.notional / pos.leverage; continue; }
        const delta = pos.direction === "LONG"
          ? (price - pos.entryPrice) / pos.entryPrice
          : (pos.entryPrice - price) / pos.entryPrice;
        equity += Math.max(0, pos.notional / pos.leverage + delta * pos.notional);
      }
      for (const pos of stockPositions) {
        const price = priceMap[pos.symbol];
        if (!price) { equity += pos.cost; continue; }
        equity += Math.max(0, pos.cost + pos.shares * (price - pos.entryPrice));
      }

      if (equity > equityPeakRef.current) equityPeakRef.current = equity;
      const peak = equityPeakRef.current;
      const ddPct = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
      const hasRisk = binancePositions.length > 0 || stockPositions.length > 0;

      if (hasRisk && ddPct >= settings.portfolioMaxDrawdownPct) {
        const closed = flattenAll(priceMap);
        if (closed > 0) {
          // Disarm so the engine can't immediately re-open into the crash.
          update({ enabled: false });
          toast({
            variant: "destructive",
            title: "Kill-switch · book flattened",
            description: `Drawdown ${ddPct.toFixed(1)}% ≥ ${settings.portfolioMaxDrawdownPct}% — closed ${closed} position(s) and disarmed the auto-trader.`,
          });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview, stocks, liveVersion, settings, checkSlTp, updateTrailingStops, checkRiskGuards, flattenAll]);

  // Auto-trade evaluation.
  useEffect(() => {
    if (!settings.enabled) return;
    const margin = settings.marginPerTrade;
    if (!(margin > 0) || !(settings.leverage >= 1)) return;

    // Daily loss guard — stop opening once today's realized loss hits the cap.
    if (settings.dailyStopEnabled) {
      const cap = (settings.dailyMaxLossPct / 100) * totalDeposited;
      if (cap > 0 && realizedPnlToday(tradeHistory) <= -cap) return;
    }

    const now = Date.now();
    let autoOpen = binancePositions.filter((p) => p.auto).length;
    let availableCash = cash;
    const openAssets = new Set(binancePositions.map((p) => p.asset));

    // ── Collect candidates from enabled sources ──
    const candidates: Candidate[] = [];

    if (useScalp && signals) {
      for (const s of signals as ScalpSignal[]) {
        if (s.direction === "NEUTRAL") continue;
        if (CONF_RANK[s.confidence] < CONF_RANK[settings.minConfidence]) continue;
        if (s.direction === "LONG" ? !settings.allowLong : !settings.allowShort) continue;
        if (!Number.isFinite(s.entry) || s.entry <= 0) continue;
        candidates.push({
          asset: s.asset,
          direction: s.direction as "LONG" | "SHORT",
          entry: s.entry,
          stopLoss: s.stopLoss,
          takeProfit: s.takeProfit,
          score: s.score,
          source: "Scalp signal",
          label: `${s.confidence} scalp`,
        });
      }
    }

    if (useMomentum && momentum && settings.allowLong) {
      for (const m of momentum as MomentumCoin[]) {
        if (m.score < settings.minMomentumScore) continue;
        if (m.stage === "COOLING") continue;
        if (!Number.isFinite(m.entry) || m.entry <= 0) continue;
        candidates.push({
          asset: m.asset,
          direction: "LONG", // momentum runners are long-biased
          entry: m.entry,
          stopLoss: m.stopLoss,
          takeProfit: m.takeProfit,
          score: m.score,
          source: "Momentum surge",
          label: `${m.stage.toLowerCase()} · ${m.rvol.toFixed(1)}× vol`,
        });
      }
    }

    // De-dupe by asset (keep the highest score), apply gates, rank.
    const byAsset = new Map<string, Candidate>();
    for (const c of candidates) {
      const existing = byAsset.get(c.asset);
      if (!existing || c.score > existing.score) byAsset.set(c.asset, c);
    }

    const ranked = [...byAsset.values()]
      .filter((c) => !settings.favoritesOnly || isFavorite(`coin:${c.asset}`))
      .filter((c) => !openAssets.has(c.asset))
      .filter((c) => now - (cooldownRef.current[c.asset] ?? 0) > COOLDOWN_MS)
      .sort((a, b) => b.score - a.score);

    const trail: TrailConfig | undefined = settings.trailingEnabled
      ? { activatePct: settings.trailActivatePct, distancePct: settings.trailDistancePct }
      : undefined;

    for (const c of ranked) {
      if (autoOpen >= settings.maxOpenPositions) break;
      if (availableCash < margin) break;

      const notional = margin * settings.leverage;
      const err = openBinancePosition({
        asset: c.asset,
        direction: c.direction,
        notional,
        entryPrice: c.entry,
        leverage: settings.leverage,
        slPrice: c.stopLoss,
        tpPrice: c.takeProfit,
        auto: true,
        source: c.source,
        trail,
      });
      if (err) continue;

      cooldownRef.current[c.asset] = now;
      availableCash -= margin;
      autoOpen += 1;
      toast({
        title: `Auto-Trade · ${c.direction} ${c.asset}`,
        description: `${c.source} (${c.label}) · ${settings.leverage}x · $${margin} @ $${c.entry}`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signals, momentum, settings, cash, binancePositions, isFavorite, totalDeposited, tradeHistory]);

  // ── Polymarket BTC auto-investor ────────────────────────────────────────────
  // Focuses purely on same-day Bitcoin up/down markets. Direction comes from the
  // live BTC 24h move; bets are sized per settings and exited on TP/SL.
  useEffect(() => {
    if (!settings.polyEnabled) return;

    // Same-day BTC markets only (crypto feed → keep Bitcoin questions within horizon).
    const horizonMs = settings.polyHorizonHours * 3600_000;
    const nowMs = Date.now();
    const btcMarkets = ((shortTerm ?? []) as PolymarketMarket[]).filter((m) => {
      if (!BTC_RE.test(m.question)) return false;
      if (!m.endDate) return false;
      const ms = new Date(m.endDate).getTime() - nowMs;
      return ms > 0 && ms <= horizonMs;
    });
    const liveById = new Map(btcMarkets.map((m) => [m.conditionId, m]));

    // 1) Manage exits on open BTC bets (TP / SL — the irreversible-bet backstop).
    for (const pos of polyPositions) {
      const live = liveById.get(pos.conditionId);
      if (!live) continue; // can't mark to market without a live quote
      const price = pos.side === "YES" ? live.yesPrice : live.noPrice;
      if (!Number.isFinite(price) || price <= 0) continue;
      const pnlPct = ((price - pos.entryPrice) / pos.entryPrice) * 100;
      if (pnlPct >= settings.polyTakeProfitPct || pnlPct <= -settings.polyStopLossPct) {
        closePolyPosition(pos.id, price);
        polyCooldownRef.current[pos.conditionId] = nowMs;
        toast({
          title: `BTC Bet · ${pnlPct >= 0 ? "Take-profit" : "Stop-loss"}`,
          description: `${pos.side} @ ${pos.entryPrice.toFixed(2)} → ${price.toFixed(2)} (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(0)}%)`,
        });
      }
    }

    // 2) Directional bias from the live BTC 24h move.
    const btc = (overview ?? []).find((c) => c.asset === "BTC");
    if (!btc) return;
    const bias = btc.changePercent; // signed 24h %
    if (Math.abs(bias) < settings.polyMinBiasPct) return;
    const bullish = bias > 0;

    if (settings.polyStakePerBet <= 0) return;
    let openBets = polyPositions.length;
    let availableCash = cash;
    const openConditions = new Set(polyPositions.map((p) => p.conditionId));

    // Rank candidates: liquid first, odds not already near-resolved.
    const candidates = btcMarkets
      .filter((m) => !openConditions.has(m.conditionId))
      .filter((m) => nowMs - (polyCooldownRef.current[m.conditionId] ?? 0) > POLY_COOLDOWN_MS)
      .sort((a, b) => (b.volume24hr ?? b.volume ?? 0) - (a.volume24hr ?? a.volume ?? 0));

    for (const m of candidates) {
      if (openBets >= settings.polyMaxOpenBets) break;
      if (availableCash < settings.polyStakePerBet) break;

      const yesUp = yesMeansUp(m.question);
      if (yesUp == null) continue; // skip markets we can't classify
      // Buy the side that expresses our directional view.
      const side: "YES" | "NO" = bullish ? (yesUp ? "YES" : "NO") : (yesUp ? "NO" : "YES");
      const entryPrice = side === "YES" ? m.yesPrice : m.noPrice;
      // Avoid near-resolved odds (no edge / poor payout asymmetry).
      if (!Number.isFinite(entryPrice) || entryPrice < 0.1 || entryPrice > 0.9) continue;

      const err = openPolyPosition(
        {
          conditionId: m.conditionId,
          question: m.question,
          category: m.category,
          slug: m.slug ?? null,
          side,
          entryPrice,
        },
        settings.polyStakePerBet,
      );
      if (err) continue;

      polyCooldownRef.current[m.conditionId] = nowMs;
      availableCash -= settings.polyStakePerBet;
      openBets += 1;
      toast({
        title: `BTC Bet · ${side} (${bullish ? "bullish" : "bearish"})`,
        description: `$${settings.polyStakePerBet} @ ${entryPrice.toFixed(2)} · ${m.question.slice(0, 80)}`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortTerm, overview, settings, polyPositions, cash]);

  return null;
}
