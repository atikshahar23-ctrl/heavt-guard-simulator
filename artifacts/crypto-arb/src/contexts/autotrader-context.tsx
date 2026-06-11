import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from "react";
import { usePortfolio } from "@/contexts/portfolio-context";
import { useServerSync } from "@/contexts/server-sync-context";

export type ScalpConfidence = "LOW" | "MEDIUM" | "HIGH";

/** Which signal sources the engine trades from. */
export type TradeStrategy = "SCALP" | "MOMENTUM" | "BOTH";

/** The additional, independently-managed simulator bots. */
export const NEW_BOT_IDS = ["dipbuyer", "breakout", "dca", "flowbot"] as const;
export type NewBotId = (typeof NEW_BOT_IDS)[number];

/** Rolling, per-bot paper-trading scorecard used by the adaptive manager. */
export interface BotStat {
  trades: number;
  wins: number;
  losses: number;
  netPnl: number;
  /** Adaptive selectivity multiplier (1 = baseline; >1 = more selective). */
  edge: number;
  lastAt?: string;
}

export function freshBotStat(): BotStat {
  return { trades: 0, wins: 0, losses: 0, netPnl: 0, edge: 1 };
}

/**
 * Caution multiplier for one coin from its rolling record. Coins the bots keep
 * losing on demand a progressively stronger setup before being re-traded; a
 * losing streak escalates faster. Never drops below 1 (assets only get *more*
 * careful — winners just return to neutral, they don't get reckless).
 */
export function assetCautionFromStat(stat: BotStat): number {
  if (stat.trades < 3) return 1;
  const winRate = stat.wins / stat.trades;
  let caution: number;
  if (winRate < 0.34) caution = 1.8;
  else if (winRate < 0.45) caution = 1.5;
  else if (winRate < 0.55) caution = 1.25;
  else caution = 1;
  // A red (net-losing) coin gets a little extra caution on top.
  if (stat.netPnl < 0 && caution < 1.8) caution = Math.min(1.8, caution + 0.15);
  return Math.round(caution * 100) / 100;
}

/** ── Risk Manager: supervisor that guards win-rate & capital ───────────────── */

export interface RiskGuard {
  /** Master kill-switch for this bot's opening privileges. */
  paused: boolean;
  /** When the pause was triggered (ISO). */
  pausedAt?: string;
  /** Why the bot was paused. */
  reason?: string;
  /** Number of consecutive losses before pause. */
  consecutiveLosses: number;
  /** Daily loss limit reached. */
  dailyLossHalt: boolean;
  /** Max drawdown from peak since last reset. */
  maxDrawdownPct: number;
}

export function freshRiskGuard(): RiskGuard {
  return { paused: false, consecutiveLosses: 0, dailyLossHalt: false, maxDrawdownPct: 0 };
}

const MAX_CONSECUTIVE_LOSSES = 3;
const DAILY_LOSS_PCT = 10;
const MAX_DRAWDOWN_PCT = 25;

function realizedLossToday(history: { pnl: number; closedAt: string }[]): number {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  return history.filter((h) => new Date(h.closedAt) >= start).reduce((a, h) => a + Math.min(0, h.pnl), 0);
}

function peakEquity(history: { pnl: number; closedAt: string }[], currentCash: number, totalDeposited: number): number {
  const sorted = [...history].sort((a, b) => new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime());
  let peak = totalDeposited;
  let running = totalDeposited;
  for (const h of sorted) {
    running += h.pnl;
    if (running > peak) peak = running;
  }
  if (currentCash > peak) peak = currentCash;
  return peak;
}

/**
 * Evaluate a single bot's risk state and return the updated guard.
 * This is the "super-trader brain" — it pauses losing bots early to preserve capital.
 */
export function evaluateRiskGuard(
  botId: string,
  botStat: BotStat,
  guard: RiskGuard,
  tradeHistory: { pnl: number; closedAt: string }[],
  currentCash: number,
  totalDeposited: number,
): RiskGuard {
  const next = { ...freshRiskGuard(), ...guard };

  // 1. Consecutive-loss streak guard
  if (botStat.losses >= MAX_CONSECUTIVE_LOSSES && botStat.wins === 0) {
    if (!next.paused) {
      next.paused = true;
      next.pausedAt = new Date().toISOString();
      next.reason = `3 consecutive losses (win-rate 0%)`;
    }
  }
  // 2. Win-rate below floor after 5+ trades
  if (botStat.trades >= 5 && botStat.wins / botStat.trades < 0.25) {
    if (!next.paused) {
      next.paused = true;
      next.pausedAt = new Date().toISOString();
      next.reason = `Win-rate ${(botStat.wins / botStat.trades * 100).toFixed(0)}% below 25% floor`;
    }
  }
  // 3. Daily loss guard
  const dailyLoss = Math.abs(realizedLossToday(tradeHistory));
  const dailyLossPct = totalDeposited > 0 ? (dailyLoss / totalDeposited) * 100 : 0;
  if (dailyLossPct >= DAILY_LOSS_PCT) {
    next.dailyLossHalt = true;
    if (!next.paused) {
      next.paused = true;
      next.pausedAt = new Date().toISOString();
      next.reason = `Daily loss -${dailyLossPct.toFixed(1)}% hit limit`;
    }
  }
  // 4. Drawdown guard
  const peak = peakEquity(tradeHistory, currentCash, totalDeposited);
  const dd = peak > 0 ? ((peak - currentCash) / peak) * 100 : 0;
  next.maxDrawdownPct = dd;
  if (dd >= MAX_DRAWDOWN_PCT) {
    if (!next.paused) {
      next.paused = true;
      next.pausedAt = new Date().toISOString();
      next.reason = `Drawdown ${dd.toFixed(1)}% breached ${MAX_DRAWDOWN_PCT}% limit`;
    }
  }

  return next;
}

/**
 * The cash reserve the Account Manager always keeps free — a percentage of the
 * deposited equity that the bots are never allowed to commit. This is the core
 * of "never run the account down to almost no money": new positions are only
 * opened while free cash stays above this floor. `cashFloorPct` is clamped 0-90.
 */
export const MIN_CASH_FLOOR_USD = 3_000;

export function cashReserveFloor(totalDeposited: number, cashFloorPct: number): number {
  const pct = Math.max(0, Math.min(90, cashFloorPct || 0));
  const pctFloor = Math.max(0, (totalDeposited || 0) * (pct / 100));
  // The user never wants to trade below $3,000 cash regardless of % settings.
  return Math.max(MIN_CASH_FLOOR_USD, pctFloor);
}

/** Pure helper — computes dynamic position sizing based on portfolio state.
 *  Accepts any array with a `pnl` field so it stays free of circular imports.
 *
 *  The Account Manager (the "80-year-veteran" brain) sizes off the *investable*
 *  cash that sits ABOVE the reserve floor — never the whole balance — so the
 *  account can keep trading and compounding without ever draining to near-zero.
 *  When investable cash is thin it shrinks the position (and relaxes the normal
 *  $50 floor) instead of over-committing; when it is exhausted it returns a
 *  margin of 0 so the engines simply wait for open trades to bank cash back. */
export interface DynamicSizing { margin: number; leverage: number; recoveryMode: boolean; }

/**
 * Momentum Drive sizing — portfolio-proportional engine.
 * Stake = stakePct % of current cash. Leverage scales from 2×
 * (portfolio down) up to maxLeverage (portfolio growing well).
 * Unlike the Account Manager it imposes NO cash-floor and NO
 * recovery-mode cap: the whole balance is in play.
 */
