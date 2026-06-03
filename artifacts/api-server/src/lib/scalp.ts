import { logger } from "./logger";
import { fetchKlines, fetchMarketOverview, type Kline } from "./binance";

export type ScalpDirection = "LONG" | "SHORT" | "NEUTRAL";
export type ScalpConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface ScalpSignal {
  symbol: string;
  asset: string;
  direction: ScalpDirection;
  confidence: ScalpConfidence;
  /** 0-100 composite strength score */
  score: number;
  price: number;
  changePercent: number;
  rsi: number;
  emaFast: number;
  emaSlow: number;
  atr: number;
  /** Suggested entry price */
  entry: number;
  /** Protective stop */
  stopLoss: number;
  /** Profit target */
  takeProfit: number;
  /** Reward-to-risk ratio */
  riskReward: number;
  /** Human-readable supporting reasons */
  reasons: string[];
}

/* ── Indicators ───────────────────────────────────────────────── */

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0] ?? 0;
  values.forEach((v, i) => {
    prev = i === 0 ? v : v * k + prev * (1 - k);
    out.push(prev);
  });
  return out;
}

function rsi(closes: number[], period = 14): number {
  if (closes.length <= period) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function atr(klines: Kline[], period = 14): number {
  if (klines.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < klines.length; i++) {
    const cur = klines[i];
    const prevClose = klines[i - 1].close;
    trs.push(Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prevClose),
      Math.abs(cur.low - prevClose),
    ));
  }
  const window = trs.slice(-period);
  return window.reduce((a, b) => a + b, 0) / window.length;
}

/* ── Signal generation ────────────────────────────────────────── */

function analyze(symbol: string, asset: string, changePercent: number, klines: Kline[]): ScalpSignal | null {
  if (klines.length < 30) return null;
  const closes = klines.map((k) => k.close);
  const price = closes[closes.length - 1];
  if (!Number.isFinite(price) || price <= 0) return null;

  const rsiVal = rsi(closes, 14);
  const emaFastArr = ema(closes, 9);
  const emaSlowArr = ema(closes, 21);
  const emaFast = emaFastArr[emaFastArr.length - 1];
  const emaSlow = emaSlowArr[emaSlowArr.length - 1];
  const emaFastPrev = emaFastArr[emaFastArr.length - 2];
  const emaSlowPrev = emaSlowArr[emaSlowArr.length - 2];
  const atrVal = atr(klines, 14);

  // Recent swing high/low (last 20 candles) for momentum context.
  const recent = klines.slice(-20);
  const swingHigh = Math.max(...recent.map((k) => k.high));
  const swingLow = Math.min(...recent.map((k) => k.low));

  const reasons: string[] = [];
  let bull = 0;
  let bear = 0;

  // EMA trend
  if (emaFast > emaSlow) { bull += 2; reasons.push("EMA9 above EMA21 (uptrend)"); }
  else if (emaFast < emaSlow) { bear += 2; reasons.push("EMA9 below EMA21 (downtrend)"); }

  // EMA crossover (fresh)
  const crossedUp = emaFastPrev <= emaSlowPrev && emaFast > emaSlow;
  const crossedDown = emaFastPrev >= emaSlowPrev && emaFast < emaSlow;
  if (crossedUp) { bull += 2; reasons.push("Fresh bullish EMA crossover"); }
  if (crossedDown) { bear += 2; reasons.push("Fresh bearish EMA crossover"); }

  // RSI
  if (rsiVal < 30) { bull += 2; reasons.push(`RSI ${rsiVal.toFixed(0)} — oversold bounce setup`); }
  else if (rsiVal > 70) { bear += 2; reasons.push(`RSI ${rsiVal.toFixed(0)} — overbought pullback setup`); }
  else if (rsiVal >= 45 && rsiVal <= 60 && emaFast > emaSlow) { bull += 1; reasons.push(`RSI ${rsiVal.toFixed(0)} — healthy momentum`); }

  // Price vs swing range (breakout / breakdown proximity)
  const range = swingHigh - swingLow;
  if (range > 0) {
    const pos = (price - swingLow) / range; // 0 = at low, 1 = at high
    if (pos > 0.85) { bull += 1; reasons.push("Pressing 20-bar high (breakout)"); }
    if (pos < 0.15) { bear += 1; reasons.push("Pressing 20-bar low (breakdown)"); }
  }

  const net = bull - bear;
  let direction: ScalpDirection = "NEUTRAL";
  if (net >= 2) direction = "LONG";
  else if (net <= -2) direction = "SHORT";

  const strength = Math.min(100, Math.abs(net) * 18 + Math.abs(50 - rsiVal));
  const score = Math.round(strength);
  const confidence: ScalpConfidence = score >= 70 ? "HIGH" : score >= 45 ? "MEDIUM" : "LOW";

  // Entry / stop / target sized off ATR (1.5× stop, 2.5× target → ~1.7 R:R).
  const atrStop = atrVal > 0 ? atrVal * 1.5 : price * 0.01;
  const atrTarget = atrVal > 0 ? atrVal * 2.5 : price * 0.018;

  let entry = price;
  let stopLoss: number;
  let takeProfit: number;
  if (direction === "SHORT") {
    stopLoss = price + atrStop;
    takeProfit = price - atrTarget;
  } else {
    // default LONG geometry (also used for NEUTRAL as reference)
    stopLoss = price - atrStop;
    takeProfit = price + atrTarget;
  }

  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(takeProfit - entry);
  const riskReward = risk > 0 ? parseFloat((reward / risk).toFixed(2)) : 0;

  if (reasons.length === 0) reasons.push("No strong confluence — stay flat");

  return {
    symbol,
    asset,
    direction,
    confidence,
    score,
    price,
    changePercent,
    rsi: parseFloat(rsiVal.toFixed(1)),
    emaFast: parseFloat(emaFast.toFixed(price < 1 ? 6 : 2)),
    emaSlow: parseFloat(emaSlow.toFixed(price < 1 ? 6 : 2)),
    atr: parseFloat(atrVal.toFixed(price < 1 ? 6 : 2)),
    entry: parseFloat(entry.toFixed(price < 1 ? 6 : 2)),
    stopLoss: parseFloat(stopLoss.toFixed(price < 1 ? 6 : 2)),
    takeProfit: parseFloat(takeProfit.toFixed(price < 1 ? 6 : 2)),
    riskReward,
    reasons,
  };
}

