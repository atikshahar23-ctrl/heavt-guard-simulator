import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";

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
  slPrice?: number;
  tpPrice?: number;
  openedAt: string;
  /** Opened automatically by the Auto-Trader engine. */
  auto?: boolean;
  /** Free-form source label, e.g. "Scalp signal". */
  source?: string;
}

export interface StockPosition {
  id: string;
  symbol: string;
  name: string;
  shares: number;
  entryPrice: number;
  leverage: number;
  cost: number;
  openedAt: string;
}

export interface ClosedTrade {
  id: string;
  type: "POLYMARKET" | "BINANCE" | "STOCK";
  description: string;
  cost: number;
  proceeds: number;
  pnl: number;
  closedAt: string;
  openedAt?: string;
  /** Closed by an automatic SL/TP trigger or auto-traded position. */
  auto?: boolean;
  /** How the close happened: manual / SL / TP. */
  exit?: "MANUAL" | "SL" | "TP";
}

interface PortfolioState {
  cash: number;
  totalDeposited: number;
  polyPositions: PolyPosition[];
  binancePositions: BinancePosition[];
  stockPositions: StockPosition[];
  tradeHistory: ClosedTrade[];
}

interface PortfolioContextValue extends PortfolioState {
  addFunds: (amountUsd: number) => string | null;
  openPolyPosition: (
    market: Omit<PolyPosition, "id" | "shares" | "cost" | "openedAt">,
    amountUsd: number
  ) => string | null;
  closePolyPosition: (id: string, currentPrice: number) => void;
  openBinancePosition: (
    pos: Omit<BinancePosition, "id" | "openedAt">
  ) => string | null;
  closeBinancePosition: (id: string, currentPrice: number) => void;
  openStockPosition: (
    stock: Omit<StockPosition, "id" | "shares" | "cost" | "openedAt" | "leverage">,
    amountUsd: number,
    leverage?: number
  ) => string | null;
  closeStockPosition: (id: string, currentPrice: number) => void;
  checkSlTp: (prices: Record<string, number>) => void;
  resetPortfolio: () => void;
}

const STORAGE_KEY = "arb_scan_portfolio";

function loadState(): PortfolioState {
  const fresh: PortfolioState = {
    cash: STARTING_BALANCE,
    totalDeposited: STARTING_BALANCE,
    polyPositions: [],
    binancePositions: [],
    stockPositions: [],
    tradeHistory: [],
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PortfolioState>;
      return {
        cash: parsed.cash ?? STARTING_BALANCE,
        totalDeposited: parsed.totalDeposited ?? STARTING_BALANCE,
        polyPositions: parsed.polyPositions ?? [],
        binancePositions: parsed.binancePositions ?? [],
        stockPositions: (parsed.stockPositions ?? []).map((p) => ({ ...p, leverage: p.leverage ?? 1 })),
        tradeHistory: parsed.tradeHistory ?? [],
      };
    }
  } catch {}
  return fresh;
}