export interface MomentumDriveSizing { margin: number; leverage: number; }
export function computeMomentumDriveSizing(
  cash: number,
  totalDeposited: number,
  stakePct: number,
  maxLeverage: number,
): MomentumDriveSizing {
  const ratio = totalDeposited > 0 ? cash / totalDeposited : 1;
  const pct   = Math.max(0.5, Math.min(10, stakePct));
  const rawMargin = Math.max(0, cash) * (pct / 100);
  const margin = Math.round(Math.max(10, Math.min(10_000, rawMargin)) / 10) * 10;

  // Leverage: 2× when portfolio ≤0.85 of deposited, maxLeverage when ≥1.40
  const minLev = 2;
  const t = Math.max(0, Math.min(1, (ratio - 0.85) / 0.55));
  const leverage = Math.max(minLev, Math.min(maxLeverage, Math.round(minLev + t * (maxLeverage - minLev))));
  return { margin, leverage };
}

export function computeDynamicSizing(
  cash: number,
  totalDeposited: number,
  recentTrades: { pnl: number }[],
  cashFloorPct = 0,
): DynamicSizing {
  // Portfolio health ratio (1.0 = break-even, >1 = winning, <1 = losing)
  const ratio = totalDeposited > 0 ? cash / totalDeposited : 1;

  // Win-rate from the last 10 closed trades (default 50% when data is sparse)
  const sample = recentTrades.slice(0, 10);
  const wr = sample.length >= 3 ? sample.filter((t) => t.pnl > 0).length / sample.length : 0.5;

  // Capital the manager is willing to put to work: only cash ABOVE the reserve.
  const floor = cashReserveFloor(totalDeposited, cashFloorPct);
  const investable = Math.max(0, cash - floor);

  // Recovery mode: balance is low / running down. Trade smaller and calmer until
  // the account refills, rather than swinging the last dollars on big leverage.
  const recoveryMode = investable <= 0 || ratio <= 0.85;

  // Position size: 4% of *investable* cash, scaled by portfolio health.
  const rawMargin = investable * 0.04;
  const sizeScale =
    ratio >= 1.15 ? 1.25 : ratio >= 1.05 ? 1.1 : ratio <= 0.80 ? 0.55 : ratio <= 0.90 ? 0.75 : 1.0;
  // When cash is scarce, don't force the usual $50 minimum — probe with whatever
  // is investable (rounded to $5) so a low balance can't be over-committed.
  const minMargin = investable >= 50 ? 50 : Math.floor(investable / 5) * 5;
  const sized = Math.round((rawMargin * sizeScale) / 10) * 10;
  const margin = investable <= 0 ? 0 : Math.max(minMargin, Math.min(600, sized));

  // Leverage: base 2×, win-rate + health weighted, clamped 2×–5×. In recovery the
  // manager caps leverage low to protect the thin remaining capital.
  const winScore    = Math.max(-1, Math.min(1, (wr - 0.5) * 4));
  const healthScore = Math.max(-1, Math.min(1, (ratio - 1) * 6));
  const combined    = Math.max(-1, Math.min(1, (winScore + healthScore) / 2));
  let leverage      = Math.max(2, Math.min(5, Math.round(2 + combined * 2)));
  if (recoveryMode) leverage = Math.min(leverage, 2);

  return { margin, leverage, recoveryMode };
}

/**
 * Resolve the effective leverage and margin for any bot, respecting the
 * precedence: dynamic capital (Account Manager) > global overrides > per-bot
 * static settings.
 *
 * Engines should call this instead of reading `settings.marginPerTrade` /
 * `settings.leverage` directly. The `botId` selects the correct per-bot static
 * fallback when neither dynamic capital nor global overrides are active.
 */
export function resolveSizing(
  settings: AutoTraderSettings,
  cash: number,
  totalDeposited: number,
  tradeHistory: { pnl: number }[],
  botId: "scalp" | "momentum" | "dipbuyer" | "breakout" | "dca" | "stocks" | "poly" | "flowbot",
): { margin: number; leverage: number; recoveryMode: boolean } {
  // Momentum Drive: highest-priority override — portfolio-proportional, no cap.
  if (settings.momentumDriveEnabled) {
    const drive = computeMomentumDriveSizing(
      cash, totalDeposited,
      settings.momentumDriveStakePct,
      settings.momentumDriveMaxLeverage,
    );
    if (settings.tradeMode === "SHLOMI") drive.leverage = Math.min(drive.leverage, SHLOMI_MAX_LEVERAGE);
    return { ...drive, recoveryMode: false };
  }
  if (settings.dynamicCapitalEnabled) {
    const dyn = computeDynamicSizing(cash, totalDeposited, tradeHistory, settings.cashFloorPct);
    // SHLOMI's low-leverage rule is mode-level — enforce it even under dynamic sizing.
    if (settings.tradeMode === "SHLOMI") dyn.leverage = Math.min(dyn.leverage, SHLOMI_MAX_LEVERAGE);
    return dyn;
  }
  let leverage = settings.leverage;
  let margin = settings.marginPerTrade;
  if (botId === "dipbuyer" || botId === "breakout" || botId === "flowbot") leverage = settings.newBotLeverage;
  if (botId === "dipbuyer") margin = settings.dipStake;
  else if (botId === "breakout") margin = settings.breakoutStake;
  else if (botId === "dca") margin = settings.dcaStake;
  else if (botId === "stocks") margin = settings.stockStakePerTrade;
  else if (botId === "poly") margin = settings.polyStakePerBet;
  else if (botId === "flowbot") margin = settings.flowBotStake;
  if (settings.globalLeverageEnabled) leverage = settings.globalLeverage;
  if (settings.fixedAmountEnabled) margin = settings.fixedAmount;
  // SHLOMI mode enforces god-tier risk management: leverage is hard-capped low,
  // overriding even the global leverage slider.
  if (settings.tradeMode === "SHLOMI") leverage = Math.min(leverage, SHLOMI_MAX_LEVERAGE);
  return { margin, leverage, recoveryMode: false };
}

/**
 * Resolved knobs for one trading-intensity gear (1-5). These multipliers are
 * applied uniformly by every bot engine so the whole fleet shifts together,
 * economy↔sport style. Boost mode overrides this with its own max cadence.
 */
export interface IntensityProfile {
  /** Clamped 1-5 level. */
  level: number;
  /** Short name for the gear. */
  label: string;
  /** Relative trade cadence vs. level 1 (≈ +50% per level: 1 … 5.06). */
  tradeRate: number;
  /** Multiplier on each bot's per-asset cooldown (lower = trades sooner). */
  cooldownMult: number;
  /** Multiplier on each bot's max-open cap (rounded, never below 1). */
  maxOpenMult: number;
  /** Extra rank notches demanded on confidence setups (+ = stricter). */
  confRankAdd: number;
  /** Added to numeric score/conviction thresholds (+ = stricter). */
  scoreAdd: number;
  /** Multiplier on selectivity thresholds & per-asset caution (>1 = stricter). */
  selectivityMult: number;
}

const INTENSITY_LABELS = ["Calm", "Mild", "Balanced", "Aggressive", "Extreme Turbo"] as const;
const INTENSITY_COOLDOWN = [1, 0.67, 0.44, 0.3, 0.2] as const;
const INTENSITY_MAXOPEN = [0.6, 0.8, 1, 1.4, 2] as const;
const INTENSITY_CONFRANK = [1, 1, 0, 0, -1] as const;
const INTENSITY_SCOREADD = [12, 6, 0, -6, -12] as const;
const INTENSITY_SELECTIVITY = [1.3, 1.15, 1, 0.85, 0.7] as const;

/**
 * Fleet-wide trading temperament, applied on top of the intensity gear and to
 * EVERY bot at once:
 * - `NORMAL`   — the regular behaviour (the gear alone governs cadence).
 * - `CALCULATED` — an extra-deliberate, long-horizon mode: the bots become far
 *   stricter, open fewer trades far less often, and ride winners much longer
 *   instead of banking quick scalps. Built for patient, long-term paper trades.
 */
export type TradeMode = "NORMAL" | "CALCULATED" | "SHLOMI";

/** Extra multipliers each long-term trade mode layers over the gear.
 *  SHLOMI ("Shlomi Mode") is the most extreme: a maximally patient, ultra-selective
 *  long-term temperament with the lowest cadence and the fewest, highest-quality
 *  paper trades. Its leverage is also hard-capped low in resolveSizing(). */
