import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export const STARTING_BALANCE = 10_000;

export interface PolyPosition {
  id: string;
  conditionId: string;
  question: string;
  category: string;
  slug: string | null;
  side: "YES" | "NO";
  shares: number;
  entryPrice: number;
  cost: number;
  openedAt: string;
}

export interface BinancePosition {
  id: string;
  asset: string;
  direction: "LONG" | "SHORT";
  notional: number;
  entryPrice: number;
  leverage: number;
  openedAt: string;
}

export interface ClosedTrade {
  id: string;
  type: "POLYMARKET" | "BINANCE";
  description: string;
  cost: number;
  proceeds: number;
  pnl: number;
  closedAt: string;
}

interface PortfolioState {
  cash: number;
  polyPositions: PolyPosition[];
  binancePositions: BinancePosition[];
  tradeHistory: ClosedTrade[];
}

interface PortfolioContextValue extends PortfolioState {
  totalDeposited: number;
  openPolyPosition: (
    market: Omit<PolyPosition, "id" | "shares" | "cost" | "openedAt">,
    amountUsd: number
  ) => string | null;
  closePolyPosition: (id: string, currentPrice: number) => void;
  openBinancePosition: (
    pos: Omit<BinancePosition, "id" | "openedAt">
  ) => string | null;
  closeBinancePosition: (id: string, currentPrice: number) => void;
  resetPortfolio: () => void;
}

const STORAGE_KEY = "arb_scan_portfolio";

function loadState(): PortfolioState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PortfolioState;
  } catch {}
  return {
    cash: STARTING_BALANCE,
    polyPositions: [],
    binancePositions: [],
    tradeHistory: [],
  };
}

function saveState(state: PortfolioState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PortfolioState>(loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const openPolyPosition = useCallback(
    (market: Omit<PolyPosition, "id" | "shares" | "cost" | "openedAt">, amountUsd: number) => {
      if (amountUsd <= 0) return "Amount must be positive";
      let error: string | null = null;
      setState((prev) => {
        if (prev.cash < amountUsd) {
          error = "Insufficient balance";
          return prev;
        }
        const shares = amountUsd / market.entryPrice;
        const position: PolyPosition = {
          ...market,
          id: crypto.randomUUID(),
          shares,
          cost: amountUsd,
          openedAt: new Date().toISOString(),
        };
        return {
          ...prev,
          cash: prev.cash - amountUsd,
          polyPositions: [...prev.polyPositions, position],
        };
      });
      return error;
    },
    []
  );

  const closePolyPosition = useCallback((id: string, currentPrice: number) => {
    setState((prev) => {
      const pos = prev.polyPositions.find((p) => p.id === id);
      if (!pos) return prev;
      const proceeds = pos.shares * currentPrice;
      const pnl = proceeds - pos.cost;
      const closed: ClosedTrade = {
        id: crypto.randomUUID(),
        type: "POLYMARKET",
        description: `${pos.side} @ ${pos.entryPrice.toFixed(3)} → ${currentPrice.toFixed(3)} | ${pos.question.slice(0, 50)}`,
        cost: pos.cost,
        proceeds,
        pnl,
        closedAt: new Date().toISOString(),
      };
      return {
        ...prev,
        cash: prev.cash + proceeds,
        polyPositions: prev.polyPositions.filter((p) => p.id !== id),
        tradeHistory: [closed, ...prev.tradeHistory].slice(0, 50),
      };
    });
  }, []);

  const openBinancePosition = useCallback(
    (pos: Omit<BinancePosition, "id" | "openedAt">) => {
      if (pos.notional <= 0) return "Amount must be positive";
      const margin = pos.notional / pos.leverage;
      let error: string | null = null;
      setState((prev) => {
        if (prev.cash < margin) {
          error = "Insufficient margin";
          return prev;
        }
        const position: BinancePosition = {
          ...pos,
          id: crypto.randomUUID(),
          openedAt: new Date().toISOString(),
        };
        return {
          ...prev,
          cash: prev.cash - margin,
          binancePositions: [...prev.binancePositions, position],
        };
      });
      return error;
    },
    []
  );

  const closeBinancePosition = useCallback(
    (id: string, currentPrice: number) => {
      setState((prev) => {
        const pos = prev.binancePositions.find((p) => p.id === id);
        if (!pos) return prev;
        const margin = pos.notional / pos.leverage;
        const priceDelta =
          pos.direction === "LONG"
            ? (currentPrice - pos.entryPrice) / pos.entryPrice
            : (pos.entryPrice - currentPrice) / pos.entryPrice;
        const pnl = priceDelta * pos.notional;
        const proceeds = margin + pnl;
        const closed: ClosedTrade = {
          id: crypto.randomUUID(),
          type: "BINANCE",
          description: `${pos.direction} ${pos.asset} ${pos.leverage}x @ $${pos.entryPrice.toLocaleString()} → $${currentPrice.toLocaleString()}`,
          cost: margin,
          proceeds: Math.max(0, proceeds),
          pnl,
          closedAt: new Date().toISOString(),
        };
        return {
          ...prev,
          cash: prev.cash + Math.max(0, proceeds),
          binancePositions: prev.binancePositions.filter((p) => p.id !== id),
          tradeHistory: [closed, ...prev.tradeHistory].slice(0, 50),
        };
      });
    },
    []
  );

  const resetPortfolio = useCallback(() => {
    const fresh: PortfolioState = {
      cash: STARTING_BALANCE,
      polyPositions: [],
      binancePositions: [],
      tradeHistory: [],
    };
    setState(fresh);
  }, []);

  return (
    <PortfolioContext.Provider
      value={{
        ...state,
        totalDeposited: STARTING_BALANCE,
        openPolyPosition,
        closePolyPosition,
        openBinancePosition,
        closeBinancePosition,
        resetPortfolio,
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error("usePortfolio must be used inside PortfolioProvider");
  return ctx;
}
