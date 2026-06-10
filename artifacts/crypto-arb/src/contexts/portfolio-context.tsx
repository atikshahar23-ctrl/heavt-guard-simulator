import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { useUser } from "@clerk/react";
import { useServerSync } from "@/contexts/server-sync-context";
import { useLanguage } from "@/contexts/language-context";
import { t, type Lang } from "@/lib/i18n";
import { toast } from "@/hooks/use-toast";
import { calcCloseFeeForBinance, calcCloseFeeForStock, calcCloseFeeForPoly, FEE_RATES, applySlippage } from "@/lib/fees";
import { optionPositionValue } from "@/lib/options-model";

export const STARTING_BALANCE = 10_000;

export interface PolyPosition {
  id: string;
  conditionId: string;
  /** CLOB YES-token ID — required by the Polymarket price-history API for probability charts. */
  tokenId?: string;
  question: string;
  category: string;
  slug: string | null;
  side: "YES" | "NO";
  shares: number;
  entryPrice: number;
  cost: number;
  openedAt: string;
  /** Opened automatically by the Auto-Trader engine. */
  auto?: boolean;
  /** Free-form source label, e.g. "Polymarket BTC". */
  source?: string;
}

export interface TrailConfig {
  /** Favorable move (price %) required before the trailing stop arms. */
  activatePct: number;
  /** Distance (price %) the stop sits behind the best price once armed. */
  distancePct: number;
  /** Best favorable price seen so far (peak for LONG, trough for SHORT). */
  peak?: number;
  /** Whether the trail has armed (price moved past the activation threshold). */
  armed?: boolean;
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
  /** Optional trailing-stop config (warrior-style ride-the-winner). */
  trail?: TrailConfig;
}

export interface StockPosition {
  id: string;
  symbol: string;
  name: string;
  /** LONG (buy) or SHORT (sell). Missing/legacy positions are treated as LONG. */
  direction?: "LONG" | "SHORT";
  shares: number;
  entryPrice: number;
  leverage: number;
  cost: number;
  slPrice?: number;
  tpPrice?: number;
  openedAt: string;
  /** Opened automatically by the Auto-Trader engine. */
  auto?: boolean;
  /** Free-form source label. */
  source?: string;
}

/**
 * Delta-neutral funding-arbitrage paper position: a base leg paired with an
 * opposite-direction perp. Because the legs offset, there is no directional price
 * P&L — the only return is the simulated funding that accrues while it's held.
 * `notionalPerLeg` is the capital deployed (committed from cash at open).
 */
export interface FundingPosition {
  id: string;
  asset: string;
  /** SHORT_PERP = long base + short perp (collect positive funding); LONG_PERP = the inverse. */
  side: "SHORT_PERP" | "LONG_PERP";
  notionalPerLeg: number;
  entryPrice: number;
  /** Absolute annualized funding magnitude (percent) captured at open, for the accrual model. */
  annualizedPercent: number;
  /** Simulated funding earned so far, in USD. */
  accruedFundingUsd: number;
  openedAt: string;
  /** Last time the engine accrued funding into this position. */
  lastAccrualAt: string;
  /** Opened automatically by the funding bot engine. */
  auto?: boolean;
  /** Free-form source label, e.g. "Funding arb". */
  source?: string;
}

/**
 * Long-only paper options position (CALL or PUT) on a crypto asset or stock.
 * Capital deployed = `premiumPaid` (committed from cash at open), which is also
 * the maximum possible loss — a long option can expire worthless but never owes.
 * Marked to market with a simplified Black–Scholes model (see lib/options-model).
 */
export interface OptionPosition {
  id: string;
  /** Underlying ticker: crypto asset (BTC) or stock symbol (AAPL). */
  underlying: string;
  /** Which price feed marks this position. */
  market: "CRYPTO" | "STOCK";
  kind: "CALL" | "PUT";
  strike: number;
  /** Underlying price captured at open (for reference / display). */
  entryUnderlying: number;
  /** Expiry timestamp (epoch ms). */
  expiryMs: number;
  /** Number of contracts (units of underlying exposure); may be fractional for paper. */
  contracts: number;
  /** Total premium paid at open = capital committed = max loss. */
  premiumPaid: number;
  /** Annualized implied vol used at open; reused for consistent mark-to-market. */
  entryVol: number;
  openedAt: string;
  /** Opened automatically by the options bot engine. */
  auto?: boolean;
  /** Free-form source label, e.g. "Options Agent". */
  source?: string;
}

export interface ClosedTrade {
  id: string;
  type: "POLYMARKET" | "BINANCE" | "STOCK" | "FUNDING" | "OPTION";
  description: string;
  cost: number;
  proceeds: number;
  pnl: number;
  /** Total round-trip fees paid on this trade (open + close). */
  fees: number;
  closedAt: string;
  openedAt?: string;
  /** Closed by an automatic SL/TP trigger or auto-traded position. */
  auto?: boolean;
  /** How the close happened: manual / SL / TP / LIQ (emergency risk exit). */
  exit?: "MANUAL" | "SL" | "TP" | "LIQ" | "EXPIRY";
  /** Underlying symbol for deep-linking to the chart: BINANCE asset, STOCK ticker, or Polymarket slug. */
  symbol?: string;
  /** Polymarket conditionId — used as the chart market key for the probability chart. */
  conditionId?: string;
  /** Polymarket CLOB YES-token ID — preferred over conditionId for price-history API calls. */
  tokenId?: string;
  /** ── Structured trade detail (optional; `description` is the legacy fallback) ── */
  /** Trade direction: LONG/SHORT for crypto & stocks, YES/NO for Polymarket bets. */
  direction?: "LONG" | "SHORT" | "YES" | "NO";
  /** Price the position was opened at. */
  entryPrice?: number;
  /** Price the position was closed at. */
  exitPrice?: number;
  /** Leverage multiplier (crypto/stock; 1 when none). */
  leverage?: number;
  /** Planned stop-loss price at open (crypto/stock), for the trade analysis. */
  slPrice?: number;
  /** Planned take-profit price at open (crypto/stock), for the trade analysis. */
  tpPrice?: number;
  /** Units held: contracts notional value (crypto), shares (stock), or units (Polymarket). */
  qty?: number;
  /** Which bot/source opened the trade (e.g. "Scalp signal", "Dip Buyer"). */
  source?: string;
  /** Polymarket market question, for the detail view. */
  question?: string;
}

interface PortfolioState {
  cash: number;
  totalDeposited: number;
  polyPositions: PolyPosition[];
  binancePositions: BinancePosition[];
  stockPositions: StockPosition[];
  fundingPositions: FundingPosition[];
  optionPositions: OptionPosition[];
  tradeHistory: ClosedTrade[];
}

/** A named, fully-isolated paper-trading account. */
export interface Wallet extends PortfolioState {
  id: string;
  name: string;
  createdAt: string;
}

interface WalletsState {
  wallets: Wallet[];
  activeWalletId: string;
}

/** Lightweight wallet summary surfaced to the switcher / progress UIs. */
export interface WalletSummary {
  id: string;
  name: string;
  cash: number;
  totalDeposited: number;
  openPositions: number;
}

