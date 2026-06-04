import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export type ScalpConfidence = "LOW" | "MEDIUM" | "HIGH";

/** Which signal sources the engine trades from. */
export type TradeStrategy = "SCALP" | "MOMENTUM" | "BOTH";

/** The three additional, independently-managed simulator bots. */
export const NEW_BOT_IDS = ["dipbuyer", "breakout", "dca"] as const;
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

export interface AutoTraderSettings {
  enabled: boolean;
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

  /** Per-bot rolling scorecards (keyed by NewBotId). */
  botStats: Record<string, BotStat>;

  /* ── Risk Manager: per-bot kill-switches & supervisor ── */
  /** Let the Risk Manager supervise every bot and auto-pause losers. */
  riskManagerEnabled: boolean;
  /** Per-bot risk guard states (keyed by bot id). */
  riskGuards: Record<string, RiskGuard>;
}

export const DEFAULT_SETTINGS: AutoTraderSettings = {
  enabled: false,
  marginPerTrade: 100,
  leverage: 5,
  minConfidence: "HIGH",
  allowLong: true,
  allowShort: true,
  maxOpenPositions: 5,
  favoritesOnly: false,

  strategy: "BOTH",
  minMomentumScore: 55,
  trailingEnabled: true,
  trailActivatePct: 1.5,
  trailDistancePct: 1.0,
  dailyStopEnabled: false,
  dailyMaxLossPct: 10,

  catastrophicExitEnabled: true,
  maxLossPerTradePct: 80,
  portfolioStopEnabled: false,
  portfolioMaxDrawdownPct: 25,

  stocksEnabled: false,
  stockStakePerTrade: 200,
  stockMaxOpen: 5,
  stockMinConfidence: 55,

  polyEnabled: false,
  polyStakePerBet: 25,
  polyMaxOpenBets: 4,
  polyMinBiasPct: 0.6,
  polyHorizonHours: 24,
  polyTakeProfitPct: 40,
  polyStopLossPct: 50,

  adaptiveEnabled: true,
  newBotLeverage: 5,

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

  botStats: {},

  riskManagerEnabled: true,
  riskGuards: {},
};

const STORAGE_KEY = "arb_scan_autotrader";

interface AutoTraderContextValue {
  settings: AutoTraderSettings;
  update: (patch: Partial<AutoTraderSettings>) => void;
  toggleEnabled: () => void;
  /** Read a bot's scorecard (returns a fresh blank one if untracked). */
  getBotStat: (botId: string) => BotStat;
  /** Record one closed paper trade for a bot; the manager adapts its edge. */
  recordBotResult: (botId: string, pnl: number) => void;
  /** Wipe a single bot's scorecard, or all of them when no id is given. */
  resetBotStats: (botId?: string) => void;

  /* ── Risk Manager ── */
  /** Read a bot's risk guard (returns fresh blank if untracked). */
  getRiskGuard: (botId: string) => RiskGuard;
  /** Evaluate a bot's risk state and update the guard. */
  evaluateRisk: (botId: string, tradeHistory: { pnl: number; closedAt: string }[], currentCash: number, totalDeposited: number) => void;
  /** Reset a bot's risk guard (un-pause). */
  resetRiskGuard: (botId?: string) => void;
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
  const [settings, setSettings] = useState<AutoTraderSettings>(loadSettings);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  const update = useCallback((patch: Partial<AutoTraderSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleEnabled = useCallback(() => {
    setSettings((prev) => ({ ...prev, enabled: !prev.enabled }));
  }, []);

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

  return (
    <AutoTraderContext.Provider
      value={{ settings, update, toggleEnabled, getBotStat, recordBotResult, resetBotStats, getRiskGuard, evaluateRisk, resetRiskGuard }}
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