const TRADE_MODE_MULTS = {
  NORMAL: {
    cooldown: 1, maxOpen: 1, selectivity: 1, confRank: 0, score: 0, tradeRate: 1,
  },
  CALCULATED: {
    cooldown: 2.5, maxOpen: 0.6, selectivity: 1.6, confRank: 1, score: 10, tradeRate: 0.4,
  },
  SHLOMI: {
    cooldown: 4.5, maxOpen: 0.35, selectivity: 2.4, confRank: 2, score: 20, tradeRate: 0.15,
  },
} as const;

/** Hard ceiling on leverage while in SHLOMI mode — god-tier risk management. */
export const SHLOMI_MAX_LEVERAGE = 2;

/**
 * Resolve the multipliers for a trading-intensity gear (clamps to 1-5),
 * optionally layered with the fleet-wide trade mode. CALCULATED and SHLOMI make
 * every bot stricter and slower for long-term, higher-conviction paper trades;
 * SHLOMI is the most extreme, patient, quality-over-quantity temperament.
 */
export function intensityProfile(level: number, mode: TradeMode = "NORMAL"): IntensityProfile {
  const l = Math.max(1, Math.min(5, Math.round(level) || 1));
  const i = l - 1;
  const m = TRADE_MODE_MULTS[mode] ?? TRADE_MODE_MULTS.NORMAL;
  return {
    level: l,
    label: INTENSITY_LABELS[i],
    tradeRate: Math.round(Math.pow(1.5, i) * m.tradeRate * 100) / 100,
    cooldownMult: INTENSITY_COOLDOWN[i] * m.cooldown,
    maxOpenMult: INTENSITY_MAXOPEN[i] * m.maxOpen,
    confRankAdd: INTENSITY_CONFRANK[i] + m.confRank,
    scoreAdd: INTENSITY_SCOREADD[i] + m.score,
    selectivityMult: INTENSITY_SELECTIVITY[i] * m.selectivity,
  };
}

export interface AutoTraderSettings {
  enabled: boolean;
  /**
   * Fleet-wide pause switch: all bots stop opening NEW positions but existing
   * ones stay alive and SL/TP continues to manage them normally. Unpausing
   * immediately resumes auto-opens. Unlike disarming, this does NOT close
   * positions or change any per-bot arm state.
   */
  fleetPaused: boolean;
  /** When true the engine overrides all margin/leverage/stake settings with a
   *  rule-based formula derived from portfolio value, health, and recent win-rate. */
  dynamicCapitalEnabled: boolean;
  /** Auto-Pilot: one master switch that hands every per-trade decision to the
   *  system — position sizing, leverage, SL/TP and the full management stack —
   *  so the whole fleet runs fully hands-off. Paper-trading/educational only. */
  autoPilotEnabled: boolean;
  /** Cash committed as margin per auto trade (USD). */
  marginPerTrade: number;
  leverage: number;
  minConfidence: ScalpConfidence;
  allowLong: boolean;
  allowShort: boolean;
  /** Hard cap on simultaneously open auto positions. */
  maxOpenPositions: number;
  /** Only auto-trade assets the user has starred. */
  favoritesOnly: boolean;

  /**
   * Boost mode: epoch-ms deadline until which every bot trades at maximum
   * cadence (near-zero cooldowns, fast profit-banking, faster polling) to rack
   * up many small, quick paper trades. 0 = off / expired.
   */
  boostUntil: number;
  /** User-chosen boost run length in minutes (5 min – 5 h). Persisted so the
   *  boost button reuses the last duration. */
  boostDurationMin: number;

  /**
   * Account Manager cash reserve: the % of deposited equity the manager always
   * keeps as free cash. Bots never open a trade that would push free cash below
   * this floor, so the account can't be run down to almost no money. 0 = off.
   */
  cashFloorPct: number;

  /**
   * Trading-intensity gear (1-5) applied to EVERY bot, like an economy↔sport
   * dial. Level 1 is calm — fewest trades, the strictest setups, a focus on
   * larger, higher-quality wins. Each level up loosens selectivity and roughly
   * +50% the trade cadence over the level below it; level 5 is extreme turbo.
   * Boost mode (when active) still overrides this with its own max cadence.
   *
   * This is the fallback gear used for any wallet without its own saved level
   * (see `intensityByWallet`); the engines read the *effective* gear, which the
   * provider resolves per active wallet.
   */
  intensity: number;

  /**
   * Per-wallet trading-intensity gear, keyed by portfolio wallet id. Each
   * simulator wallet remembers its own gear, so a "calm" wallet and a "turbo"
   * wallet kept side by side don't share one setting. A wallet without an entry
   * falls back to `intensity`. The provider exposes the active wallet's gear as
   * `settings.intensity`, so every engine keeps reading one value.
   */
  intensityByWallet: Record<string, number>;

  /**
   * Per-wallet bot settings overrides. Each wallet can have its own copy of
   * every bot setting (leverage, margin, enabled, strategy, etc.) so a "calm"
   * long-term wallet and an "aggressive" scalping wallet don't share one config.
   * A wallet without an entry falls back to the global settings.
   *
   * The `walletSettings` field is NEVER stored inside a wallet override (it is
   * stripped by the setter); the active wallet's override is merged on top of the
   * global defaults in `effectiveSettings`.
   */
  walletSettings: Record<string, Partial<AutoTraderSettings>>;

  /**
   * Fleet-wide trade temperament applied to EVERY bot on top of the gear:
   * "NORMAL" = regular behaviour; "CALCULATED" = an extra-deliberate, long-term
   * mode that makes the bots much stricter, trade far less often, and ride
   * winners longer instead of banking quick scalps.
   */
  tradeMode: TradeMode;

  /* ── Warrior-trading additions ── */
  /** Signal sources: scalp setups, momentum runners, or both. */
  strategy: TradeStrategy;
  /** Minimum momentum surge score (0-100) required to open a momentum trade. */
  minMomentumScore: number;
  /** Ride winners with a trailing stop that ratchets toward price. */
  trailingEnabled: boolean;
  /** Favorable move (price %) required before the trailing stop arms. */
  trailActivatePct: number;
  /** Distance (price %) the trailing stop sits behind the peak once armed. */
  trailDistancePct: number;
  /** Halt opening new trades after the day's realized loss hits this cap. */
  dailyStopEnabled: boolean;
  /** Daily max realized loss as a percent of deposited equity. */
  dailyMaxLossPct: number;

  /* ── Smart Exit: fast scalp closes + ride-the-winner (applies to bot crypto trades) ── */
  /** Manage exits on bot trades: bank small wins fast, let big winners run. */
  smartExitEnabled: boolean;
  /** Favorable move (price %) at which the profit-protecting trail starts working. */
  scalpTakeProfitPct: number;
  /** Pullback from peak (price %) that banks a small scalp once in profit. */
  scalpGivebackPct: number;
  /** Favorable move (price %) that promotes a trade to "runner" (ride it). */
  runnerTriggerPct: number;
  /** Pullback from peak (price %) a runner is allowed before the manager exits. */
  runnerTrailPct: number;
  /** Recycle a stale-but-profitable bot trade after this many seconds (0 = off). */
  maxScalpHoldSec: number;

  /* ── Risk Guardian (highest-level capital protection) ── */
  /** Force-exit a leveraged position before it can be liquidated. */
  catastrophicExitEnabled: boolean;
  /** Emergency exit once a position's unrealized loss eats this % of its margin. */
  maxLossPerTradePct: number;
  /** Flatten the entire book when equity drawdown becomes unrecoverable. */
  portfolioStopEnabled: boolean;
  /** Max equity drawdown from the running peak (%) before the kill-switch fires. */
  portfolioMaxDrawdownPct: number;