function saveState(state: PortfolioState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PortfolioState>(loadState);

  // Mirror of the latest committed state for deterministic synchronous reads.
  // Re-synced every render so updater-based mutations (closes) stay reflected,
  // and optimistically advanced inside open* helpers so sequential opens within
  // a single tick (e.g. the Auto-Trader loop) see decremented cash immediately.
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    saveState(state);
  }, [state]);

  const addFunds = useCallback((amountUsd: number) => {
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) return "Enter a positive amount";
    if (amountUsd > 10_000_000) return "Amount too large";
    setState((prev) => ({
      ...prev,
      cash: prev.cash + amountUsd,
      totalDeposited: prev.totalDeposited + amountUsd,
    }));
    return null;
  }, []);

  const openPolyPosition = useCallback(
    (market: Omit<PolyPosition, "id" | "shares" | "cost" | "openedAt">, amountUsd: number) => {
      if (amountUsd <= 0) return "Amount must be positive";
      if (stateRef.current.cash < amountUsd) return "Insufficient balance";
      const shares = amountUsd / market.entryPrice;
      const position: PolyPosition = {
        ...market,
        id: crypto.randomUUID(),
        shares,
        cost: amountUsd,
        openedAt: new Date().toISOString(),
      };
      stateRef.current = {
        ...stateRef.current,
        cash: stateRef.current.cash - amountUsd,
        polyPositions: [...stateRef.current.polyPositions, position],
      };
      setState((prev) => ({
        ...prev,
        cash: prev.cash - amountUsd,
        polyPositions: [...prev.polyPositions, position],
      }));
      return null;
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
        description: `${pos.side} @ ${pos.entryPrice.toFixed(3)} → ${currentPrice.toFixed(3)} | ${pos.question.slice(0, 200)}`,
        cost: pos.cost,
        proceeds,
        pnl,
        closedAt: new Date().toISOString(),
      };
      return {
        ...prev,
        cash: prev.cash + proceeds,
        polyPositions: prev.polyPositions.filter((p) => p.id !== id),
        tradeHistory: [closed, ...prev.tradeHistory].slice(0, 200),
      };
    });
  }, []);

  const openBinancePosition = useCallback(
    (pos: Omit<BinancePosition, "id" | "openedAt">) => {
      if (pos.notional <= 0) return "Amount must be positive";
      const margin = pos.notional / pos.leverage;
      if (stateRef.current.cash < margin) return "Insufficient margin";
      const position: BinancePosition = {
        ...pos,
        id: crypto.randomUUID(),
        openedAt: new Date().toISOString(),
      };
      stateRef.current = {
        ...stateRef.current,
        cash: stateRef.current.cash - margin,
        binancePositions: [...stateRef.current.binancePositions, position],
      };
      setState((prev) => ({
        ...prev,
        cash: prev.cash - margin,
        binancePositions: [...prev.binancePositions, position],
      }));
      return null;
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
          openedAt: pos.openedAt,
          auto: pos.auto,
          exit: "MANUAL",
        };
        return {
          ...prev,
          cash: prev.cash + Math.max(0, proceeds),
          binancePositions: prev.binancePositions.filter((p) => p.id !== id),
          tradeHistory: [closed, ...prev.tradeHistory].slice(0, 200),
        };
      });
    },
    []
  );

  const openStockPosition = useCallback(
    (stock: Omit<StockPosition, "id" | "shares" | "cost" | "openedAt" | "leverage">, amountUsd: number, leverage: number = 1) => {
      if (amountUsd <= 0) return "Amount must be positive";
      if (stock.entryPrice <= 0) return "Price unavailable";
      const lev = leverage >= 1 ? leverage : 1;
      if (stateRef.current.cash < amountUsd) return "Insufficient balance";
      const shares = (amountUsd * lev) / stock.entryPrice;
      const position: StockPosition = {
        ...stock,
        id: crypto.randomUUID(),
        shares,
        leverage: lev,
        cost: amountUsd,
        openedAt: new Date().toISOString(),
      };
      stateRef.current = {
        ...stateRef.current,
        cash: stateRef.current.cash - amountUsd,
        stockPositions: [...stateRef.current.stockPositions, position],
      };
      setState((prev) => ({
        ...prev,
        cash: prev.cash - amountUsd,
        stockPositions: [...prev.stockPositions, position],
      }));
      return null;
    },
    []
  );

  const closeStockPosition = useCallback((id: string, currentPrice: number) => {
    setState((prev) => {
      const pos = prev.stockPositions.find((p) => p.id === id);
      if (!pos) return prev;
      const pnl = pos.shares * (currentPrice - pos.entryPrice);
      const proceeds = Math.max(0, pos.cost + pnl);
      const closed: ClosedTrade = {
        id: crypto.randomUUID(),
        type: "STOCK",
        description: `${pos.symbol}${pos.leverage > 1 ? ` ${pos.leverage}x` : ""} ${pos.shares.toFixed(2)} sh @ $${pos.entryPrice.toFixed(2)} → $${currentPrice.toFixed(2)}`,
        cost: pos.cost,
        proceeds,
        pnl,
        closedAt: new Date().toISOString(),
      };
      return {
        ...prev,
        cash: prev.cash + proceeds,
        stockPositions: prev.stockPositions.filter((p) => p.id !== id),
        tradeHistory: [closed, ...prev.tradeHistory].slice(0, 200),
      };
    });
  }, []);

  /** Auto-execute SL/TP for open Binance positions when price crosses threshold. */
  const checkSlTp = useCallback((prices: Record<string, number>) => {
    setState((prev) => {
      let changed = false;
      let binancePositions = prev.binancePositions;
      let cash = prev.cash;
      let tradeHistory = prev.tradeHistory;

      for (const pos of prev.binancePositions) {
        const price = prices[pos.asset];
        if (!price) continue;

        const hitSL =
          pos.slPrice != null &&
          (pos.direction === "LONG" ? price <= pos.slPrice : price >= pos.slPrice);
        const hitTP =
          pos.tpPrice != null &&
          (pos.direction === "LONG" ? price >= pos.tpPrice : price <= pos.tpPrice);

        if (!hitSL && !hitTP) continue;

        const margin = pos.notional / pos.leverage;
        const priceDelta =
          pos.direction === "LONG"
            ? (price - pos.entryPrice) / pos.entryPrice
            : (pos.entryPrice - price) / pos.entryPrice;
        const pnl = priceDelta * pos.notional;
        const proceeds = Math.max(0, margin + pnl);

        const closed: ClosedTrade = {
          id: crypto.randomUUID(),
          type: "BINANCE",
          description: `${hitTP ? "TP" : "SL"} ${pos.direction} ${pos.asset} ${pos.leverage}x @ $${price.toLocaleString()} (entry $${pos.entryPrice.toLocaleString()})`,
          cost: margin,
          proceeds,
          pnl,
          closedAt: new Date().toISOString(),
          openedAt: pos.openedAt,
          auto: pos.auto,
          exit: hitTP ? "TP" : "SL",
        };

        binancePositions = binancePositions.filter((p) => p.id !== pos.id);
        cash = cash + proceeds;
        tradeHistory = [closed, ...tradeHistory].slice(0, 200);
        changed = true;
      }

      if (!changed) return prev;
      return { ...prev, binancePositions, cash, tradeHistory };
    });
  }, []);

  const resetPortfolio = useCallback(() => {
    setState({
      cash: STARTING_BALANCE,
      totalDeposited: STARTING_BALANCE,
      polyPositions: [],
      binancePositions: [],
      stockPositions: [],
      tradeHistory: [],
    });
  }, []);

  return (
    <PortfolioContext.Provider
      value={{
        ...state,
        addFunds,
        openPolyPosition,
        closePolyPosition,
        openBinancePosition,
        closeBinancePosition,
        openStockPosition,
        closeStockPosition,
        checkSlTp,
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