/* ── Cache + public API ───────────────────────────────────────── */

let _cache: { data: ScalpSignal[]; expiresAt: number; key: string } | null = null;
let _inflight: { key: string; promise: Promise<ScalpSignal[]> } | null = null;
const CACHE_TTL_MS = 60 * 1000;
const CONCURRENCY = 8;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * Compute scalp signals for the top-N liquid coins on the 15m timeframe.
 * Returns signals sorted by actionability (LONG/SHORT first, then score).
 */
export async function fetchScalpSignals(opts: { interval?: string; coins?: number } = {}): Promise<ScalpSignal[]> {
  const { interval = "15m", coins = 30 } = opts;
  const cacheKey = `${interval}:${coins}`;
  if (_cache && Date.now() < _cache.expiresAt && _cache.key === cacheKey) {
    return _cache.data;
  }

  // Coalesce concurrent cold-cache requests so we don't duplicate upstream load.
  if (_inflight && _inflight.key === cacheKey) return _inflight.promise;

  const promise = (async () => {
    const overview = await fetchMarketOverview(coins);

    const results = await mapLimit(overview, CONCURRENCY, async (coin) => {
      try {
        const klines = await fetchKlines(coin.symbol, interval, 100);
        return analyze(coin.symbol, coin.asset, coin.changePercent, klines);
      } catch (err) {
        logger.warn({ err: String(err), symbol: coin.symbol }, "Scalp analyze failed");
        return null;
      }
    });

    const signals = results.filter((s): s is ScalpSignal => s !== null);

    const dirRank: Record<ScalpDirection, number> = { LONG: 0, SHORT: 0, NEUTRAL: 1 };
    signals.sort((a, b) => {
      const d = dirRank[a.direction] - dirRank[b.direction];
      if (d !== 0) return d;
      return b.score - a.score;
    });

    _cache = { data: signals, expiresAt: Date.now() + CACHE_TTL_MS, key: cacheKey };
    return signals;
  })();

  _inflight = { key: cacheKey, promise };
  try {
    return await promise;
  } finally {
    if (_inflight && _inflight.promise === promise) _inflight = null;
  }
}
