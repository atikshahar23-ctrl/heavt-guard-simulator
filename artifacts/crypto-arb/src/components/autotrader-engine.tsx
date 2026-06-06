import { useEffect, useMemo, useRef } from "react";
import {
  useGetScalpSignals, getGetScalpSignalsQueryKey,
  useGetMomentumCoins, getGetMomentumCoinsQueryKey,
  useGetMarketOverview, getGetMarketOverviewQueryKey,
  useGetStocks, getGetStocksQueryKey,
  useGetStockRecommendations, getGetStockRecommendationsQueryKey,
  useGetInfluencerSignals, getGetInfluencerSignalsQueryKey,
  useGetShortTermMarkets, getGetShortTermMarketsQueryKey,
} from "@workspace/api-client-react";
import type { ScalpSignal, MomentumCoin, PolymarketMarket, StockRecommendation, InfluencerSignal, StockQuote } from "@workspace/api-client-react";
import { usePortfolio, type TrailConfig } from "@/contexts/portfolio-context";
import { recommendLevels } from "@/lib/recommend-levels";
import { useAutoTrader, computeDynamicSizing, cashReserveFloor, intensityProfile, alphaAdjust, NEUTRAL_ALPHA, ALPHA_COMMIT_PCT, ALPHA_STRONG_PCT, type AlphaState, type ScalpConfidence } from "@/contexts/autotrader-context";
import { useFavorites } from "@/contexts/favorites-context";
import { useLivePrices } from "@/contexts/live-price-context";
import { toast } from "@/hooks/use-toast";

const CONF_RANK: Record<ScalpConfidence, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
/** Don't re-open the same asset within this window after an auto action. */
const COOLDOWN_MS = 10 * 60 * 1000;
/** Boost mode: collapse the per-asset cooldown to a few seconds for rapid churn. */
const BOOST_COOLDOWN_MS = 4 * 1000;
/** Don't re-bet the same Polymarket condition within this window. */
const POLY_COOLDOWN_MS = 30 * 60 * 1000;

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

/** Crypto assets we can price from the market-overview feed, matched against a question. */
const ASSET_PATTERNS: { re: RegExp; asset: string }[] = [
  { re: /bitcoin|\bbtc\b/i, asset: "BTC" },
  { re: /ethereum|\beth\b/i, asset: "ETH" },
  { re: /solana|\bsol\b/i, asset: "SOL" },
  { re: /\bbnb\b|binance coin/i, asset: "BNB" },
  { re: /\bxrp\b|ripple/i, asset: "XRP" },
  { re: /dogecoin|\bdoge\b/i, asset: "DOGE" },
  { re: /cardano|\bada\b/i, asset: "ADA" },
  { re: /avalanche|\bavax\b/i, asset: "AVAX" },
  { re: /chainlink|\blink\b/i, asset: "LINK" },
  { re: /litecoin|\bltc\b/i, asset: "LTC" },
];