  /* ── Smart-Money stock bot (influencer + technical, LONG & SHORT) ── */
  /** Master switch for the Wall-Street-grade stock bot. */
  stocksEnabled: boolean;
  /** USD committed per stock trade. */
  stockStakePerTrade: number;
  /** Hard cap on simultaneously open auto stock positions. */
  stockMaxOpen: number;
  /** Minimum combined conviction (0-100) required to open a stock trade. */
  stockMinConfidence: number;

  /* ── Polymarket BTC auto-investor (same-day up/down bets) ── */
  /** Master switch for the Bitcoin prediction-market bot. */
  polyEnabled: boolean;
  /** USD staked per Polymarket bet. */
  polyStakePerBet: number;
  /** Hard cap on simultaneously open Polymarket bets. */
  polyMaxOpenBets: number;
  /** Minimum BTC 24h move (abs %) required before the bot takes a directional bet. */
  polyMinBiasPct: number;
  /** Only consider BTC markets resolving within this many hours (same-day focus). */
  polyHorizonHours: number;
  /** Close a bet once its value is up this % from entry. */
  polyTakeProfitPct: number;
  /** Close a bet once its value is down this % from entry (irreversible-bet exit). */
  polyStopLossPct: number;

  /* ── Global fleet-wide overrides ── */
  /** When on, all bots use the same fleet-wide leverage (globalLeverage). */
  globalLeverageEnabled: boolean;
  /** Fleet-wide leverage override applied to every bot when enabled. */
  globalLeverage: number;
  /** When on, every bot stakes the same fixed amount (fixedAmount) per trade. */
  fixedAmountEnabled: boolean;
  /** Fixed USD amount every bot commits when fixedAmountEnabled is true. */
  fixedAmount: number;

  /* ── Adaptive manager + 3 additional simulator bots ── */
  /** Let the manager nudge each new bot's selectivity from its own track record. */
  adaptiveEnabled: boolean;
  /** Shared leverage for the two crypto bots below. */
  newBotLeverage: number;

  /** Dip Buyer — buys the biggest crypto 24h losers (contrarian LONG). */
  dipEnabled: boolean;
  dipStake: number;
  dipMaxOpen: number;
  /** Minimum 24h drop (abs %) before the dip buyer steps in. */
  dipMinDropPct: number;

  /** Breakout Hunter — buys the strongest crypto 24h gainers (continuation LONG). */
  breakoutEnabled: boolean;
  breakoutStake: number;
  breakoutMaxOpen: number;
  /** Minimum 24h gain (%) required to chase a breakout. */
  breakoutMinGainPct: number;

  /** Blue-Chip DCA — periodically accumulates small large-cap stock positions. */
  dcaEnabled: boolean;
  dcaStake: number;
  dcaMaxOpen: number;
  /** Minutes between DCA accumulation buys. */
  dcaIntervalMin: number;

  /** Funding Arb — opens delta-neutral cash-and-carry paper pairs that accrue simulated funding. */
  fundingEnabled: boolean;
  /** Capital committed per delta-neutral pair (USD). */
  fundingStake: number;
  fundingMaxOpen: number;
  /** Minimum annualized funding (%) before the bot opens a pair. */
  fundingMinAnnualizedPct: number;

  /** Options Agent — buys long paper CALL/PUT contracts (crypto + stocks); max loss = premium. */
  optionsEnabled: boolean;
  /** Premium budget committed per option (USD). */
  optionStakePerTrade: number;
  optionMaxOpen: number;
  /** Minimum signal confidence (0–100) before the agent buys a contract. */
  optionMinConfidence: number;
  /** Days to expiry for newly opened options. */
  optionExpiryDays: number;

  /** Order Flow Bot — reads live Binance Order Book + AggTrades and opens directional paper positions. */
  flowBotEnabled: boolean;
  /** Symbol to watch (e.g. BTCUSDT). */
  flowBotSymbol: string;
  /** Margin per trade (USD). */
  flowBotStake: number;
  /** Max open positions at once. */
  flowBotMaxOpen: number;
  /** Minimum |feel| required before opening (0..1). */
  flowBotMinFeel: number;
  /** Minimum feelStrength (0..100) required before opening. */
  flowBotMinStrength: number;
  /** Leverage for flow-bot trades. */
  flowBotLeverage: number;
  /** Hold-time seconds before auto-close (scalp-style). */
  flowBotMaxHoldSec: number;

  /** Per-bot rolling scorecards (keyed by NewBotId). */
  botStats: Record<string, BotStat>;

  /* ── Per-asset caution: learn which coins the bots keep losing on ── */
  /**
   * Let the bots raise their caution/precision on specific coins they keep
   * losing trades on (require a stronger setup before opening there again).
   */
  assetCautionEnabled: boolean;
  /**
   * Per-asset rolling scorecards keyed by symbol (e.g. "BTC", "AAPL"). Here
   * `edge` is the caution multiplier: 1 = normal, >1 = demand a stronger setup.
   */
  assetStats: Record<string, BotStat>;
  /**
   * Ids of closed trades already folded into `assetStats`. Persisted (and capped)
   * so a reload or wallet switch can never re-count the same trade. Each wallet's
   * history is wallet-scoped, so this global set is the only reliable dedupe.
   */
  recordedTradeIds: string[];

  /* ── Risk Manager: per-bot kill-switches & supervisor ── */
  /** Let the Risk Manager supervise every bot and auto-pause losers. */
  riskManagerEnabled: boolean;
  /** Per-bot risk guard states (keyed by bot id). */
  riskGuards: Record<string, RiskGuard>;

  /* ── Alpha Convergence Coordinator (fleet-level conviction) ── */
  /**
   * The top-level coordinating "brain": it reads the live agreement (confluence)
   * across every signal source — scalp setups, momentum runners and the
   * smart-money stock votes — and resolves one dominant fleet direction. When on,
   * the bots move as a coordinated formation: trades that align with the fleet's
   * conviction clear an easier bar and get extra slots, while trades that fight
   * the consensus must clear a stricter one. Paper-trading discipline only — it
   * concentrates the bots' agreement, it does not move any real market.
   */
  alphaCoordinatorEnabled: boolean;

  /* ── Max Performance mode ── */
  /**
   * One-tap "max mode": push the whole fleet to maximum intensity (gear 5),
   * fleet-wide top leverage, the fastest cadence and the highest open-position
   * caps. It NEVER overrides the user's fixed-vs-dynamic sizing choice, and it
   * always keeps the safety nets — the $3,000 cash floor and the Risk Manager's
   * auto-pause-on-losses guards — active. The overrides are computed on top of
   * the saved settings (see `effectiveSettings`), so toggling it off restores
   * every original value untouched.
   */
  maxPerfEnabled: boolean;

  /* ── Momentum Drive (Drive Bot) ── */
  /**
   * Portfolio-proportional sizing engine that calibrates EVERY bot's leverage
   * and stake in real time based on current cash equity. Unlike the Account
   * Manager there is no cash-floor reserve and no recovery-mode cap — the whole
   * balance is in play. The transaction count is uncapped (maxOpenPositions
   * lifted to 50); only available cash limits how many trades open at once.
   * Takes highest priority in resolveSizing (above dynamicCapitalEnabled).
   */
  momentumDriveEnabled: boolean;
  /** Percent of current cash committed as margin per trade (0.5–10 %). */
  momentumDriveStakePct: number;
  /** Upper leverage ceiling the drive can reach when portfolio is growing (2–20×). */
  momentumDriveMaxLeverage: number;
}

