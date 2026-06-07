/**
 * Simplified options pricing for the paper Options Agent — educational only.
 *
 * Uses a textbook Black–Scholes model with a zero risk-free rate (paper money,
 * no carry). It is intentionally minimal: enough to give a premium at open and a
 * believable mark-to-market as the underlying moves and time decays, so learners
 * can see directional P&L, theta decay and the capped-loss nature of long
 * options. It is NOT a trading-grade pricer and makes no market predictions.
 */

export type OptionKind = "CALL" | "PUT";

/** Milliseconds in a 365-day year — the clock the time-decay model runs on. */
export const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Default annualized implied volatility per market. Crypto is far more volatile
 * than equities, so its options carry richer premiums and decay harder. These
 * are fixed educational assumptions, not live IV.
 */
export const DEFAULT_VOL: Record<"CRYPTO" | "STOCK", number> = {
  CRYPTO: 0.75,
  STOCK: 0.35,
};

/** Standard-normal CDF via the Abramowitz–Stegun erf approximation. */
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p =
    d *
    t *
    (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x >= 0 ? 1 - p : p;
}

/**
 * Black–Scholes price of one option (per 1 unit of underlying), r = 0.
 * `years` is the time to expiry in years, `vol` the annualized volatility.
 * As time runs out the price collapses to intrinsic value.
 */
export function blackScholesPrice(args: {
  kind: OptionKind;
  spot: number;
  strike: number;
  years: number;
  vol: number;
}): number {
  const { kind, spot, strike, years, vol } = args;
  if (!(spot > 0) || !(strike > 0)) return 0;
  const intrinsic = kind === "CALL" ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
  // At/after expiry, or with no vol, an option is worth exactly its intrinsic value.
  if (!(years > 0) || !(vol > 0)) return intrinsic;
  const sqrtT = Math.sqrt(years);
  const d1 = (Math.log(spot / strike) + (vol * vol) / 2 * years) / (vol * sqrtT);
  const d2 = d1 - vol * sqrtT;
  const price =
    kind === "CALL"
      ? spot * normCdf(d1) - strike * normCdf(d2)
      : strike * normCdf(-d2) - spot * normCdf(-d1);
  // Numerical floor: never below intrinsic, never negative.
  return Math.max(intrinsic, price, 0);
}

/** Years remaining until `expiryMs`, floored at 0. */
export function yearsToExpiry(expiryMs: number, now = Date.now()): number {
  return Math.max(0, (expiryMs - now) / YEAR_MS);
}

/**
 * Pick a strike a given % out-of-the-money from spot. CALLs strike above spot,
 * PUTs below — the cheaper, higher-leverage contracts a directional bettor buys.
 */
export function pickStrike(spot: number, kind: OptionKind, otmPct: number): number {
  const f = Math.max(0, otmPct) / 100;
  return kind === "CALL" ? spot * (1 + f) : spot * (1 - f);
}

/**
 * Current value (USD) of a long option position: per-unit Black–Scholes price ×
 * contracts. Floors at 0 — a long option can expire worthless but never owes.
 */
export function optionPositionValue(args: {
  kind: OptionKind;
  underlying: number;
  strike: number;
  expiryMs: number;
  vol: number;
  contracts: number;
  now?: number;
}): number {
  const { kind, underlying, strike, expiryMs, vol, contracts, now } = args;
  const years = yearsToExpiry(expiryMs, now);
  const per = blackScholesPrice({ kind, spot: underlying, strike, years, vol });
  return Math.max(0, per * contracts);
}