/** First crypto ticker referenced by a market question, or null when none matches. */
function assetForQuestion(question: string): string | null {
  for (const { re, asset } of ASSET_PATTERNS) if (re.test(question)) return asset;
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
    openBinancePosition, openPolyPosition, closePolyPosition, openStockPosition,
    closeBinancePosition, checkSlTp, updateTrailingStops, checkRiskGuards, flattenAll,
  } = usePortfolio();
  const { settings, update, getAssetCaution, recordAssetResult, publishAlpha } = useAutoTrader();
  const { isFavorite } = useFavorites();
  // Boost mode: while the deadline is in the future every bot trades at maximum
  // cadence — tiny cooldowns, faster polling and fast profit-banking.
  const boostActive = settings.boostUntil > Date.now();
  // Trading-intensity gear (economy↔sport). Boost still overrides cadence below.
  const prof = intensityProfile(settings.intensity, settings.tradeMode);
  // Sub-second crypto prices from the free Binance WebSocket — lets SL/TP and the
  // pre-liquidation guard react near-instantly instead of waiting on 30s polling.
  const { get: getLivePrice, version: liveVersion } = useLivePrices();

  const { data: overview } = useGetMarketOverview({
    query: { queryKey: getGetMarketOverviewQueryKey(), refetchInterval: 30000, staleTime: 20000 },
  });
  const { data: stocks } = useGetStocks({
    query: { queryKey: getGetStocksQueryKey(), refetchInterval: 30000, staleTime: 20000 },
  });

  // Smart-Money stock bot inputs — only polled while the stock bot is armed.
  const { data: stockRecs } = useGetStockRecommendations({
    query: {
      queryKey: getGetStockRecommendationsQueryKey(),
      refetchInterval: settings.stocksEnabled ? (boostActive ? 15000 : 60000) : false,
      staleTime: boostActive ? 10000 : 45000,
      enabled: settings.stocksEnabled,
    },
  });
  const { data: influencers } = useGetInfluencerSignals({
    query: {
      queryKey: getGetInfluencerSignalsQueryKey(),
      refetchInterval: settings.stocksEnabled ? (boostActive ? 20000 : 120000) : false,
      staleTime: boostActive ? 15000 : 90000,
      enabled: settings.stocksEnabled,
    },
  });

  // Same-day crypto prediction markets — only polled while the BTC bot is armed.
  const { data: shortTerm } = useGetShortTermMarkets({
    query: {
      queryKey: getGetShortTermMarketsQueryKey(),
      refetchInterval: settings.polyEnabled ? (boostActive ? 20000 : 90000) : false,
      staleTime: boostActive ? 15000 : 60000,
      enabled: settings.polyEnabled,
    },
  });

  const useScalp = settings.strategy === "SCALP" || settings.strategy === "BOTH";
  const useMomentum = settings.strategy === "MOMENTUM" || settings.strategy === "BOTH";

  const { data: signals } = useGetScalpSignals({
    query: {
      queryKey: getGetScalpSignalsQueryKey(),
      refetchInterval: settings.enabled && useScalp ? (boostActive ? 12000 : 60000) : false,
      staleTime: boostActive ? 8000 : 45000,
      enabled: settings.enabled && useScalp,
    },
  });
  const { data: momentum } = useGetMomentumCoins({
    query: {
      queryKey: getGetMomentumCoinsQueryKey(),
      refetchInterval: settings.enabled && useMomentum ? (boostActive ? 12000 : 60000) : false,
      staleTime: boostActive ? 8000 : 45000,
      enabled: settings.enabled && useMomentum,
    },
  });

  const cooldownRef = useRef<Record<string, number>>({});
  const stockCooldownRef = useRef<Record<string, number>>({});
  const polyCooldownRef = useRef<Record<string, number>>({});
  /** Running peak of total equity, for the max-drawdown kill-switch. */
  const equityPeakRef = useRef<number>(0);
  /** Per-position best favorable price, for the Smart-Exit peak-pullback trail. */
  const peakRef = useRef<Map<string, number>>(new Map());
  /** Closed-trade ids already folded into per-asset caution (avoids double counting). */
  const assetRecordedRef = useRef<Set<string> | null>(null);

  // ── Alpha Convergence Coordinator ──────────────────────────────────────────
  // The fleet "brain": tally weighted directional votes across every live signal
  // source (scalp confidence, momentum surge, smart-money stock votes) and resolve
  // one dominant conviction. Each bot then trades in formation around it — easier
  // entries when aligned, stricter when fighting the consensus.
  // The master's earned "control level": a rolling win-rate over its recent
  // auto-trades, damped by sample size so a few lucky trades can't inflate it.
  // Educational only — it nudges selectivity slightly, it does not predict.
  const mastery = useMemo(() => {
    const recent = tradeHistory.filter((t) => t.auto).slice(0, 30);
    const sample = recent.length;
    if (sample === 0) return { recentWinRate: 0, recentSample: 0, masteryScore: 0 };
    const wins = recent.filter((t) => t.pnl >= 0).length;
    const winRate = (wins / sample) * 100;
    // Confidence in the win-rate grows with sample size (full weight at ~15 trades).
    const sampleWeight = Math.min(1, sample / 15);
    const masteryScore = Math.round(winRate * sampleWeight);
    return { recentWinRate: Math.round(winRate), recentSample: sample, masteryScore };
  }, [tradeHistory]);

  const alphaState = useMemo<AlphaState>(() => {
    if (!settings.alphaCoordinatorEnabled) return { ...NEUTRAL_ALPHA, ...mastery, updatedAt: Date.now() };
    let longVotes = 0;
    let shortVotes = 0;
    const contributing = new Set<string>();

    if (signals) {
      for (const s of signals as ScalpSignal[]) {
        if (s.direction === "LONG") { longVotes += CONF_RANK[s.confidence] + 1; contributing.add("scalp"); }
        else if (s.direction === "SHORT") { shortVotes += CONF_RANK[s.confidence] + 1; contributing.add("scalp"); }
      }
    }
    if (momentum) {
      for (const m of momentum as MomentumCoin[]) {
        if (m.stage === "COOLING") continue;
        longVotes += Math.max(0, m.score) / 50; // momentum is long-biased
        contributing.add("momentum");
      }
    }
    if (stockRecs) {
      for (const r of stockRecs as StockRecommendation[]) {
        if (r.action === "BUY") { longVotes += CONF_RANK[r.confidence] + 1; contributing.add("smart-money"); }
        else if (r.action === "SELL") { shortVotes += CONF_RANK[r.confidence] + 1; contributing.add("smart-money"); }
      }
    }

    const total = longVotes + shortVotes;
    if (total <= 0) return { ...NEUTRAL_ALPHA, ...mastery, updatedAt: Date.now() };
    const domVotes = Math.max(longVotes, shortVotes);
    const confluence = Math.round((domVotes / total) * 100);
    const dom: "LONG" | "SHORT" = longVotes >= shortVotes ? "LONG" : "SHORT";
    return {
      direction: confluence >= ALPHA_COMMIT_PCT ? dom : "NEUTRAL",
      confluence,
      longVotes: Math.round(longVotes),
      shortVotes: Math.round(shortVotes),
      total: Math.round(total),
      sources: contributing.size,
      ...mastery,
      updatedAt: Date.now(),
    };
  }, [signals, momentum, stockRecs, settings.alphaCoordinatorEnabled, mastery]);

  // Publish the resolved conviction so the Bot Command Center can render it live.
  useEffect(() => {
    publishAlpha(alphaState);
  }, [alphaState, publishAlpha]);

  // ── Per-asset caution learning ──
  // Fold every closed auto crypto/stock trade into its coin's scorecard so the
  // bots grow more careful on coins they keep losing on. The "already counted"
  // set is seeded from the persisted ledger (settings.recordedTradeIds) — not
  // from the wallet-scoped tradeHistory — so a reload OR a wallet switch can
  // never re-count the same trade. recordAssetResult re-checks the persisted
  // ledger too, so the dedupe holds even if this in-memory guard is empty.
  useEffect(() => {
    if (assetRecordedRef.current === null) {
      assetRecordedRef.current = new Set(settings.recordedTradeIds ?? []);
    }
    const seen = assetRecordedRef.current;
    for (const t of tradeHistory) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      if (!t.auto) continue;
      if (t.type !== "BINANCE" && t.type !== "STOCK") continue;
      if (t.symbol) recordAssetResult(t.symbol, t.pnl, t.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeHistory]);

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

    // ── Smart Exit ── Bank small bot wins fast ("supermarket" turnover — even
    // 30s–1min trades), but once a trade's profit crosses the runner threshold
    // give it more room and ride it until a peak-pullback trips the exit. Only
    // ever closes positions that are in profit, so it never deepens a loss.
    if (settings.smartExitEnabled) {
      const now = Date.now();
      // Boost banks wins on the tiniest tick and recycles flat-green trades in
      // seconds (rapid turnover). CALCULATED is the opposite: only bank once a
      // real move has built, give winners far more room, and never fast-recycle
      // a green trade — let it ride toward a long-term target.
      const calcMode = settings.tradeMode === "CALCULATED";
      const takeProfitPct = boostActive
        ? Math.min(settings.scalpTakeProfitPct, 0.2)
        : calcMode
          ? Math.max(settings.scalpTakeProfitPct, 1.5)
          : settings.scalpTakeProfitPct;
      const givebackPct = boostActive
        ? 0.1
        : calcMode
          ? Math.max(settings.scalpGivebackPct, 1.0)
          : settings.scalpGivebackPct;
      const recycleSec = boostActive
        ? Math.min(settings.maxScalpHoldSec || 12, 12)
        : calcMode
          ? 0
          : settings.maxScalpHoldSec;
      for (const pos of binancePositions) {
        if (!pos.auto) continue;
        const price = priceMap[pos.asset];
        if (!price || !Number.isFinite(price)) continue;
        const ageMs = now - new Date(pos.openedAt).getTime();
        if (ageMs < 3000) continue; // never open→close in the same breath

        const isLong = pos.direction === "LONG";
        const prevPeak = peakRef.current.get(pos.id) ?? pos.entryPrice;
        const peak = isLong ? Math.max(prevPeak, price) : Math.min(prevPeak, price);
        peakRef.current.set(pos.id, peak);

        const gainPct = isLong
          ? ((price - pos.entryPrice) / pos.entryPrice) * 100
          : ((pos.entryPrice - price) / pos.entryPrice) * 100;
        const peakGainPct = isLong
          ? ((peak - pos.entryPrice) / pos.entryPrice) * 100
          : ((pos.entryPrice - peak) / pos.entryPrice) * 100;

        // Once enough profit has been tasted, protect it with a peak-pullback
        // trail. Strong movers past the runner threshold get a wider giveback
        // so they can keep running; ordinary scalps are banked on a tiny dip.
        if (peakGainPct >= takeProfitPct) {
          // Boost never lets a trade graduate to a "runner" — bank everything fast.
          const isRunner = !boostActive && peakGainPct >= settings.runnerTriggerPct;
          const giveback = isRunner ? settings.runnerTrailPct : givebackPct;
          const trailStop = isLong ? peak * (1 - giveback / 100) : peak * (1 + giveback / 100);
          // Only bank when still green — never let the trail close below breakeven.
          const hit = (isLong ? price <= trailStop : price >= trailStop) && gainPct > 0;
          if (hit) {
            closeBinancePosition(pos.id, price, "TP");
            peakRef.current.delete(pos.id);
            toast({
              title: `סגירה חכמה · ${isRunner ? "ריצת רווח" : "סקאלפ מהיר"} ${pos.asset}`,
              description: `${pos.direction} +${gainPct.toFixed(2)}% (שיא +${peakGainPct.toFixed(2)}%)`,
            });
          }
          continue;
        }

        // Stale-but-green trades: recycle the capital for the next fast setup.
        if (recycleSec > 0 && ageMs >= recycleSec * 1000 && gainPct > 0) {
          closeBinancePosition(pos.id, price, "TP");
          peakRef.current.delete(pos.id);
          toast({
            title: `סגירה חכמה · מִחזוּר ${pos.asset}`,
            description: `${pos.direction} +${gainPct.toFixed(2)}% אחרי ${Math.round(ageMs / 1000)} ש'`,
          });
          continue;
        }

        // Stale-and-losing trades: exit to stop the bleed. Without a hard SL a
        // losing position could sit open for minutes accumulating loss. Cut it
        // after 3× recycleSec (or 3 min minimum) if it hasn't recovered.
        const lossCutSec = Math.max(180, (recycleSec || 90) * 3);
        if (ageMs >= lossCutSec * 1000 && gainPct < -0.3 && !pos.slPrice) {
          closeBinancePosition(pos.id, price, "SL");
          peakRef.current.delete(pos.id);
          toast({
            title: `סגירה חכמה · קציצת הפסד ${pos.asset}`,
            description: `${pos.direction} ${gainPct.toFixed(2)}% אחרי ${Math.round(ageMs / 1000)} ש' · אין SL מוגדר`,
          });
        }
      }
      // Drop peak state for positions that are no longer open.
      const openIds = new Set(binancePositions.map((p) => p.id));
      for (const id of [...peakRef.current.keys()]) {
        if (!openIds.has(id)) peakRef.current.delete(id);
      }
    }

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
        equity += Math.max(0, pos.cost + pos.shares * (pos.direction === "SHORT" ? pos.entryPrice - price : price - pos.entryPrice));
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
  }, [overview, stocks, liveVersion, settings, closeBinancePosition, checkSlTp, updateTrailingStops, checkRiskGuards, flattenAll]);

  // Auto-trade evaluation.
  useEffect(() => {
    if (!settings.enabled) return;
    const dynSizing = settings.dynamicCapitalEnabled
      ? computeDynamicSizing(cash, totalDeposited, tradeHistory, settings.cashFloorPct)
      : null;
    const margin = dynSizing ? dynSizing.margin : settings.marginPerTrade;
    const effectiveLeverage = dynSizing ? dynSizing.leverage : settings.leverage;
    if (!(margin > 0) || !(effectiveLeverage >= 1)) return;
    // Account Manager cash reserve: never commit below the protected floor.
    const cashFloor = cashReserveFloor(totalDeposited, settings.cashFloorPct);

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
        // Per-asset caution: coins the bots keep losing on must clear a higher
        // confidence bar (1.5x+ → demand HIGH; 1.25x+ → at least one notch up).
        const caution = getAssetCaution(s.asset);
        const bump = caution >= 1.5 ? 2 : caution >= 1.25 ? 1 : 0;
        // Intensity gear shifts the confidence bar (calm = stricter, turbo = looser).
        // Alpha Coordinator: aligned-with-the-fleet trades clear an easier notch.
        const aAdj = alphaAdjust(alphaState, settings.alphaCoordinatorEnabled, s.direction as "LONG" | "SHORT");
        const effMinRank = Math.max(0, Math.min(CONF_RANK.HIGH, CONF_RANK[settings.minConfidence] + bump + prof.confRankAdd + aAdj.rankAdd));
        if (CONF_RANK[s.confidence] < effMinRank) continue;
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
      const mAlpha = alphaAdjust(alphaState, settings.alphaCoordinatorEnabled, "LONG");
      for (const m of momentum as MomentumCoin[]) {
        // Per-asset caution + intensity gear + Alpha Coordinator set the surge bar.
        if (m.score < settings.minMomentumScore * getAssetCaution(m.asset) * prof.selectivityMult * mAlpha.selMult) continue;
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

    const cooldown = boostActive ? BOOST_COOLDOWN_MS : Math.round(COOLDOWN_MS * prof.cooldownMult);
    // When the fleet's conviction is strong, the coordinator presses the advantage
    // with two extra open slots so aligned bots can pile into the dominant move.
    const alphaSlots = settings.alphaCoordinatorEnabled && alphaState.direction !== "NEUTRAL" && alphaState.confluence >= ALPHA_STRONG_PCT ? 2 : 0;
    const maxOpen = Math.max(1, Math.round(settings.maxOpenPositions * prof.maxOpenMult) + alphaSlots);
    const ranked = [...byAsset.values()]
      .filter((c) => !settings.favoritesOnly || isFavorite(`coin:${c.asset}`))
      .filter((c) => !openAssets.has(c.asset))
      .filter((c) => now - (cooldownRef.current[c.asset] ?? 0) > cooldown)
      .sort((a, b) => b.score - a.score);

    const trail: TrailConfig | undefined = settings.trailingEnabled
      ? { activatePct: settings.trailActivatePct, distancePct: settings.trailDistancePct }
      : undefined;

    for (const c of ranked) {
      if (autoOpen >= maxOpen) break;
      if (availableCash - margin < cashFloor) break;

      const notional = margin * effectiveLeverage;
      // Fallback SL/TP: if the signal didn't supply levels, set a conservative
      // default (2% SL / 4% TP for scalp; 2.5% SL / 5% TP for momentum) so
      // the trade always has a hard stop and never relies solely on the
      // catastrophic-exit or stale-loser logic.
      const fallbackSlPct = c.source === "Momentum surge" ? 0.025 : 0.02;
      const fallbackTpPct = fallbackSlPct * 2;
      const slPrice = c.stopLoss ?? (c.direction === "LONG"
        ? c.entry * (1 - fallbackSlPct)
        : c.entry * (1 + fallbackSlPct));
      const tpPrice = c.takeProfit ?? (c.direction === "LONG"
        ? c.entry * (1 + fallbackTpPct)
        : c.entry * (1 - fallbackTpPct));
      const err = openBinancePosition({
        asset: c.asset,
        direction: c.direction,
        notional,
        entryPrice: c.entry,
        leverage: effectiveLeverage,
        slPrice,
        tpPrice,
        auto: true,
        source: c.source,
        trail,
      }, cashFloor);
      if (err) continue;

      cooldownRef.current[c.asset] = now;
      availableCash -= margin;
      autoOpen += 1;
      toast({
        title: `Auto-Trade · ${c.direction} ${c.asset}`,
        description: `${c.source} (${c.label}) · ${effectiveLeverage}x · $${margin} @ $${c.entry}`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signals, momentum, alphaState, settings, cash, binancePositions, isFavorite, totalDeposited, tradeHistory]);

  // ── Smart-Money stock bot ───────────────────────────────────────────────────
  // Fuses two free sources per ticker — technical recommendations and
  // influencer-news sentiment — into a directional conviction, then opens LONG or
  // SHORT paper positions for the strongest agreeing setups (risk-gated).
  useEffect(() => {
    if (!settings.stocksEnabled) return;
    const dynStake = settings.dynamicCapitalEnabled
      ? computeDynamicSizing(cash, totalDeposited, tradeHistory, settings.cashFloorPct).margin
      : null;
    const stake = dynStake ?? settings.stockStakePerTrade;
    if (!(stake > 0)) return;
    // Account Manager cash reserve: never commit below the protected floor.
    const cashFloor = cashReserveFloor(totalDeposited, settings.cashFloorPct);

    // Daily loss guard shared with the rest of the book.
    if (settings.dailyStopEnabled) {
      const cap = (settings.dailyMaxLossPct / 100) * totalDeposited;
      if (cap > 0 && realizedPnlToday(tradeHistory) <= -cap) return;
    }

    const now = Date.now();
    let autoOpen = stockPositions.filter((p) => p.auto).length;
    let availableCash = cash;
    const openSymbols = new Set(stockPositions.map((p) => p.symbol));

    // Net directional conviction per ticker: LONG votes add, SHORT votes subtract.
    const score = new Map<string, number>();
    const nameBy = new Map<string, string>();
    const priceBy = new Map<string, number>();
    const labelBy = new Map<string, string[]>();
    const srcBy = new Map<string, Set<string>>();

    const vote = (sym: string, signed: number, name: string, label: string, src: string, price?: number) => {
      const key = sym.toUpperCase();
      score.set(key, (score.get(key) ?? 0) + signed);
      if (name && !nameBy.has(key)) nameBy.set(key, name);
      if (price && price > 0 && !priceBy.has(key)) priceBy.set(key, price);
      const bits = labelBy.get(key) ?? [];
      bits.push(label);
      labelBy.set(key, bits);
      const set = srcBy.get(key) ?? new Set<string>();
      set.add(src);
      srcBy.set(key, set);
    };

    // Technical recommendations (BUY → long, SELL → short; weighted by confidence).
    for (const r of (stockRecs ?? []) as StockRecommendation[]) {
      if (r.action === "HOLD") continue;
      const w = (CONF_RANK[r.confidence] + 1) * 18; // LOW 18 / MED 36 / HIGH 54
      const signed = r.action === "BUY" ? w : -w;
      vote(r.symbol, signed, r.name, `${r.confidence} ${r.action.toLowerCase()} technical`, "Technical", r.price);
    }

    // Influencer-news sentiment (confidence 0-100 scaled to the same range).
    for (const s of (influencers ?? []) as InfluencerSignal[]) {
      const w = (s.confidence / 100) * 50;
      const signed = s.direction === "LONG" ? w : -w;
      vote(s.ticker, signed, s.name, `${s.influencer} ${s.direction.toLowerCase()}`, "Influencer");
    }

    // Resolve a live price for any ticker the recs didn't carry.
    for (const sym of score.keys()) {
      if (!priceBy.has(sym)) {
        const p = priceMap[sym];
        if (p && p > 0) priceBy.set(sym, p);
      }
    }

    type StockCand = {
      symbol: string; name: string; direction: "LONG" | "SHORT";
      price: number; conviction: number; label: string; multiSource: boolean;
    };
    const candidates: StockCand[] = [];
    for (const [sym, net] of score) {
      const conviction = Math.min(100, Math.abs(net));
      const direction: "LONG" | "SHORT" = net >= 0 ? "LONG" : "SHORT";
      // Per-asset caution + intensity gear + Alpha Coordinator raise the bar.
      const sAlpha = alphaAdjust(alphaState, settings.alphaCoordinatorEnabled, direction);
      if (conviction < settings.stockMinConfidence * getAssetCaution(sym) * prof.selectivityMult * sAlpha.selMult) continue;
      if (direction === "LONG" ? !settings.allowLong : !settings.allowShort) continue;
      const price = priceBy.get(sym);
      if (!price || price <= 0) continue;
      candidates.push({
        symbol: sym,
        name: nameBy.get(sym) ?? sym,
        direction,
        price,
        conviction,
        label: (labelBy.get(sym) ?? []).slice(0, 2).join(" + "),
        multiSource: (srcBy.get(sym)?.size ?? 0) > 1,
      });
    }

    const stockCooldown = boostActive ? BOOST_COOLDOWN_MS : Math.round(COOLDOWN_MS * prof.cooldownMult);
    const stockMaxOpen = Math.max(1, Math.round(settings.stockMaxOpen * prof.maxOpenMult));
    const ranked = candidates
      .filter((c) => !openSymbols.has(c.symbol))
      .filter((c) => now - (stockCooldownRef.current[c.symbol] ?? 0) > stockCooldown)
      // Reward agreement across both sources, then raw conviction.
      .sort((a, b) => Number(b.multiSource) - Number(a.multiSource) || b.conviction - a.conviction);

    for (const c of ranked) {
      if (autoOpen >= stockMaxOpen) break;
      if (availableCash - stake < cashFloor) break;

      // 2:1 reward at a conviction-tightened stop (higher conviction → wider room).
      const slPct = c.conviction >= 75 ? 0.04 : 0.03;
      const { sl, tp } = recommendLevels(c.price, c.direction, { slPct, tpPct: slPct * 2 });
      const err = openStockPosition(
        {
          symbol: c.symbol,
          name: c.name,
          direction: c.direction,
          entryPrice: c.price,
          slPrice: sl,
          tpPrice: tp,
          auto: true,
          source: c.multiSource ? "Smart-Money (technical + influencer)" : "Smart-Money",
        },
        stake,
        1,
        cashFloor,
      );
      if (err) continue;

      stockCooldownRef.current[c.symbol] = now;
      availableCash -= stake;
      autoOpen += 1;
      toast({
        title: `Smart-Money · ${c.direction} ${c.symbol}`,
        description: `${c.label} · conviction ${c.conviction.toFixed(0)} · $${stake} @ $${c.price}`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockRecs, influencers, alphaState, settings, cash, stockPositions, totalDeposited, tradeHistory]);

  // ── Polymarket crypto auto-investor ─────────────────────────────────────────
  // Trades same-day crypto up/down markets across every priceable asset (BTC, ETH,
  // SOL, …). Direction for each market comes from that asset's live 24h move
  // (falling back to BTC); bets are sized per settings and exited on TP/SL.
  useEffect(() => {
    if (!settings.polyEnabled) return;

    const horizonMs = settings.polyHorizonHours * 3600_000;
    const nowMs = Date.now();
    // Any priceable, classifiable crypto market inside the horizon. The server
    // already restricts this feed to crypto markets ending within 48h.
    const cryptoMarkets = ((shortTerm ?? []) as PolymarketMarket[]).filter((m) => {
      if (!m.endDate) return false;
      const ms = new Date(m.endDate).getTime() - nowMs;
      if (!(ms > 0 && ms <= horizonMs)) return false;
      return assetForQuestion(m.question) !== null && yesMeansUp(m.question) !== null;
    });
    const liveById = new Map(cryptoMarkets.map((m) => [m.conditionId, m]));

    // 1) Manage exits on open bets (TP / SL — the irreversible-bet backstop).
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
          title: `Crypto Bet · ${pnlPct >= 0 ? "Take-profit" : "Stop-loss"}`,
          description: `${pos.side} @ ${pos.entryPrice.toFixed(2)} → ${price.toFixed(2)} (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(0)}%)`,
        });
      }
    }

    // 2) Per-asset directional bias from the live 24h move (BTC as fallback).
    const changeFor = (asset: string): number | null => {
      const c = (overview ?? []).find((o) => o.asset === asset);
      return c ? c.changePercent : null;
    };
    const btcBias = changeFor("BTC");

    // Auto-Pilot / Account-Manager: size each bet dynamically from portfolio
    // health; otherwise use the user's fixed stake.
    const polyStake = settings.dynamicCapitalEnabled
      ? computeDynamicSizing(cash, totalDeposited, tradeHistory, settings.cashFloorPct).margin
      : settings.polyStakePerBet;
    if (!(polyStake > 0)) return;
    // Account Manager cash reserve: never commit below the protected floor.
    const cashFloor = cashReserveFloor(totalDeposited, settings.cashFloorPct);
    let openBets = polyPositions.length;
    let availableCash = cash;
    const openConditions = new Set(polyPositions.map((p) => p.conditionId));
    // Intensity gear: calm waits longer between bets & demands a stronger bias.
    const polyCooldown = boostActive ? BOOST_COOLDOWN_MS : Math.round(POLY_COOLDOWN_MS * prof.cooldownMult);
    const polyMaxOpen = Math.max(1, Math.round(settings.polyMaxOpenBets * prof.maxOpenMult));
    const polyMinBias = settings.polyMinBiasPct * prof.selectivityMult;

    // Rank candidates: liquid first, odds not already near-resolved.
    const candidates = cryptoMarkets
      .filter((m) => !openConditions.has(m.conditionId))
      .filter((m) => nowMs - (polyCooldownRef.current[m.conditionId] ?? 0) > polyCooldown)
      .sort((a, b) => (b.volume24hr ?? b.volume ?? 0) - (a.volume24hr ?? a.volume ?? 0));

    for (const m of candidates) {
      if (openBets >= polyMaxOpen) break;
      if (availableCash - polyStake < cashFloor) break;

      const asset = assetForQuestion(m.question)!;
      const bias = changeFor(asset) ?? btcBias;
      if (bias == null || Math.abs(bias) < polyMinBias) continue;
      const bullish = bias > 0;

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
          auto: true,
          source: "Polymarket BTC",
        },
        polyStake,
        cashFloor,
      );
      if (err) continue;

      polyCooldownRef.current[m.conditionId] = nowMs;
      availableCash -= polyStake;
      openBets += 1;
      toast({
        title: `${asset} Bet · ${side} (${bullish ? "bullish" : "bearish"})`,
        description: `$${polyStake} @ ${entryPrice.toFixed(2)} · ${m.question.slice(0, 80)}`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortTerm, overview, settings, polyPositions, cash]);

  return null;
}