export const DEFAULT_SETTINGS: AutoTraderSettings = {
  enabled: false,
  fleetPaused: false,
  dynamicCapitalEnabled: false,
  autoPilotEnabled: false,
  marginPerTrade: 100,
  leverage: 3,
  minConfidence: "HIGH",
  allowLong: true,
  allowShort: true,
  maxOpenPositions: 5,
  favoritesOnly: false,
  boostUntil: 0,
  boostDurationMin: 5,
  cashFloorPct: 20,
  intensity: 2,
  intensityByWallet: {},
  walletSettings: {},
  tradeMode: "NORMAL",

  strategy: "BOTH",
  minMomentumScore: 55,
  trailingEnabled: true,
  trailActivatePct: 1.5,
  trailDistancePct: 1.0,
  dailyStopEnabled: true,
  dailyMaxLossPct: 8,

  smartExitEnabled: true,
  scalpTakeProfitPct: 0.6,
  scalpGivebackPct: 0.3,
  runnerTriggerPct: 1.5,
  runnerTrailPct: 0.8,
  maxScalpHoldSec: 90,

  catastrophicExitEnabled: true,
  maxLossPerTradePct: 30,
  portfolioStopEnabled: true,
  portfolioMaxDrawdownPct: 20,

  stocksEnabled: false,
  stockStakePerTrade: 200,
  stockMaxOpen: 5,
  stockMinConfidence: 55,

  polyEnabled: false,
  polyStakePerBet: 25,
  polyMaxOpenBets: 4,
  polyMinBiasPct: 0.6,
  polyHorizonHours: 48,
  polyTakeProfitPct: 40,
  polyStopLossPct: 50,

  adaptiveEnabled: true,
  globalLeverageEnabled: false,
  globalLeverage: 3,
  fixedAmountEnabled: false,
  fixedAmount: 100,
  newBotLeverage: 3,

  dipEnabled: false,
  dipStake: 100,
  dipMaxOpen: 3,
  dipMinDropPct: 5,

  breakoutEnabled: false,
  breakoutStake: 100,
  breakoutMaxOpen: 3,
  breakoutMinGainPct: 6,

  dcaEnabled: false,
  dcaStake: 150,
  dcaMaxOpen: 6,
  dcaIntervalMin: 30,

  fundingEnabled: false,
  fundingStake: 200,
  fundingMaxOpen: 4,
  fundingMinAnnualizedPct: 8,

  optionsEnabled: false,
  optionStakePerTrade: 150,
  optionMaxOpen: 4,
  optionMinConfidence: 60,
  optionExpiryDays: 7,

  flowBotEnabled: false,
  flowBotSymbol: "BTCUSDT",
  flowBotStake: 150,
  flowBotMaxOpen: 2,
  flowBotMinFeel: 0.25,
  flowBotMinStrength: 40,
  flowBotLeverage: 3,
  flowBotMaxHoldSec: 60,

  botStats: {},

  assetCautionEnabled: true,
  assetStats: {},
  recordedTradeIds: [],

  riskManagerEnabled: true,
  riskGuards: {},

  alphaCoordinatorEnabled: true,

  maxPerfEnabled: false,

  momentumDriveEnabled: false,
  momentumDriveStakePct: 2,
  momentumDriveMaxLeverage: 8,
};

/**
 * Live, fleet-wide conviction resolved by the Alpha Convergence Coordinator.
 * Ephemeral (not persisted) — recomputed from the current signal sources each
 * time they refresh and published by the auto-trader engine.
 */
export interface AlphaState {
  /** Dominant fleet direction, or NEUTRAL when there is no clear majority. */
  direction: "LONG" | "SHORT" | "NEUTRAL";
  /** Strength of agreement of the dominant side, 0-100. */
  confluence: number;
  /** Weighted long votes across every signal source. */
  longVotes: number;
  /** Weighted short votes across every signal source. */
  shortVotes: number;
  /** Total weighted directional votes seen this cycle. */
  total: number;
  /** Distinct signal sources that contributed (scalp / momentum / smart-money). */
  sources: number;
  /** Rolling win-rate (0-100) over the master's recent closed trades. */
  recentWinRate: number;
  /** Number of recent closed trades the win-rate is computed from. */
  recentSample: number;
  /**
   * "Control level" 0-100 — how much command the master has earned from its own
   * track record. Blends recent win-rate with sample size so a couple of lucky
   * trades don't inflate it. Higher = the fleet acts with a bit more conviction.
   */
  masteryScore: number;
  /** epoch-ms of the last recompute. */
  updatedAt: number;
}

export const NEUTRAL_ALPHA: AlphaState = {
  direction: "NEUTRAL",
  confluence: 0,
  longVotes: 0,
  shortVotes: 0,
  total: 0,
  sources: 0,
  recentWinRate: 0,
  recentSample: 0,
  masteryScore: 0,
  updatedAt: 0,
};

/** Confluence (%) at or above which the coordinator commits to a direction. */
export const ALPHA_COMMIT_PCT = 55;
/** Confluence (%) at or above which the fleet presses its advantage (extra slots). */
export const ALPHA_STRONG_PCT = 65;

/**
 * Resolve how the Alpha Coordinator should bias one candidate trade. Aligned
 * trades clear an easier bar (lower selectivity, possibly one confidence notch
 * cheaper); trades that fight the fleet's conviction must clear a stricter one.
 */
export function alphaAdjust(
  alpha: AlphaState | null | undefined,
  enabled: boolean,
  dir: "LONG" | "SHORT",
): { selMult: number; rankAdd: number } {
  if (!enabled || !alpha || alpha.direction === "NEUTRAL") return { selMult: 1, rankAdd: 0 };
  const strength = Math.min(1, alpha.confluence / 100);
  const aligned = alpha.direction === dir;
  // Earned "control level" lends the master a small, strictly bounded extra edge
  // on aligned trades only (max 10% easier). It NEVER loosens an opposing trade,
  // so a hot streak can't make the fleet reckless against its own conviction.
  const mastery = Math.min(1, Math.max(0, (alpha.masteryScore ?? 0) / 100));
  const masteryEase = aligned ? 0.1 * mastery : 0;
  return {
    // Aligned: up to 35% easier (+ up to 10% from earned mastery). Opposing: up to 60% stricter.
    selMult: aligned ? 1 - 0.35 * strength - masteryEase : 1 + 0.6 * strength,
    // Once conviction is firm, shift the scalp confidence bar by one notch.
    rankAdd: strength >= 0.5 ? (aligned ? -1 : 1) : 0,
  };
}

/* ── Scalp Squad: five coordinated scalp bots ─────────────────────────────── */

/** A minimal scalp setup the coordinator reasons about when distributing work. */
export interface ScalpCandidate {
  asset: string;
  direction: "LONG" | "SHORT";
  score: number;
  confidence: ScalpConfidence;
}

/** One member of the scalp squad — a persona with its own preferred slice of
 *  the live scalp signals. `fit` returns 0-1: how well a candidate suits it. */
export interface ScalpSquadMember {
  id: string;
  fit: (c: ScalpCandidate) => number;
}

const CONF_WEIGHT: Record<ScalpConfidence, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

/**
 * The five-member scalp squad. Each persona leans toward a different slice of
 * the live scalp feed so the squad spreads across the book instead of all five
 * piling onto one coin. The coordinator (`assignScalpSquad`) blends each fit
 * with a load penalty so work is shared.
 */
export const SCALP_SQUAD: ScalpSquadMember[] = [
  {
    id: "vanguard",
    // Loves the highest-conviction setups regardless of direction.
    fit: (c) => 0.4 + 0.3 * (CONF_WEIGHT[c.confidence] / 2) + 0.3 * Math.min(1, c.score / 100),
  },
  {
    id: "longrider",
    fit: (c) => (c.direction === "LONG" ? 0.85 + 0.15 * Math.min(1, c.score / 100) : 0.1),
  },
  {
    id: "shorthunter",
    fit: (c) => (c.direction === "SHORT" ? 0.85 + 0.15 * Math.min(1, c.score / 100) : 0.1),
  },
  {
    id: "scout",
    fit: (c) => 0.5 + 0.35 * (c.confidence === "MEDIUM" ? 1 : 0.35) + 0.1 * Math.min(1, c.score / 100),
  },
  {
    id: "sweeper",
    // Flat fit: the safety net that mops up leftovers the others skipped.
    fit: () => 0.45,
  },
];

/**
 * Map member id to the source tag. The source is built as
 * "Scalp Squad · [TranslatedName]" and stored in trades/positions.
 * This is used by autotrader-engine to mark which squad member opened a trade.
 */
