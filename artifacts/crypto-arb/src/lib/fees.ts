/**
 * Realistic per-trade fee rates for the paper-trading simulator.
 * All values are expressed as decimals (e.g. 0.00055 = 0.055%).
 */
export const FEE_RATES = {
  /** Perpetual futures (Binance) — per-side fee. */
  perp: { open: 0.00055, close: 0.00055 },
  /** Spot crypto (Binance) — per-side fee. */
  spot: { open: 0.0005, close: 0.0005 },
  /** US equities — commission per side. */
  stock: { open: 0.0001, close: 0.0001 },
  /** Prediction market — fee per side. */
  poly: { open: 0.0002, close: 0.0002 },
} as const;

/** Round-trip fee for a Binance perpetual position (open + close). */
export function calcFeeForBinance(notional: number): number {
  return notional * (FEE_RATES.perp.open + FEE_RATES.perp.close);
}

/** Close-side fee only for a Binance perpetual position. */
export function calcCloseFeeForBinance(notional: number): number {
  return notional * FEE_RATES.perp.close;
}

/** Round-trip fee for a stock position (open + close). */
export function calcFeeForStock(
  shares: number,
  entryPrice: number,
  exitPrice: number,
): number {
  return (
    shares * entryPrice * FEE_RATES.stock.open +
    shares * exitPrice * FEE_RATES.stock.close
  );
}

/** Close-side fee only for a stock position. */
export function calcCloseFeeForStock(
  shares: number,
  exitPrice: number,
): number {
  return shares * exitPrice * FEE_RATES.stock.close;
}

/** Round-trip fee for a Polymarket position (open + close). */
export function calcFeeForPoly(cost: number, grossProceeds: number): number {
  return cost * FEE_RATES.poly.open + grossProceeds * FEE_RATES.poly.close;
}

/** Close-side fee only for a Polymarket position. */
export function calcCloseFeeForPoly(grossProceeds: number): number {
  return grossProceeds * FEE_RATES.poly.close;
}

/** Format a fee for display (e.g. "$0.55"). */
export function fmtFee(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Apply realistic slippage to a mark price based on order size.
 * Larger orders get worse fills (dynamic slippage scales with notional).
 */
export function applySlippage(
  markPrice: number,
  orderSize: number,
  direction: "LONG" | "SHORT",
  baseSlippage: number = 0.001,
): number {
  const dynamicSlippage = baseSlippage * (1 + orderSize / 100_000);
  if (direction === "LONG") {
    return markPrice * (1 + dynamicSlippage);
  }
  return markPrice * (1 - dynamicSlippage);
}

/**
 * Pre-trade sanity filter: skip entries when conditions are too risky.
 * Returns a reason string if blocked, or null if the trade may proceed.
 */
export function checkPreTrade(
  volatilityPct: number, // 24h change as volatility proxy
  spreadPct: number,     // bid/ask spread estimate
  direction: "LONG" | "SHORT" | "NEUTRAL",
  maxSpread: number = 0.0005,
  maxVolatility: number = 5.0,
): string | null {
  if (spreadPct > maxSpread) {
    return `Blocked: spread ${(spreadPct * 100).toFixed(2)}% exceeds max ${(maxSpread * 100).toFixed(2)}%`;
  }
  if (Math.abs(volatilityPct) > maxVolatility) {
    return `Blocked: volatility ${Math.abs(volatilityPct).toFixed(1)}% exceeds max ${maxVolatility}%`;
  }
  if (direction === "NEUTRAL") {
    return "Blocked: no clear trend";
  }
  return null;
}