interface PortfolioContextValue extends PortfolioState {
  /** All wallets (summary form) and the active selection. */
  wallets: WalletSummary[];
  activeWalletId: string;
  activeWalletName: string;
  /** ISO timestamp the active wallet was created — used for the wallet-age display. */
  activeWalletCreatedAt: string;
  createWallet: (name: string) => string | null;
  renameWallet: (id: string, name: string) => string | null;
  deleteWallet: (id: string) => string | null;
  switchWallet: (id: string) => void;
  addFunds: (amountUsd: number) => string | null;
  openPolyPosition: (
    market: Omit<PolyPosition, "id" | "shares" | "cost" | "openedAt">,
    amountUsd: number,
    minCashReserve?: number
  ) => string | null;
  closePolyPosition: (id: string, currentPrice: number) => void;
  openBinancePosition: (
    pos: Omit<BinancePosition, "id" | "openedAt">,
    minCashReserve?: number
  ) => string | null;
  closeBinancePosition: (id: string, currentPrice: number, exit?: ClosedTrade["exit"]) => void;
  openStockPosition: (
    stock: Omit<StockPosition, "id" | "shares" | "cost" | "openedAt" | "leverage">,
    amountUsd: number,
    leverage?: number,
    minCashReserve?: number
  ) => string | null;
  closeStockPosition: (id: string, currentPrice: number) => void;
  /** Open a delta-neutral funding-arb paper position (capital = notionalPerLeg). */
  openFundingPosition: (
    pos: Omit<FundingPosition, "id" | "openedAt" | "lastAccrualAt" | "accruedFundingUsd"> & { accruedFundingUsd?: number },
    minCashReserve?: number
  ) => string | null;
  /** Close a funding position, returning capital + simulated accrued funding. */
  closeFundingPosition: (id: string, exit?: ClosedTrade["exit"]) => void;
  openOptionPosition: (
    pos: Omit<OptionPosition, "id" | "openedAt">,
    minCashReserve?: number
  ) => string | null;
  /** Close a long option at its mark-to-market value given the current underlying price. */
  closeOptionPosition: (id: string, underlyingPrice: number, exit?: ClosedTrade["exit"]) => void;
  /** Accrue simulated funding into every open funding position up to `now` (ms epoch). */
  accrueFunding: (now?: number) => void;
  checkSlTp: (prices: Record<string, number>) => void;
  /** Ratchet trailing stops on Binance positions toward the favorable price. */
  updateTrailingStops: (prices: Record<string, number>) => void;
  /**
   * Emergency pre-liquidation guard: force-close any leveraged Binance position
   * whose unrealized loss has eaten this fraction (%) of its posted margin,
   * before the exchange would liquidate it. Closes are tagged exit:"LIQ".
   */
  checkRiskGuards: (prices: Record<string, number>, maxLossPerTradePct: number) => void;
  /**
   * Portfolio kill-switch: immediately close every open Binance + stock position
   * at the supplied prices (positions without a price are left untouched).
   * Returns the number of positions closed.
   */
  flattenAll: (prices: Record<string, number>) => number;
  /**
   * Close every bot-placed (auto===true) position across all three asset types
   * atomically in a single state update. Poly prices are keyed by conditionId.
   * Returns the total number of positions closed.
   */
  closeAllBotPositions: (
    binancePrices: Record<string, number>,
    stockPrices: Record<string, number>,
    polyPrices: Record<string, number>
  ) => number;
  resetPortfolio: () => void;
}

const STORAGE_KEY = "arb_scan_portfolio";
const WALLETS_KEY = "arb_scan_wallets_v2";

// Cap each wallet's closed-trade log. Trades are prepended (newest first), so we
// keep the most recent slice. Unbounded history would grow the persisted blob
// past the server/keepalive transport limits over a long bot-trading session.
const MAX_TRADE_HISTORY = 500;

function freshState(): PortfolioState {
  return {
    cash: STARTING_BALANCE,
    totalDeposited: STARTING_BALANCE,
    polyPositions: [],
    binancePositions: [],
    stockPositions: [],
    fundingPositions: [],
    optionPositions: [],
    tradeHistory: [],
  };
}

function normalizeState(parsed: Partial<PortfolioState>): PortfolioState {
  return {
    cash: parsed.cash ?? STARTING_BALANCE,
    totalDeposited: parsed.totalDeposited ?? STARTING_BALANCE,
    polyPositions: parsed.polyPositions ?? [],
    binancePositions: parsed.binancePositions ?? [],
    stockPositions: (parsed.stockPositions ?? []).map((p) => ({ ...p, leverage: p.leverage ?? 1, direction: p.direction ?? "LONG" })),
    fundingPositions: (parsed.fundingPositions ?? []).map((p) => ({ ...p, accruedFundingUsd: p.accruedFundingUsd ?? 0, lastAccrualAt: p.lastAccrualAt ?? p.openedAt })),
    optionPositions: parsed.optionPositions ?? [],
    tradeHistory: parsed.tradeHistory ?? [],
  };
}

function makeWallet(name: string, state: PortfolioState): Wallet {
  return { id: crypto.randomUUID(), name, createdAt: new Date().toISOString(), ...state };
}

// Parse a stored multi-wallet book (v2 shape) defensively; null if absent/empty.
function parseWalletsRaw(raw: string | null, lang: Lang): WalletsState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<WalletsState>;
    const wallets = (parsed.wallets ?? [])
      .filter((w): w is Wallet => !!w && typeof w.id === "string")
      .map((w) => ({
        id: w.id,
        name: w.name || t("pc.fallbackWalletName", lang),
        createdAt: w.createdAt || new Date().toISOString(),
        ...normalizeState(w),
      }));
    if (wallets.length === 0) return null;
    const activeWalletId = wallets.some((w) => w.id === parsed.activeWalletId)
      ? parsed.activeWalletId!
      : wallets[0].id;
    return { wallets, activeWalletId };
  } catch {
    return null;
  }
}

// Wrap a legacy single-portfolio blob into a one-wallet book with the default name.
function migrateLegacySingle(raw: string | null, lang: Lang): WalletsState | null {
  if (!raw) return null;
  try {
    const initial = normalizeState(JSON.parse(raw) as Partial<PortfolioState>);
    const main = makeWallet(t("pc.defaultWalletName", lang), initial);
    return { wallets: [main], activeWalletId: main.id };
  } catch {
    return null;
  }
}

/**
 * Load the multi-wallet book for the signed-in account. Wallets are scoped to
 * the Clerk user id via `walletsKey`/`legacyKey`, so each account keeps its own
 * paper-trading wallet on this device. On first sign-in we adopt any pre-auth
 * un-scoped data (`WALLETS_KEY`/`STORAGE_KEY`) so an existing local wallet
 * carries over to the first account; a cleanup effect then clears it so later
 * new accounts start fresh.
 */
function loadWallets(walletsKey: string, legacyKey: string, lang: Lang): WalletsState {
  const scoped = parseWalletsRaw(localStorage.getItem(walletsKey), lang);
  if (scoped) return scoped;

  const scopedLegacy = migrateLegacySingle(localStorage.getItem(legacyKey), lang);
  if (scopedLegacy) return scopedLegacy;

  const adoptedV2 = parseWalletsRaw(localStorage.getItem(WALLETS_KEY), lang);
  if (adoptedV2) return adoptedV2;

  const adoptedSingle = migrateLegacySingle(localStorage.getItem(STORAGE_KEY), lang);
  if (adoptedSingle) return adoptedSingle;

  const main = makeWallet(t("pc.defaultWalletName", lang), freshState());
  return { wallets: [main], activeWalletId: main.id };
}

function saveWallets(walletsKey: string, state: WalletsState) {
  try {
    localStorage.setItem(walletsKey, JSON.stringify(state));
  } catch {}
}