const MEMBER_ID_TO_SOURCE_KEY: Record<string, string> = {
  vanguard: "bots.squad.vanguard.source",
  longrider: "bots.squad.longrider.source",
  shorthunter: "bots.squad.shorthunter.source",
  scout: "bots.squad.scout.source",
  sweeper: "bots.squad.sweeper.source",
};

/**
 * Get the source tag key for a squad member by id.
 * The returned key can be passed to t() to get the translated source string.
 */
export function getSquadMemberSourceKey(memberId: string): string | undefined {
  return MEMBER_ID_TO_SOURCE_KEY[memberId];
}

/** Look up a squad member by its id. */
export function getSquadMemberById(memberId: string | undefined | null): ScalpSquadMember | undefined {
  if (!memberId) return undefined;
  return SCALP_SQUAD.find((m) => m.id === memberId);
}

/**
 * Look up a squad member by its trade `source` tag (starts with "Scalp Squad").
 * Since the source strings are translated, we match against the English name patterns.
 */
export function squadMemberBySource(source: string | undefined | null): ScalpSquadMember | undefined {
  if (!source || !source.startsWith("Scalp Squad")) return undefined;
  // Match against English name patterns in the source string
  // e.g., "Scalp Squad · Spearhead" → vanguard
  const sourcePatterns: Record<string, string> = {
    Spearhead: "vanguard",
    "Trend Rider": "longrider",
    "Short Hunter": "shorthunter",
    Scout: "scout",
    Sweeper: "sweeper",
  };
  for (const [pattern, memberId] of Object.entries(sourcePatterns)) {
    if (source.includes(pattern)) {
      return getSquadMemberById(memberId);
    }
  }
  return undefined;
}

/**
 * Coordinator: distribute scalp candidates across the five squad members by fit,
 * sharing the load so it behaves like a squad (not one greedy bot). Strongest
 * setups are placed first; each member has a soft per-member cap so no single
 * bot hoards every slot. Returns a map of asset → assigned member.
 *
 * Asset-level de-duping (one position per coin) is handled upstream by the
 * engine, so two members never hold the same coin unless the engine's own
 * confluence rules open an extra slot. When the engine does allow a stack, it
 * passes `heldByAsset` (asset → member ids already on that coin) so the extra
 * slot is given to a DIFFERENT member — a real second bot backing the move,
 * never the same bot doubling its own position.
 */
export function assignScalpSquad(
  candidates: ScalpCandidate[],
  opts: { perMemberMax: number; heldByAsset?: Map<string, Set<string>> },
): Map<string, ScalpSquadMember> {
  const out = new Map<string, ScalpSquadMember>();
  const load: Record<string, number> = {};
  for (const m of SCALP_SQUAD) load[m.id] = 0;
  const perMemberMax = Math.max(1, opts.perMemberMax);
  const held = opts.heldByAsset;
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  for (const c of sorted) {
    const exclude = held?.get(c.asset);
    let best: ScalpSquadMember | null = null;
    let bestScore = -Infinity;
    for (const m of SCALP_SQUAD) {
      if (load[m.id] >= perMemberMax) continue;
      if (exclude?.has(m.id)) continue; // don't re-stack the same bot on a coin
      // Blend fit with a load penalty so work spreads across the squad.
      const s = m.fit(c) - load[m.id] * 0.15;
      if (s > bestScore) {
        bestScore = s;
        best = m;
      }
    }
    // Every eligible member is full → fall back to a member not already on the
    // coin (sweeper first), so a stacked slot is still a distinct backer.
    if (!best) {
      best = [...SCALP_SQUAD].reverse().find((m) => !exclude?.has(m.id)) ?? SCALP_SQUAD[SCALP_SQUAD.length - 1];
    }
    out.set(c.asset, best);
    load[best.id] += 1;
  }
  return out;
}

const STORAGE_KEY = "arb_scan_autotrader";

/** Default length of a Boost run (max-cadence trading) in milliseconds. */
export const BOOST_DURATION_MS = 5 * 60 * 1000;
/** Hard ceiling on a single Boost run — 5 hours. */
export const BOOST_MAX_MS = 5 * 60 * 60 * 1000;

interface AutoTraderContextValue {
  settings: AutoTraderSettings;
  /**
   * The shared default gear (raw `settings.intensity`) BEFORE any per-wallet
   * override is applied. Use this — not `settings.intensity`, which the provider
   * overwrites with the *active* wallet's effective gear — as the fallback for
   * wallets that have never set their own gear.
   */
  baseIntensity: number;
  update: (patch: Partial<AutoTraderSettings>) => void;
  /** Set the intensity gear for any wallet by id (not limited to the active one). */
  setWalletIntensity: (walletId: string, level: number) => void;
  toggleEnabled: () => void;
  /** Arm every bot and run max-cadence Boost mode for durationMs (default 5 min). */
  startBoost: (durationMs?: number) => void;
  /** End Boost mode immediately; bots stay armed at their normal cadence. */
  stopBoost: () => void;
  /** Read a bot's scorecard (returns a fresh blank one if untracked). */
  getBotStat: (botId: string) => BotStat;
  /** Record one closed paper trade for a bot; the manager adapts its edge. */
  recordBotResult: (botId: string, pnl: number) => void;
  /** Wipe a single bot's scorecard, or all of them when no id is given. */
  resetBotStats: (botId?: string) => void;

  /* ── Per-asset caution ── */
  /** Read one coin's scorecard (returns a fresh blank one if untracked). */
  getAssetStat: (asset: string) => BotStat;
  /** Caution multiplier for a coin (1 = normal; >1 = demand a stronger setup). */
  getAssetCaution: (asset: string) => number;
  /** Record one closed paper trade for a coin; raises caution after losses. Pass the
   *  trade id to dedupe so the same trade is never folded twice (reload/wallet switch). */
  recordAssetResult: (asset: string, pnl: number, tradeId?: string) => void;
  /** Wipe a single coin's caution record, or all of them when no id is given. */
  resetAssetStats: (asset?: string) => void;

  /* ── Risk Manager ── */
  /** Read a bot's risk guard (returns fresh blank if untracked). */
  getRiskGuard: (botId: string) => RiskGuard;
  /** Evaluate a bot's risk state and update the guard. */
  evaluateRisk: (botId: string, tradeHistory: { pnl: number; closedAt: string }[], currentCash: number, totalDeposited: number) => void;
  /** Reset a bot's risk guard (un-pause). */
  resetRiskGuard: (botId?: string) => void;

  /* ── Alpha Convergence Coordinator ── */
  /** Live fleet-wide conviction resolved across every signal source. */
  alpha: AlphaState;
  /** Publish a freshly computed fleet conviction (called by the engine). */
  publishAlpha: (a: AlphaState) => void;
}

function loadSettings(): AutoTraderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AutoTraderSettings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

const AutoTraderContext = createContext<AutoTraderContextValue | null>(null);

