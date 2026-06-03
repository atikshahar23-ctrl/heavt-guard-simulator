export type TradeDirection = "LONG" | "SHORT";

export interface RecommendedLevels {
  sl: number;
  tp: number;
  slPct: number;
  tpPct: number;
}

/** Round a price to a sensible precision based on its magnitude. */
export function roundPrice(value: number): number {
  const abs = Math.abs(value);
  const decimals = abs >= 100 ? 2 : abs >= 1 ? 4 : 6;
  return Number(value.toFixed(decimals));
}

/**
 * Compute a recommended stop-loss / take-profit pair for a one-click setup.
 * Defaults to a scalp-style 1.5% risk with a 2:1 reward (3% target).
 * For LONG: SL below entry, TP above. For SHORT: mirrored.
 */
export function recommendLevels(
  entry: number,
  direction: TradeDirection,
  opts?: { slPct?: number; tpPct?: number },
): RecommendedLevels {
  const slPct = opts?.slPct ?? 0.015;
  const tpPct = opts?.tpPct ?? 0.03;
  const sl =
    direction === "LONG" ? entry * (1 - slPct) : entry * (1 + slPct);
  const tp =
    direction === "LONG" ? entry * (1 + tpPct) : entry * (1 - tpPct);
  return { sl: roundPrice(sl), tp: roundPrice(tp), slPct, tpPct };
}