function portfolioOf(w: Wallet): PortfolioState {
  return {
    cash: w.cash,
    totalDeposited: w.totalDeposited,
    polyPositions: w.polyPositions,
    binancePositions: w.binancePositions,
    stockPositions: w.stockPositions,
    fundingPositions: w.fundingPositions,
    optionPositions: w.optionPositions,
    tradeHistory: w.tradeHistory,
  };
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

export function PortfolioProvider({ children }: { children: ReactNode }) {
  // Wallets are scoped to the signed-in Clerk account so each account keeps its
  // own paper-trading wallet on this device. This provider only mounts inside
  // the authed app, so `user.id` is present; remounting on account change loads
  // the right account's book.
  const { user } = useUser();
  const { lang } = useLanguage();
  const userId = user?.id ?? "anon";
  const walletsKey = `${WALLETS_KEY}::${userId}`;
  const legacyKey = `${STORAGE_KEY}::${userId}`;

  // Prefer the server snapshot (captured at hydration); fall back to the local
  // cache when the server has no wallet book for this account yet. The blob is
  // run through parseWalletsRaw so it gets the exact same validation/migration
  // as locally-stored books.
  const sync = useServerSync();
  const serverBook = sync.getServerData("wallets");
  const [book, setBook] = useState<WalletsState>(() => {
    if (serverBook !== null) {
      const parsed = parseWalletsRaw(JSON.stringify(serverBook), lang);
      if (parsed) return parsed;
    }
    return loadWallets(walletsKey, legacyKey, lang);
  });

  const activeWallet =
    book.wallets.find((w) => w.id === book.activeWalletId) ?? book.wallets[0];
  const state = portfolioOf(activeWallet);

  // Mirror of the active wallet's committed state for deterministic synchronous reads.
  // Re-synced every render so updater-based mutations (closes) stay reflected,
  // and optimistically advanced inside open* helpers so sequential opens within
  // a single tick (e.g. the Auto-Trader loop) see decremented cash immediately.
  const stateRef = useRef<PortfolioState>(state);
  stateRef.current = state;

  // Drop-in replacement for the legacy React state setter: every mutation is
  // routed to the ACTIVE wallet only, so each wallet stays fully isolated while
  // all the existing open/close/guard helpers below keep operating on a plain
  // PortfolioState exactly as before.
  const setState = useCallback(
    (updater: PortfolioState | ((prev: PortfolioState) => PortfolioState)) => {
      setBook((prevBook) => {
        const wallets = prevBook.wallets.map((w) => {
          if (w.id !== prevBook.activeWalletId) return w;
          const prevPortfolio = portfolioOf(w);
          const next = typeof updater === "function" ? updater(prevPortfolio) : updater;
          // Centrally bound the closed-trade log (newest first) so the persisted
          // wallet blob can't outgrow the server/keepalive transport limits.
          const tradeHistory =
            next.tradeHistory.length > MAX_TRADE_HISTORY
              ? next.tradeHistory.slice(0, MAX_TRADE_HISTORY)
              : next.tradeHistory;
          return { ...w, ...next, tradeHistory };
        });
        return { ...prevBook, wallets };
      });
    },
    [],
  );

  useEffect(() => {
    saveWallets(walletsKey, book);
  }, [walletsKey, book]);

  // Server sync: seed once if the server had no book, then push every change so
  // the wallet survives across devices for this signed-in account.
  const didServerSeed = useRef(false);
  useEffect(() => {
    if (!didServerSeed.current) {
      didServerSeed.current = true;
      if (sync.hydrationOk && serverBook === null) sync.save("wallets", book);
      return;
    }
    sync.save("wallets", book);
  }, [book]);

  // One-time cleanup: once this account's wallet is persisted under its scoped
  // key, drop any pre-auth un-scoped data so future new accounts on this device
  // start with a fresh wallet instead of inheriting this one.
  useEffect(() => {
    try {
      localStorage.removeItem(WALLETS_KEY);
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  const switchWallet = useCallback((id: string) => {
    setBook((prev) =>
      prev.wallets.some((w) => w.id === id) ? { ...prev, activeWalletId: id } : prev,
    );
  }, []);

  const createWallet = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return t("pc.nameRequired", lang);
    if (trimmed.length > 40) return t("pc.nameTooLong", lang);
    const wallet = makeWallet(trimmed, freshState());
    setBook((prev) => ({
      wallets: [...prev.wallets, wallet],
      activeWalletId: wallet.id,
    }));
    // Signal every auto-trader engine & UI to disarm all bots on the new wallet.
    // Settings (leverage, stakes, etc.) stay untouched; only the master arms are switched off.
    window.dispatchEvent(new CustomEvent("wallet-created", { detail: { walletId: wallet.id } }));
    toast({
      title: t("pc.newWalletTitle", lang),
      description: t("pc.newWalletDesc", lang),
    });
    return null;
  }, [lang]);

  const renameWallet = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return t("pc.nameRequired", lang);
    if (trimmed.length > 40) return t("pc.nameTooLong", lang);
    setBook((prev) => ({
      ...prev,
      wallets: prev.wallets.map((w) => (w.id === id ? { ...w, name: trimmed } : w)),
    }));
    return null;
  }, [lang]);

  const deleteWallet = useCallback((id: string) => {
    let error: string | null = null;
    setBook((prev) => {
      if (prev.wallets.length <= 1) {
        error = t("pc.cannotDeleteLast", lang);
        return prev;
      }
      const wallets = prev.wallets.filter((w) => w.id !== id);
      const activeWalletId =
        prev.activeWalletId === id ? wallets[0].id : prev.activeWalletId;
      return { wallets, activeWalletId };
    });
    return error;
  }, [lang]);

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
    (market: Omit<PolyPosition, "id" | "shares" | "cost" | "openedAt">, amountUsd: number, minCashReserve = 0) => {
      if (amountUsd <= 0) return "Amount must be positive";
      if (!Number.isFinite(market.entryPrice) || market.entryPrice <= 0 || market.entryPrice >= 1)
        return "Invalid market price";
      const openFee = amountUsd * FEE_RATES.poly.open;
      const totalOut = amountUsd + openFee;
      if (stateRef.current.cash < totalOut) return "Insufficient balance";
      // Account Manager cash reserve: enforced atomically against live cash so
      // concurrent same-tick opens across bots can't collectively breach it.
      if (stateRef.current.cash - totalOut < Math.max(0, minCashReserve)) return "Below cash reserve";
      // Apply realistic slippage for prediction-market orders.
      const execPrice = applySlippage(market.entryPrice, amountUsd, market.side === "YES" ? "LONG" : "SHORT");
      const shares = amountUsd / execPrice;
      const position: PolyPosition = {
        ...market,
        entryPrice: execPrice,
        id: crypto.randomUUID(),
        shares,
        cost: amountUsd,
        openedAt: new Date().toISOString(),
      };
      stateRef.current = {
        ...stateRef.current,
        cash: stateRef.current.cash - totalOut,
        polyPositions: [...stateRef.current.polyPositions, position],
      };
      setState((prev) => ({
        ...prev,
        cash: prev.cash - totalOut,
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
      const grossProceeds = pos.shares * currentPrice;
      const fees = calcCloseFeeForPoly(grossProceeds);
      const proceeds = Math.max(0, grossProceeds - fees);
      const pnl = proceeds - pos.cost;
      const closed: ClosedTrade = {
        id: crypto.randomUUID(),
        type: "POLYMARKET",
        symbol: pos.slug ?? undefined,
        conditionId: pos.conditionId,
        tokenId: pos.tokenId,
        description: `${pos.side} @ ${pos.entryPrice.toFixed(3)} → ${currentPrice.toFixed(3)} | ${pos.question}`,
        cost: pos.cost,
        proceeds,
        pnl,
        fees,
        closedAt: new Date().toISOString(),
        openedAt: pos.openedAt,
        direction: pos.side,
        entryPrice: pos.entryPrice,
        exitPrice: currentPrice,
        leverage: 1,
        qty: pos.shares,
        question: pos.question,
        auto: pos.auto,
        source: pos.source,
      };
      return {
        ...prev,
        cash: prev.cash + proceeds,
        polyPositions: prev.polyPositions.filter((p) => p.id !== id),
        tradeHistory: [closed, ...prev.tradeHistory],
      };
    });
  }, []);

  const openBinancePosition = useCallback(
    (pos: Omit<BinancePosition, "id" | "openedAt">, minCashReserve = 0) => {
      if (pos.notional <= 0) return "Amount must be positive";
      const margin = pos.notional / pos.leverage;
      const openFee = pos.notional * FEE_RATES.perp.open;
      const totalOut = margin + openFee;
      if (stateRef.current.cash < totalOut) return "Insufficient margin + fee";
      // Account Manager cash reserve: enforced atomically against live cash so
      // concurrent same-tick opens across bots can't collectively breach it.
      if (stateRef.current.cash - totalOut < Math.max(0, minCashReserve)) return "Below cash reserve";
      // Apply realistic slippage: larger orders get worse fills.
      const execPrice = applySlippage(pos.entryPrice, pos.notional, pos.direction);
      const position: BinancePosition = {
        ...pos,
        entryPrice: execPrice,
        id: crypto.randomUUID(),
        openedAt: new Date().toISOString(),
      };
      stateRef.current = {
        ...stateRef.current,
        cash: stateRef.current.cash - totalOut,
        binancePositions: [...stateRef.current.binancePositions, position],
      };
      setState((prev) => ({
        ...prev,
        cash: prev.cash - totalOut,
        binancePositions: [...prev.binancePositions, position],
      }));
      return null;
    },
    []
  );

  const closeBinancePosition = useCallback(
    (id: string, currentPrice: number, exit: ClosedTrade["exit"] = "MANUAL") => {
      setState((prev) => {
        const pos = prev.binancePositions.find((p) => p.id === id);
        if (!pos) return prev;
        const margin = pos.notional / pos.leverage;
        const priceDelta =
          pos.direction === "LONG"
            ? (currentPrice - pos.entryPrice) / pos.entryPrice
            : (pos.entryPrice - currentPrice) / pos.entryPrice;
        const grossPnl = priceDelta * pos.notional;
        const fees = calcCloseFeeForBinance(pos.notional);
        const pnl = grossPnl - fees;
        const proceeds = Math.max(0, margin + pnl);
        const closed: ClosedTrade = {
          id: crypto.randomUUID(),
          type: "BINANCE",
          symbol: pos.asset,
          description: `${pos.direction} ${pos.asset} ${pos.leverage}x @ $${pos.entryPrice.toLocaleString()} → $${currentPrice.toLocaleString()}`,
        slPrice: pos.slPrice,
        tpPrice: pos.tpPrice,
          cost: margin,
          proceeds,
          pnl,
          fees,
          closedAt: new Date().toISOString(),
          openedAt: pos.openedAt,
          auto: pos.auto,
          exit,
          direction: pos.direction,
          entryPrice: pos.entryPrice,
          exitPrice: currentPrice,
          leverage: pos.leverage,
          qty: pos.notional,
          source: pos.source,
        };
        return {
          ...prev,
          cash: prev.cash + proceeds,
          binancePositions: prev.binancePositions.filter((p) => p.id !== id),
          tradeHistory: [closed, ...prev.tradeHistory],
        };
      });
    },
    []
  );

  const openFundingPosition = useCallback(
    (
      pos: Omit<FundingPosition, "id" | "openedAt" | "lastAccrualAt" | "accruedFundingUsd"> & { accruedFundingUsd?: number },
      minCashReserve = 0
    ) => {
      if (!(pos.notionalPerLeg > 0)) return "Amount must be positive";
      if (!Number.isFinite(pos.entryPrice) || pos.entryPrice <= 0) return "Invalid base price";
      // Capital deployed for the delta-neutral pair = notionalPerLeg.
      const capital = pos.notionalPerLeg;
      if (stateRef.current.cash < capital) return "Insufficient balance";
      if (stateRef.current.cash - capital < Math.max(0, minCashReserve)) return "Below cash reserve";
      const now = new Date().toISOString();
      const position: FundingPosition = {
        ...pos,
        accruedFundingUsd: pos.accruedFundingUsd ?? 0,
        id: crypto.randomUUID(),
        openedAt: now,
        lastAccrualAt: now,
      };
      stateRef.current = {
        ...stateRef.current,
        cash: stateRef.current.cash - capital,
        fundingPositions: [...stateRef.current.fundingPositions, position],
      };
      setState((prev) => ({
        ...prev,
        cash: prev.cash - capital,
        fundingPositions: [...prev.fundingPositions, position],
      }));
      return null;
    },
    []
  );

  const closeFundingPosition = useCallback(
    (id: string, exit: ClosedTrade["exit"] = "MANUAL") => {
      setState((prev) => {
        const pos = prev.fundingPositions.find((p) => p.id === id);
        if (!pos) return prev;
        const pnl = pos.accruedFundingUsd;
        const proceeds = Math.max(0, pos.notionalPerLeg + pnl);
        const sideLabel = pos.side === "SHORT_PERP" ? "Long base / Short perp" : "Short base / Long perp";
        const closed: ClosedTrade = {
          id: crypto.randomUUID(),
          type: "FUNDING",
          symbol: pos.asset,
          description: `${pos.asset} delta-neutral funding (${sideLabel}) · $${pos.notionalPerLeg.toLocaleString()}/leg · funding $${pnl.toFixed(2)}`,
          cost: pos.notionalPerLeg,
          proceeds,
          pnl,
          fees: 0,
          closedAt: new Date().toISOString(),
          openedAt: pos.openedAt,
          auto: pos.auto,
          exit,
          direction: pos.side === "SHORT_PERP" ? "SHORT" : "LONG",
          entryPrice: pos.entryPrice,
          exitPrice: pos.entryPrice,
          leverage: 1,
          qty: pos.notionalPerLeg,
          source: pos.source,
        };
        return {
          ...prev,
          cash: prev.cash + proceeds,
          fundingPositions: prev.fundingPositions.filter((p) => p.id !== id),
          tradeHistory: [closed, ...prev.tradeHistory],
        };
      });
    },
    []
  );

  /**
   * Accrue simulated funding into every open funding position. Funding earned over
   * an elapsed window = notionalPerLeg * (annualizedPercent/100) * (elapsed / 1 year).
   * Idempotent against `lastAccrualAt` so repeated ticks don't double-count.
   */
  const accrueFunding = useCallback((now = Date.now()) => {
    const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
    if (stateRef.current.fundingPositions.length === 0) return;
    const apply = (list: FundingPosition[]): FundingPosition[] =>
      list.map((p) => {
        const last = new Date(p.lastAccrualAt).getTime();
        const elapsed = now - last;
        if (!(elapsed > 0)) return p;
        const earned = p.notionalPerLeg * (p.annualizedPercent / 100) * (elapsed / YEAR_MS);
        return {
          ...p,
          accruedFundingUsd: p.accruedFundingUsd + earned,
          lastAccrualAt: new Date(now).toISOString(),
        };
      });
    stateRef.current = { ...stateRef.current, fundingPositions: apply(stateRef.current.fundingPositions) };
    setState((prev) => ({ ...prev, fundingPositions: apply(prev.fundingPositions) }));
  }, []);

  /**
   * Buy a long paper option. The full premium is committed from cash up front
   * (that premium is also the maximum loss). Validated against the live
   * stateRef so concurrent same-tick opens can't collectively breach the cash
   * reserve floor.
   */
  const openOptionPosition = useCallback(
    (pos: Omit<OptionPosition, "id" | "openedAt">, minCashReserve = 0): string | null => {
      if (!(pos.premiumPaid > 0)) return "Premium must be positive";
      if (!(pos.contracts > 0)) return "Invalid contract size";
      if (!Number.isFinite(pos.strike) || pos.strike <= 0) return "Invalid strike";
      if (stateRef.current.cash < pos.premiumPaid) return "Insufficient balance";
      if (stateRef.current.cash - pos.premiumPaid < Math.max(0, minCashReserve)) return "Below cash reserve";
      const position: OptionPosition = {
        ...pos,
        id: crypto.randomUUID(),
        openedAt: new Date().toISOString(),
      };
      stateRef.current = {
        ...stateRef.current,
        cash: stateRef.current.cash - pos.premiumPaid,
        optionPositions: [...stateRef.current.optionPositions, position],
      };
      setState((prev) => ({
        ...prev,
        cash: prev.cash - pos.premiumPaid,
        optionPositions: [...prev.optionPositions, position],
      }));
      return null;
    },
    []
  );

  const closeOptionPosition = useCallback(
    (id: string, underlyingPrice: number, exit: ClosedTrade["exit"] = "MANUAL") => {
      setState((prev) => {
        const pos = prev.optionPositions.find((p) => p.id === id);
        if (!pos) return prev;
        const mark = Number.isFinite(underlyingPrice) && underlyingPrice > 0 ? underlyingPrice : pos.entryUnderlying;
        const value = optionPositionValue({
          kind: pos.kind,
          underlying: mark,
          strike: pos.strike,
          expiryMs: pos.expiryMs,
          vol: pos.entryVol,
          contracts: pos.contracts,
        });
        const proceeds = Math.max(0, Number.isFinite(value) ? value : 0);
        const pnl = proceeds - pos.premiumPaid;
        const closed: ClosedTrade = {
          id: crypto.randomUUID(),
          type: "OPTION",
          symbol: pos.underlying,
          description: `${pos.kind} ${pos.underlying} @ $${pos.strike.toLocaleString(undefined, { maximumFractionDigits: 2 })} · ${pos.contracts.toFixed(4)} contr · premium $${pos.premiumPaid.toFixed(2)} → $${proceeds.toFixed(2)}`,
          cost: pos.premiumPaid,
          proceeds,
          pnl,
          fees: 0,
          closedAt: new Date().toISOString(),
          openedAt: pos.openedAt,
          auto: pos.auto,
          exit,
          direction: pos.kind === "CALL" ? "LONG" : "SHORT",
          entryPrice: pos.entryUnderlying,
          exitPrice: mark,
          leverage: 1,
          qty: pos.contracts,
          source: pos.source,
        };
        const next = {
          ...prev,
          cash: prev.cash + proceeds,
          optionPositions: prev.optionPositions.filter((p) => p.id !== id),
          tradeHistory: [closed, ...prev.tradeHistory],
        };
        stateRef.current = next;
        return next;
      });
    },
    []
  );

  const openStockPosition = useCallback(
    (stock: Omit<StockPosition, "id" | "shares" | "cost" | "openedAt" | "leverage">, amountUsd: number, leverage: number = 1, minCashReserve = 0) => {
      if (amountUsd <= 0) return "Amount must be positive";
      if (stock.entryPrice <= 0) return "Price unavailable";
      const lev = leverage >= 1 ? leverage : 1;
      const shares = (amountUsd * lev) / stock.entryPrice;
      const openFee = shares * stock.entryPrice * FEE_RATES.stock.open;
      const totalOut = amountUsd + openFee;
      if (stateRef.current.cash < totalOut) return "Insufficient balance + fee";
      // Account Manager cash reserve: enforced atomically against live cash so
      // concurrent same-tick opens across bots can't collectively breach it.
      if (stateRef.current.cash - totalOut < Math.max(0, minCashReserve)) return "Below cash reserve";
      // Apply realistic slippage: larger orders get worse fills.
      const execPrice = applySlippage(stock.entryPrice, amountUsd * lev, stock.direction ?? "LONG");
      const position: StockPosition = {
        ...stock,
        entryPrice: execPrice,
        id: crypto.randomUUID(),
        shares,
        leverage: lev,
        cost: amountUsd,
        openedAt: new Date().toISOString(),
      };
      stateRef.current = {
        ...stateRef.current,
        cash: stateRef.current.cash - totalOut,
        stockPositions: [...stateRef.current.stockPositions, position],
      };
      setState((prev) => ({
        ...prev,
        cash: prev.cash - totalOut,
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
      const dir = pos.direction ?? "LONG";
      const grossPnl = pos.shares * (dir === "SHORT" ? pos.entryPrice - currentPrice : currentPrice - pos.entryPrice);
      const fees = calcCloseFeeForStock(pos.shares, currentPrice);
      const pnl = grossPnl - fees;
      const proceeds = Math.max(0, pos.cost + pnl);
      const closed: ClosedTrade = {
        id: crypto.randomUUID(),
        type: "STOCK",
        symbol: pos.symbol,
        description: `${dir} ${pos.symbol}${pos.leverage > 1 ? ` ${pos.leverage}x` : ""} ${pos.shares.toFixed(2)} sh @ $${pos.entryPrice.toFixed(2)} → $${currentPrice.toFixed(2)}`,
        slPrice: pos.slPrice,
        tpPrice: pos.tpPrice,
        cost: pos.cost,
        proceeds,
        pnl,
        fees,
        closedAt: new Date().toISOString(),
        openedAt: pos.openedAt,
        auto: pos.auto,
        direction: dir,
        entryPrice: pos.entryPrice,
        exitPrice: currentPrice,
        leverage: pos.leverage,
        qty: pos.shares,
        source: pos.source,
      };
      return {
        ...prev,
        cash: prev.cash + proceeds,
        stockPositions: prev.stockPositions.filter((p) => p.id !== id),
        tradeHistory: [closed, ...prev.tradeHistory],
      };
    });
  }, []);

  /** Auto-execute SL/TP for open Binance positions when price crosses threshold. */
  const checkSlTp = useCallback((prices: Record<string, number>) => {
    setState((prev) => {
      let changed = false;
      let binancePositions = prev.binancePositions;
      let stockPositions = prev.stockPositions;
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
        const grossPnl = priceDelta * pos.notional;
        const fees = calcCloseFeeForBinance(pos.notional);
        const pnl = grossPnl - fees;
        const proceeds = Math.max(0, margin + pnl);

        const closed: ClosedTrade = {
          id: crypto.randomUUID(),
          type: "BINANCE",
          symbol: pos.asset,
          description: `${hitTP ? "TP" : "SL"} ${pos.direction} ${pos.asset} ${pos.leverage}x @ $${price.toLocaleString()} (entry $${pos.entryPrice.toLocaleString()})`,
          slPrice: pos.slPrice,
          tpPrice: pos.tpPrice,
          cost: margin,
          proceeds,
          pnl,
          fees,
          closedAt: new Date().toISOString(),
          openedAt: pos.openedAt,
          auto: pos.auto,
          exit: hitTP ? "TP" : "SL",
          direction: pos.direction,
          entryPrice: pos.entryPrice,
          exitPrice: price,
          leverage: pos.leverage,
          qty: pos.notional,
          source: pos.source,
        };

        binancePositions = binancePositions.filter((p) => p.id !== pos.id);
        cash = cash + proceeds;
        tradeHistory = [closed, ...tradeHistory];
        changed = true;
      }

      // Stocks: LONG closes on price falling to SL / rising to TP; SHORT is mirrored.
      for (const pos of prev.stockPositions) {
        const price = prices[pos.symbol];
        if (!price) continue;
        const dir = pos.direction ?? "LONG";

        const hitSL = pos.slPrice != null && (dir === "SHORT" ? price >= pos.slPrice : price <= pos.slPrice);
        const hitTP = pos.tpPrice != null && (dir === "SHORT" ? price <= pos.tpPrice : price >= pos.tpPrice);
        if (!hitSL && !hitTP) continue;

        const grossPnl = pos.shares * (dir === "SHORT" ? pos.entryPrice - price : price - pos.entryPrice);
        const fees = calcCloseFeeForStock(pos.shares, price);
        const pnl = grossPnl - fees;
        const proceeds = Math.max(0, pos.cost + pnl);

        const closed: ClosedTrade = {
          id: crypto.randomUUID(),
          type: "STOCK",
          symbol: pos.symbol,
          description: `${hitTP ? "TP" : "SL"} ${dir} ${pos.symbol}${pos.leverage > 1 ? ` ${pos.leverage}x` : ""} ${pos.shares.toFixed(2)} sh @ $${price.toFixed(2)} (entry $${pos.entryPrice.toFixed(2)})`,
          slPrice: pos.slPrice,
          tpPrice: pos.tpPrice,
          cost: pos.cost,
          proceeds,
          pnl,
          fees,
          closedAt: new Date().toISOString(),
          openedAt: pos.openedAt,
          auto: pos.auto,
          exit: hitTP ? "TP" : "SL",
          direction: dir,
          entryPrice: pos.entryPrice,
          exitPrice: price,
          leverage: pos.leverage,
          qty: pos.shares,
          source: pos.source,
        };

        stockPositions = stockPositions.filter((p) => p.id !== pos.id);
        cash = cash + proceeds;
        tradeHistory = [closed, ...tradeHistory];
        changed = true;
      }

      if (!changed) return prev;
      return { ...prev, binancePositions, stockPositions, cash, tradeHistory };
    });
  }, []);

  /**
   * Ratchet trailing stops. For each Binance position with a `trail` config we
   * track the best favorable price and, once price has moved past the
   * activation threshold, pull the stop to within `distancePct` of that best
   * price. The stop only ever moves in the favorable direction — never against
   * the position. Runs before checkSlTp so a tightened stop can trigger.
   */
  const updateTrailingStops = useCallback((prices: Record<string, number>) => {
    setState((prev) => {
      let changed = false;
      const binancePositions = prev.binancePositions.map((pos) => {
        if (!pos.trail) return pos;
        const price = prices[pos.asset];
        if (!price || !Number.isFinite(price)) return pos;

        const { activatePct, distancePct } = pos.trail;
        const isLong = pos.direction === "LONG";

        // Track the best favorable price seen.
        const prevPeak = pos.trail.peak ?? pos.entryPrice;
        const peak = isLong ? Math.max(prevPeak, price) : Math.min(prevPeak, price);

        // Favorable move from entry to the best price (in price %).
        const movePct = isLong
          ? ((peak - pos.entryPrice) / pos.entryPrice) * 100
          : ((pos.entryPrice - peak) / pos.entryPrice) * 100;
        const armed = pos.trail.armed || movePct >= activatePct;

        let slPrice = pos.slPrice;
        if (armed) {
          const candidate = isLong
            ? peak * (1 - distancePct / 100)
            : peak * (1 + distancePct / 100);
          // Only tighten — never loosen the stop.
          if (isLong) {
            if (slPrice == null || candidate > slPrice) slPrice = candidate;
          } else {
            if (slPrice == null || candidate < slPrice) slPrice = candidate;
          }
        }

        const newTrail = { ...pos.trail, peak, armed };
        if (
          slPrice === pos.slPrice &&
          newTrail.peak === pos.trail.peak &&
          newTrail.armed === pos.trail.armed
        ) {
          return pos;
        }
        changed = true;
        return { ...pos, slPrice, trail: newTrail };
      });

      if (!changed) return prev;
      return { ...prev, binancePositions };
    });
  }, []);

  /**
   * Emergency pre-liquidation guard. A leveraged position is liquidated once an
   * adverse move wipes its margin (≈ 100/leverage % against entry). We exit
   * earlier — as soon as the unrealized loss has consumed `maxLossPerTradePct`%
   * of the posted margin — so the situation never becomes unrecoverable. Tagged
   * exit:"LIQ". Runs after trailing/SL-TP as a last-resort backstop.
   */
  const checkRiskGuards = useCallback((prices: Record<string, number>, maxLossPerTradePct: number) => {
    const lossFrac = maxLossPerTradePct / 100;
    if (!(lossFrac > 0)) return;
    setState((prev) => {
      let changed = false;
      let binancePositions = prev.binancePositions;
      let cash = prev.cash;
      let tradeHistory = prev.tradeHistory;

      for (const pos of prev.binancePositions) {
        const price = prices[pos.asset];
        if (!price || !Number.isFinite(price)) continue;

        const margin = pos.notional / pos.leverage;
        const priceDelta =
          pos.direction === "LONG"
            ? (price - pos.entryPrice) / pos.entryPrice
            : (pos.entryPrice - price) / pos.entryPrice;
        const grossPnl = priceDelta * pos.notional;
        const fees = calcCloseFeeForBinance(pos.notional);
        const pnl = grossPnl - fees;
        // Only fire on losers whose loss has eaten the configured share of margin.
        if (pnl >= 0 || -pnl < margin * lossFrac) continue;

        const proceeds = Math.max(0, margin + pnl);
        const closed: ClosedTrade = {
          id: crypto.randomUUID(),
          type: "BINANCE",
          symbol: pos.asset,
          description: `LIQ-GUARD ${pos.direction} ${pos.asset} ${pos.leverage}x @ $${price.toLocaleString()} (entry $${pos.entryPrice.toLocaleString()})`,
          slPrice: pos.slPrice,
          tpPrice: pos.tpPrice,
          cost: margin,
          proceeds,
          pnl,
          fees,
          closedAt: new Date().toISOString(),
          openedAt: pos.openedAt,
          auto: pos.auto,
          exit: "LIQ",
          direction: pos.direction,
          entryPrice: pos.entryPrice,
          exitPrice: price,
          leverage: pos.leverage,
          qty: pos.notional,
          source: pos.source,
        };

        binancePositions = binancePositions.filter((p) => p.id !== pos.id);
        cash = cash + proceeds;
        tradeHistory = [closed, ...tradeHistory];
        changed = true;
      }

      if (!changed) return prev;
      return { ...prev, binancePositions, cash, tradeHistory };
    });
  }, []);

  /**
   * Portfolio kill-switch. Closes every open Binance + stock position at the
   * supplied live prices (positions lacking a price are left in place). Used by
   * the engine's max-drawdown circuit breaker. Returns the count it flattened.
   */
  const flattenAll = useCallback((prices: Record<string, number>) => {
    // Compute the next book deterministically from the latest committed state
    // (stateRef) so the returned count is reliable for the caller's disarm
    // decision, then mirror it into setState.
    const prev = stateRef.current;
    let cash = prev.cash;
    let tradeHistory = prev.tradeHistory;
    const keptBinance: BinancePosition[] = [];
    const keptStocks: StockPosition[] = [];
    let closedCount = 0;

    for (const pos of prev.binancePositions) {
      const price = prices[pos.asset];
      if (!price || !Number.isFinite(price)) { keptBinance.push(pos); continue; }
      const margin = pos.notional / pos.leverage;
      const priceDelta =
        pos.direction === "LONG"
          ? (price - pos.entryPrice) / pos.entryPrice
          : (pos.entryPrice - price) / pos.entryPrice;
      const grossPnl = priceDelta * pos.notional;
      const fees = calcCloseFeeForBinance(pos.notional);
      const pnl = grossPnl - fees;
      const proceeds = Math.max(0, margin + pnl);
      const closed: ClosedTrade = {
        id: crypto.randomUUID(),
        type: "BINANCE",
        symbol: pos.asset,
        description: `KILL-SWITCH ${pos.direction} ${pos.asset} ${pos.leverage}x @ $${price.toLocaleString()} (entry $${pos.entryPrice.toLocaleString()})`,
        slPrice: pos.slPrice,
        tpPrice: pos.tpPrice,
        cost: margin,
        proceeds,
        pnl,
        fees,
        closedAt: new Date().toISOString(),
        openedAt: pos.openedAt,
        auto: pos.auto,
        exit: "LIQ",
        direction: pos.direction,
        entryPrice: pos.entryPrice,
        exitPrice: price,
        leverage: pos.leverage,
        qty: pos.notional,
        source: pos.source,
      };
      tradeHistory = [closed, ...tradeHistory];
      cash += proceeds;
      closedCount += 1;
    }

    for (const pos of prev.stockPositions) {
      const price = prices[pos.symbol];
      if (!price || !Number.isFinite(price)) { keptStocks.push(pos); continue; }
      const grossPnl = pos.shares * (pos.direction === "SHORT" ? pos.entryPrice - price : price - pos.entryPrice);
      const fees = calcCloseFeeForStock(pos.shares, price);
      const pnl = grossPnl - fees;
      const proceeds = Math.max(0, pos.cost + pnl);
      const closed: ClosedTrade = {
        id: crypto.randomUUID(),
        type: "STOCK",
        symbol: pos.symbol,
        description: `KILL-SWITCH ${pos.symbol}${pos.leverage > 1 ? ` ${pos.leverage}x` : ""} ${pos.shares.toFixed(2)} sh @ $${price.toFixed(2)} (entry $${pos.entryPrice.toFixed(2)})`,
        slPrice: pos.slPrice,
        tpPrice: pos.tpPrice,
        cost: pos.cost,
        proceeds,
        pnl,
        fees,
        closedAt: new Date().toISOString(),
        openedAt: pos.openedAt,
        auto: pos.auto,
        exit: "LIQ",
        direction: pos.direction ?? "LONG",
        entryPrice: pos.entryPrice,
        exitPrice: price,
        leverage: pos.leverage,
        qty: pos.shares,
        source: pos.source,
      };
      tradeHistory = [closed, ...tradeHistory];
      cash += proceeds;
      closedCount += 1;
    }

    // Funding positions are delta-neutral (no price), so the kill-switch can always
    // close them, returning capital + accrued simulated funding.
    const keptFunding: FundingPosition[] = [];
    for (const pos of prev.fundingPositions) {
      const pnl = pos.accruedFundingUsd;
      const proceeds = Math.max(0, pos.notionalPerLeg + pnl);
      const closed: ClosedTrade = {
        id: crypto.randomUUID(),
        type: "FUNDING",
        symbol: pos.asset,
        description: `KILL-SWITCH ${pos.asset} delta-neutral funding · funding $${pnl.toFixed(2)}`,
        cost: pos.notionalPerLeg,
        proceeds,
        pnl,
        fees: 0,
        closedAt: new Date().toISOString(),
        openedAt: pos.openedAt,
        auto: pos.auto,
        exit: "LIQ",
        direction: pos.side === "SHORT_PERP" ? "SHORT" : "LONG",
        entryPrice: pos.entryPrice,
        exitPrice: pos.entryPrice,
        leverage: 1,
        qty: pos.notionalPerLeg,
        source: pos.source,
      };
      tradeHistory = [closed, ...tradeHistory];
      cash += proceeds;
      closedCount += 1;
    }

    // Long options: mark to the supplied price (crypto map) or fall back to the
    // entry underlying when unavailable (e.g. stock options), then cash them out.
    const keptOptions: OptionPosition[] = [];
    for (const pos of prev.optionPositions) {
      const mark = prices[pos.underlying] && Number.isFinite(prices[pos.underlying]) ? prices[pos.underlying] : pos.entryUnderlying;
      const value = optionPositionValue({ kind: pos.kind, underlying: mark, strike: pos.strike, expiryMs: pos.expiryMs, vol: pos.entryVol, contracts: pos.contracts });
      const proceeds = Math.max(0, Number.isFinite(value) ? value : 0);
      const pnl = proceeds - pos.premiumPaid;
      const closed: ClosedTrade = {
        id: crypto.randomUUID(),
        type: "OPTION",
        symbol: pos.underlying,
        description: `KILL-SWITCH ${pos.kind} ${pos.underlying} @ $${pos.strike.toLocaleString(undefined, { maximumFractionDigits: 2 })} · premium $${pos.premiumPaid.toFixed(2)} → $${proceeds.toFixed(2)}`,
        cost: pos.premiumPaid,
        proceeds,
        pnl,
        fees: 0,
        closedAt: new Date().toISOString(),
        openedAt: pos.openedAt,
        auto: pos.auto,
        exit: "LIQ",
        direction: pos.kind === "CALL" ? "LONG" : "SHORT",
        entryPrice: pos.entryUnderlying,
        exitPrice: mark,
        leverage: 1,
        qty: pos.contracts,
        source: pos.source,
      };
      tradeHistory = [closed, ...tradeHistory];
      cash += proceeds;
      closedCount += 1;
    }

    if (closedCount === 0) return 0;

    const next = { ...prev, cash, binancePositions: keptBinance, stockPositions: keptStocks, fundingPositions: keptFunding, optionPositions: keptOptions, tradeHistory };
    stateRef.current = next;
    setState(next);
    return closedCount;
  }, []);

  /**
   * Atomically close every bot-placed position across all three asset types.
   * Uses stateRef so concurrent same-tick opens can't race against the close.
   */
  const closeAllBotPositions = useCallback(
    (
      binancePrices: Record<string, number>,
      stockPrices: Record<string, number>,
      polyPrices: Record<string, number>
    ): number => {
      const prev = stateRef.current;
      let cash = prev.cash;
      let tradeHistory = prev.tradeHistory;
      const keptBinance: BinancePosition[] = [];
      const keptStocks: StockPosition[] = [];
      const keptPoly: PolyPosition[] = [];
      let closedCount = 0;

      for (const pos of prev.binancePositions) {
        if (!pos.auto) { keptBinance.push(pos); continue; }
        const price = binancePrices[pos.asset];
        if (!price || !Number.isFinite(price)) { keptBinance.push(pos); continue; }
        const margin = pos.notional / pos.leverage;
        const priceDelta =
          pos.direction === "LONG"
            ? (price - pos.entryPrice) / pos.entryPrice
            : (pos.entryPrice - price) / pos.entryPrice;
        const grossPnl = priceDelta * pos.notional;
        const fees = calcCloseFeeForBinance(pos.notional);
        const pnl = grossPnl - fees;
        const proceeds = Math.max(0, margin + pnl);
        const closed: ClosedTrade = {
          id: crypto.randomUUID(),
          type: "BINANCE",
          symbol: pos.asset,
          description: `${pos.direction} ${pos.asset} ${pos.leverage}x @ $${pos.entryPrice.toLocaleString()} → $${price.toLocaleString()}`,
          slPrice: pos.slPrice,
          tpPrice: pos.tpPrice,
          cost: margin,
          proceeds,
          pnl,
          fees,
          closedAt: new Date().toISOString(),
          openedAt: pos.openedAt,
          auto: pos.auto,
          exit: "MANUAL",
          direction: pos.direction,
          entryPrice: pos.entryPrice,
          exitPrice: price,
          leverage: pos.leverage,
          qty: pos.notional,
          source: pos.source,
        };
        tradeHistory = [closed, ...tradeHistory];
        cash += proceeds;
        closedCount += 1;
      }

      for (const pos of prev.stockPositions) {
        if (!pos.auto) { keptStocks.push(pos); continue; }
        const price = stockPrices[pos.symbol];
        if (!price || !Number.isFinite(price)) { keptStocks.push(pos); continue; }
        const dir = pos.direction ?? "LONG";
        const grossPnl = pos.shares * (dir === "SHORT" ? pos.entryPrice - price : price - pos.entryPrice);
        const fees = calcCloseFeeForStock(pos.shares, price);
        const pnl = grossPnl - fees;
        const proceeds = Math.max(0, pos.cost + pnl);
        const closed: ClosedTrade = {
          id: crypto.randomUUID(),
          type: "STOCK",
          symbol: pos.symbol,
          description: `${dir} ${pos.symbol}${pos.leverage > 1 ? ` ${pos.leverage}x` : ""} ${pos.shares.toFixed(2)} sh @ $${pos.entryPrice.toFixed(2)} → $${price.toFixed(2)}`,
          slPrice: pos.slPrice,
          tpPrice: pos.tpPrice,
          cost: pos.cost,
          proceeds,
          pnl,
          fees,
          closedAt: new Date().toISOString(),
          openedAt: pos.openedAt,
          auto: pos.auto,
          exit: "MANUAL",
          direction: dir,
          entryPrice: pos.entryPrice,
          exitPrice: price,
          leverage: pos.leverage,
          qty: pos.shares,
          source: pos.source,
        };
        tradeHistory = [closed, ...tradeHistory];
        cash += proceeds;
        closedCount += 1;
      }

      for (const pos of prev.polyPositions) {
        if (!pos.auto) { keptPoly.push(pos); continue; }
        const price = polyPrices[pos.conditionId] ?? pos.entryPrice;
        const grossProceeds = pos.shares * price;
        const fees = calcCloseFeeForPoly(grossProceeds);
        const proceeds = Math.max(0, grossProceeds - fees);
        const pnl = proceeds - pos.cost;
        const closed: ClosedTrade = {
          id: crypto.randomUUID(),
          type: "POLYMARKET",
          symbol: pos.slug ?? undefined,
          conditionId: pos.conditionId,
          description: `${pos.side} @ ${pos.entryPrice.toFixed(3)} → ${price.toFixed(3)} | ${pos.question}`,
          cost: pos.cost,
          proceeds,
          pnl,
          fees,
          closedAt: new Date().toISOString(),
          openedAt: pos.openedAt,
          direction: pos.side,
          entryPrice: pos.entryPrice,
          exitPrice: price,
          leverage: 1,
          qty: pos.shares,
          question: pos.question,
          auto: pos.auto,
          source: pos.source,
        };
        tradeHistory = [closed, ...tradeHistory];
        cash += proceeds;
        closedCount += 1;
      }

      const keptFunding: FundingPosition[] = [];
      for (const pos of prev.fundingPositions) {
        if (!pos.auto) { keptFunding.push(pos); continue; }
        const pnl = pos.accruedFundingUsd;
        const proceeds = Math.max(0, pos.notionalPerLeg + pnl);
        const sideLabel = pos.side === "SHORT_PERP" ? "Long base / Short perp" : "Short base / Long perp";
        const closed: ClosedTrade = {
          id: crypto.randomUUID(),
          type: "FUNDING",
          symbol: pos.asset,
          description: `${pos.asset} delta-neutral funding (${sideLabel}) · funding $${pnl.toFixed(2)}`,
          cost: pos.notionalPerLeg,
          proceeds,
          pnl,
          fees: 0,
          closedAt: new Date().toISOString(),
          openedAt: pos.openedAt,
          auto: pos.auto,
          exit: "MANUAL",
          direction: pos.side === "SHORT_PERP" ? "SHORT" : "LONG",
          entryPrice: pos.entryPrice,
          exitPrice: pos.entryPrice,
          leverage: 1,
          qty: pos.notionalPerLeg,
          source: pos.source,
        };
        tradeHistory = [closed, ...tradeHistory];
        cash += proceeds;
        closedCount += 1;
      }

      // Bot-placed long options — mark from the crypto or stock price map.
      const keptOptions: OptionPosition[] = [];
      for (const pos of prev.optionPositions) {
        if (!pos.auto) { keptOptions.push(pos); continue; }
        const map = pos.market === "STOCK" ? stockPrices : binancePrices;
        const mark = map[pos.underlying] && Number.isFinite(map[pos.underlying]) ? map[pos.underlying] : pos.entryUnderlying;
        const value = optionPositionValue({ kind: pos.kind, underlying: mark, strike: pos.strike, expiryMs: pos.expiryMs, vol: pos.entryVol, contracts: pos.contracts });
        const proceeds = Math.max(0, Number.isFinite(value) ? value : 0);
        const pnl = proceeds - pos.premiumPaid;
        const closed: ClosedTrade = {
          id: crypto.randomUUID(),
          type: "OPTION",
          symbol: pos.underlying,
          description: `${pos.kind} ${pos.underlying} @ $${pos.strike.toLocaleString(undefined, { maximumFractionDigits: 2 })} · premium $${pos.premiumPaid.toFixed(2)} → $${proceeds.toFixed(2)}`,
          cost: pos.premiumPaid,
          proceeds,
          pnl,
          fees: 0,
          closedAt: new Date().toISOString(),
          openedAt: pos.openedAt,
          auto: pos.auto,
          exit: "MANUAL",
          direction: pos.kind === "CALL" ? "LONG" : "SHORT",
          entryPrice: pos.entryUnderlying,
          exitPrice: mark,
          leverage: 1,
          qty: pos.contracts,
          source: pos.source,
        };
        tradeHistory = [closed, ...tradeHistory];
        cash += proceeds;
        closedCount += 1;
      }

      if (closedCount === 0) return 0;

      const next = {
        ...prev,
        cash,
        binancePositions: keptBinance,
        stockPositions: keptStocks,
        polyPositions: keptPoly,
        fundingPositions: keptFunding,
        optionPositions: keptOptions,
        tradeHistory,
      };
      stateRef.current = next;
      setState(next);
      return closedCount;
    },
    []
  );

  const resetPortfolio = useCallback(() => {
    setState({
      cash: STARTING_BALANCE,
      totalDeposited: STARTING_BALANCE,
      polyPositions: [],
      binancePositions: [],
      stockPositions: [],
      fundingPositions: [],
      optionPositions: [],
      tradeHistory: [],
    });
  }, []);

  const walletSummaries: WalletSummary[] = book.wallets.map((w) => ({
    id: w.id,
    name: w.name,
    cash: w.cash,
    totalDeposited: w.totalDeposited,
    openPositions:
      w.polyPositions.length + w.binancePositions.length + w.stockPositions.length + w.fundingPositions.length + w.optionPositions.length,
  }));

  return (
    <PortfolioContext.Provider
      value={{
        ...state,
        wallets: walletSummaries,
        activeWalletId: activeWallet.id,
        activeWalletName: activeWallet.name,
        activeWalletCreatedAt: activeWallet.createdAt,
        createWallet,
        renameWallet,
        deleteWallet,
        switchWallet,
        addFunds,
        openPolyPosition,
        closePolyPosition,
        openBinancePosition,
        closeBinancePosition,
        openStockPosition,
        closeStockPosition,
        openFundingPosition,
        closeFundingPosition,
        openOptionPosition,
        closeOptionPosition,
        accrueFunding,
        checkSlTp,
        updateTrailingStops,
        checkRiskGuards,
        flattenAll,
        closeAllBotPositions,
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