export function AutoTraderProvider({ children }: { children: ReactNode }) {
  // Prefer the server snapshot (captured at hydration); fall back to the local
  // cache when the server has no bot settings for this account yet.
  const sync = useServerSync();
  const serverSettings = sync.getServerData("autotrader");
  const [settings, setSettings] = useState<AutoTraderSettings>(() =>
    serverSettings !== null
      ? { ...DEFAULT_SETTINGS, ...(serverSettings as Partial<AutoTraderSettings>) }
      : loadSettings(),
  );
  // Ephemeral live fleet conviction — never persisted; the engine republishes it
  // from the current signal sources on every refresh.
  const [alpha, setAlpha] = useState<AlphaState>(NEUTRAL_ALPHA);
  const publishAlpha = useCallback((a: AlphaState) => setAlpha(a), []);

  // When a new wallet is created, disarm every bot for that specific wallet so
  // the user starts fresh. All leverage/stake settings stay untouched; only the
  // enablement flags are set to false.
  useEffect(() => {
    const handler = (e: CustomEvent<{ walletId: string }>) => {
      const wid = e.detail.walletId;
      setSettings((prev) => ({
        ...prev,
        walletSettings: {
          ...prev.walletSettings,
          [wid]: {
            ...(prev.walletSettings[wid] ?? {}),
            enabled: false,
            stocksEnabled: false,
            polyEnabled: false,
            dipEnabled: false,
            breakoutEnabled: false,
            dcaEnabled: false,
            fundingEnabled: false,
            optionsEnabled: false,
            flowBotEnabled: false,
            alphaCoordinatorEnabled: false,
            dynamicCapitalEnabled: false,
            maxPerfEnabled: false,
            momentumDriveEnabled: false,
          },
        },
      }));
    };
    window.addEventListener("wallet-created", handler as EventListener);
    return () => window.removeEventListener("wallet-created", handler as EventListener);
  }, []);

  // When a wallet is deleted, clean up its per-wallet settings so the storage
  // never accumulates orphaned state.
  useEffect(() => {
    const handler = (e: CustomEvent<{ walletId: string }>) => {
      const wid = e.detail.walletId;
      setSettings((prev) => {
        const { [wid]: _, ...restWalletSettings } = prev.walletSettings;
        const { [wid]: __, ...restIntensity } = prev.intensityByWallet;
        return { ...prev, walletSettings: restWalletSettings, intensityByWallet: restIntensity };
      });
    };
    window.addEventListener("wallet-deleted", handler as EventListener);
    return () => window.removeEventListener("wallet-deleted", handler as EventListener);
  }, []);

  // The trading-intensity gear is per-wallet. Track the active wallet so the gear
  // a user sets travels with the wallet, and read it back when they switch.
  const { activeWalletId } = usePortfolio();
  const activeWalletIdRef = useRef(activeWalletId);
  activeWalletIdRef.current = activeWalletId;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  // Server sync: seed once if the server had no settings, then push every change
  // so bot configuration survives across devices for this signed-in account.
  const didServerSeed = useRef(false);
  useEffect(() => {
    if (!didServerSeed.current) {
      didServerSeed.current = true;
      if (sync.hydrationOk && serverSettings === null) {
        sync.save("autotrader", settings);
      }
      return;
    }
    sync.save("autotrader", settings);
  }, [settings]);

  /** Fields that are truly global (fleet-wide) and never scoped per-wallet. */
  const GLOBAL_SETTINGS_KEYS = useMemo(
    () =>
      new Set<keyof AutoTraderSettings>([
        "walletSettings",
        "intensityByWallet",
        "botStats",
        "assetStats",
        "recordedTradeIds",
        "riskGuards",
        "boostUntil",
        "boostDurationMin",
        "maxPerfEnabled",
        "momentumDriveEnabled",
        "momentumDriveStakePct",
        "momentumDriveMaxLeverage",
        "alphaCoordinatorEnabled",
      ]),
    [],
  );

  const update = useCallback((patch: Partial<AutoTraderSettings>) => {
    setSettings((prev) => {
      const wid = activeWalletIdRef.current;

      // If there's no active wallet, everything is global
      if (!wid) {
        return { ...prev, ...patch };
      }

      // Separate global fields from wallet-specific fields
      const globalPatch: Partial<AutoTraderSettings> = {};
      const walletPatch: Partial<AutoTraderSettings> = {};

      for (const [key, value] of Object.entries(patch)) {
        const k = key as keyof AutoTraderSettings;
        if (GLOBAL_SETTINGS_KEYS.has(k)) {
          (globalPatch as any)[k] = value;
        } else {
          (walletPatch as any)[k] = value;
        }
      }

      // Handle intensity specially (existing intensityByWallet mechanism)
      if (patch.intensity !== undefined) {
        const level = Math.max(1, Math.min(5, Math.round(patch.intensity) || 1));
        globalPatch.intensityByWallet = {
          ...prev.intensityByWallet,
          [wid]: level,
        };
        // Don't store intensity in walletSettings; it stays in intensityByWallet
        delete (walletPatch as any).intensity;
      }

      const hasWalletChanges = Object.keys(walletPatch).length > 0;
      const hasGlobalChanges = Object.keys(globalPatch).length > 0;

      if (!hasWalletChanges && !hasGlobalChanges) {
        return prev;
      }

      const nextWalletSettings = hasWalletChanges
        ? {
            ...prev.walletSettings,
            [wid]: { ...(prev.walletSettings[wid] ?? {}), ...walletPatch },
          }
        : prev.walletSettings;

      return {
        ...prev,
        ...globalPatch,
        walletSettings: nextWalletSettings,
      };
    });
  }, []);

  const setWalletIntensity = useCallback((walletId: string, level: number) => {
    const clamped = Math.max(1, Math.min(5, Math.round(level) || 1));
    setSettings((prev) => ({
      ...prev,
      intensityByWallet: { ...prev.intensityByWallet, [walletId]: clamped },
    }));
  }, []);

  const toggleEnabled = useCallback(() => {
    const wid = activeWalletIdRef.current;
    if (!wid) {
      setSettings((prev) => ({ ...prev, enabled: !prev.enabled }));
      return;
    }
    const perWallet = settings.walletSettings[wid];
    const current = perWallet?.enabled ?? settings.enabled;
    update({ enabled: !current });
  }, [settings, update]);

  const startBoost = useCallback((durationMs = BOOST_DURATION_MS) => {
    // boostUntil is global (controls the fleet-wide timer), while bot enablements
    // are routed to the active wallet via update().
    update({
      enabled: true,
      strategy: "BOTH",
      stocksEnabled: true,
      polyEnabled: true,
      dipEnabled: true,
      breakoutEnabled: true,
      dcaEnabled: true,
      fundingEnabled: true,
      optionsEnabled: true,
      boostUntil: Date.now() + Math.min(BOOST_MAX_MS, Math.max(1000, durationMs)),
    });
  }, [update]);

  const stopBoost = useCallback(() => {
    setSettings((prev) => (prev.boostUntil ? { ...prev, boostUntil: 0 } : prev));
  }, []);

  // Auto-clear the boost deadline once it lapses so the UI and engines revert to
  // their normal cadence without anyone having to press "stop".
  useEffect(() => {
    if (!settings.boostUntil) return;
    const ms = settings.boostUntil - Date.now();
    if (ms <= 0) {
      setSettings((prev) => (prev.boostUntil ? { ...prev, boostUntil: 0 } : prev));
      return;
    }
    const t = setTimeout(() => {
      setSettings((prev) => (prev.boostUntil ? { ...prev, boostUntil: 0 } : prev));
    }, ms);
    return () => clearTimeout(t);
  }, [settings.boostUntil]);

  const getBotStat = useCallback(
    (botId: string): BotStat => settings.botStats[botId] ?? freshBotStat(),
    [settings.botStats],
  );

  const recordBotResult = useCallback((botId: string, pnl: number) => {
    setSettings((prev) => {
      const cur = prev.botStats[botId] ?? freshBotStat();
      const won = pnl >= 0;
      const next: BotStat = {
        trades: cur.trades + 1,
        wins: cur.wins + (won ? 1 : 0),
        losses: cur.losses + (won ? 0 : 1),
        netPnl: cur.netPnl + pnl,
        edge: cur.edge,
        lastAt: new Date().toISOString(),
      };
      // Adaptive manager: once there's a small sample, nudge selectivity from
      // the bot's own rolling win-rate. Losing streak → more selective (higher
      // edge); winning → slightly more active. Bounded to stay sane.
      if (prev.adaptiveEnabled && next.trades >= 4) {
        const winRate = next.wins / next.trades;
        if (winRate < 0.4) next.edge = Math.min(2, Math.round((cur.edge + 0.1) * 100) / 100);
        else if (winRate > 0.6) next.edge = Math.max(0.6, Math.round((cur.edge - 0.1) * 100) / 100);
      }
      return { ...prev, botStats: { ...prev.botStats, [botId]: next } };
    });
  }, []);

  const resetBotStats = useCallback((botId?: string) => {
    setSettings((prev) => {
      if (!botId) return { ...prev, botStats: {} };
      const { [botId]: _drop, ...rest } = prev.botStats;
      return { ...prev, botStats: rest };
    });
  }, []);

  /* ── Per-asset caution ── */
  const getAssetStat = useCallback(
    (asset: string): BotStat => settings.assetStats[asset.toUpperCase()] ?? freshBotStat(),
    [settings.assetStats],
  );

  const getAssetCaution = useCallback(
    (asset: string): number => {
      if (!settings.assetCautionEnabled) return 1;
      const stat = settings.assetStats[asset.toUpperCase()];
      return stat ? assetCautionFromStat(stat) : 1;
    },
    [settings.assetCautionEnabled, settings.assetStats],
  );

  const recordAssetResult = useCallback((asset: string, pnl: number, tradeId?: string) => {
    const key = asset.toUpperCase();
    if (!key) return;
    setSettings((prev) => {
      // Persistent dedupe: a trade is folded into its coin's scorecard exactly
      // once, ever — even across reloads or wallet switches (history is
      // wallet-scoped, so the same id can resurface on a different wallet).
      const ledger = prev.recordedTradeIds ?? [];
      if (tradeId && ledger.includes(tradeId)) return prev;
      const cur = prev.assetStats[key] ?? freshBotStat();
      const won = pnl >= 0;
      const next: BotStat = {
        trades: cur.trades + 1,
        wins: cur.wins + (won ? 1 : 0),
        losses: cur.losses + (won ? 0 : 1),
        netPnl: cur.netPnl + pnl,
        edge: cur.edge,
        lastAt: new Date().toISOString(),
      };
      next.edge = assetCautionFromStat(next);
      // Cap the dedupe ledger well above the per-wallet history cap (200) so
      // recorded ids aren't evicted while their trade is still on a wallet.
      const recordedTradeIds = tradeId
        ? [tradeId, ...ledger].slice(0, 2000)
        : ledger;
      return { ...prev, assetStats: { ...prev.assetStats, [key]: next }, recordedTradeIds };
    });
  }, []);

  const resetAssetStats = useCallback((asset?: string) => {
    setSettings((prev) => {
      if (!asset) return { ...prev, assetStats: {} };
      const { [asset.toUpperCase()]: _drop, ...rest } = prev.assetStats;
      return { ...prev, assetStats: rest };
    });
  }, []);

  /* ── Risk Manager ── */
  const getRiskGuard = useCallback(
    (botId: string): RiskGuard => settings.riskGuards[botId] ?? freshRiskGuard(),
    [settings.riskGuards],
  );

  const evaluateRisk = useCallback((botId: string, tradeHistory: { pnl: number; closedAt: string }[], currentCash: number, totalDeposited: number) => {
    setSettings((prev) => {
      if (!prev.riskManagerEnabled) return prev;
      const stat = prev.botStats[botId] ?? freshBotStat();
      const guard = prev.riskGuards[botId] ?? freshRiskGuard();
      const next = evaluateRiskGuard(botId, stat, guard, tradeHistory, currentCash, totalDeposited);
      return { ...prev, riskGuards: { ...prev.riskGuards, [botId]: next } };
    });
  }, []);

  const resetRiskGuard = useCallback((botId?: string) => {
    setSettings((prev) => {
      if (!botId) return { ...prev, riskGuards: {} };
      const { [botId]: _drop, ...rest } = prev.riskGuards;
      return { ...prev, riskGuards: rest };
    });
  }, []);

  // Resolve the gear for the active wallet (falls back to the shared default for
  // wallets that have never set one), then expose it as `settings.intensity` so
  // every engine and the UI keep reading a single value.
  const effectiveSettings = useMemo<AutoTraderSettings>(() => {
    const perWallet = activeWalletId ? settings.intensityByWallet[activeWalletId] : undefined;
    const level = perWallet ?? settings.intensity;
    // Merge the active wallet's per-wallet settings override on top of globals.
    // Intensity is already resolved from intensityByWallet; strip it from the
    // wallet override so it doesn't revert. Also strip nested collection fields
    // so the merge never leaks a per-wallet copy of walletSettings/botStats/etc.
    const walletOverride = activeWalletId ? settings.walletSettings[activeWalletId] : undefined;
    let eff = walletOverride
      ? (() => {
          const { intensity: _i, walletSettings: _w, intensityByWallet: _ib, botStats: _b, assetStats: _a, recordedTradeIds: _r, riskGuards: _rg, ...clean } = walletOverride;
          return { ...settings, intensity: level, ...clean };
        })()
      : level === settings.intensity
        ? settings
        : { ...settings, intensity: level };

    // ── Max Performance overrides ──
    // Layer the top-end fleet settings on top of the saved values WITHOUT
    // mutating them, so toggling max mode off restores the user's originals.
    // We intentionally leave dynamicCapitalEnabled / fixedAmount untouched —
    // resolveSizing honors dynamic sizing first, so max mode never overrides the
    // user's fixed-vs-dynamic choice. The $3,000 floor (cashReserveFloor) and
    // the Risk Manager guards stay active; riskManagerEnabled is forced on so
    // the auto-pause-on-losses net can never be bypassed by max mode.
    if (settings.maxPerfEnabled) {
      eff = {
        ...eff,
        intensity: 5,
        tradeMode: "NORMAL",
        globalLeverageEnabled: true,
        globalLeverage: Math.max(eff.globalLeverage, 10),
        maxOpenPositions: Math.max(eff.maxOpenPositions, 12),
        stockMaxOpen: Math.max(eff.stockMaxOpen, 10),
        polyMaxOpenBets: Math.max(eff.polyMaxOpenBets, 8),
        dipMaxOpen: Math.max(eff.dipMaxOpen, 6),
        breakoutMaxOpen: Math.max(eff.breakoutMaxOpen, 6),
        dcaMaxOpen: Math.max(eff.dcaMaxOpen, 10),
        fundingMaxOpen: Math.max(eff.fundingMaxOpen, 8),
        optionMaxOpen: Math.max(eff.optionMaxOpen, 8),
        riskManagerEnabled: true,
      };
    }

    // Momentum Drive: when on, lift ALL maxOpen caps so only cash limits
    // how many positions can be open simultaneously.
    if (settings.momentumDriveEnabled) {
      const HIGH = 50;
      eff = {
        ...eff,
        maxOpenPositions: Math.max(eff.maxOpenPositions, HIGH),
        stockMaxOpen:     Math.max(eff.stockMaxOpen,     HIGH),
        polyMaxOpenBets:  Math.max(eff.polyMaxOpenBets,  HIGH),
        dipMaxOpen:       Math.max(eff.dipMaxOpen,       HIGH),
        breakoutMaxOpen:  Math.max(eff.breakoutMaxOpen,  HIGH),
        dcaMaxOpen:       Math.max(eff.dcaMaxOpen,       HIGH),
        fundingMaxOpen:   Math.max(eff.fundingMaxOpen,   HIGH),
        optionMaxOpen:    Math.max(eff.optionMaxOpen,    HIGH),
      };
    }

    return eff;
  }, [settings, activeWalletId]);

  return (
    <AutoTraderContext.Provider
      value={{ settings: effectiveSettings, baseIntensity: settings.intensity, update, setWalletIntensity, toggleEnabled, startBoost, stopBoost, getBotStat, recordBotResult, resetBotStats, getAssetStat, getAssetCaution, recordAssetResult, resetAssetStats, getRiskGuard, evaluateRisk, resetRiskGuard, alpha, publishAlpha }}
    >
      {children}
    </AutoTraderContext.Provider>
  );
}

export function useAutoTrader() {
  const ctx = useContext(AutoTraderContext);
  if (!ctx) throw new Error("useAutoTrader must be used inside AutoTraderProvider");
  return ctx;
}
