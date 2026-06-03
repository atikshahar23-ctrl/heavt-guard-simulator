import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export type ScalpConfidence = "LOW" | "MEDIUM" | "HIGH";

/** Which signal sources the engine trades from. */
export type TradeStrategy = "SCALP" | "MOMENTUM" | "BOTH";

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

  polyEnabled: false,
  polyStakePerBet: 25,
  polyMaxOpenBets: 4,
  polyMinBiasPct: 0.6,
  polyHorizonHours: 24,
  polyTakeProfitPct: 40,
  polyStopLossPct: 50,
};

const STORAGE_KEY = "arb_scan_autotrader";

interface AutoTraderContextValue {
  settings: AutoTraderSettings;
  update: (patch: Partial<AutoTraderSettings>) => void;
  toggleEnabled: () => void;
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

  return (
    <AutoTraderContext.Provider value={{ settings, update, toggleEnabled }}>
      {children}
    </AutoTraderContext.Provider>
  );
}

export function useAutoTrader() {
  const ctx = useContext(AutoTraderContext);
  if (!ctx) throw new Error("useAutoTrader must be used inside AutoTraderProvider");
  return ctx;
}
