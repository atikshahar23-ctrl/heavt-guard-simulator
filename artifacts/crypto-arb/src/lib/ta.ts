import {
  LineSeries,
  HistogramSeries,
  LineStyle,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import { t, type Lang } from "./i18n";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

/** Exponential moving average. Returns an array aligned to `values` (NaN until seeded). */
export function ema(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Wilder's RSI. Returns an array aligned to `closes` (NaN until seeded). */
export function rsi(closes: number[], period = 14): number[] {
  const out = new Array<number>(closes.length).fill(NaN);
  if (closes.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

interface Level {
  price: number;
  touches: number;
}

/** Detect swing-pivot support & resistance levels, clustered, ranked by strength near price. */
export function supportResistance(candles: Candle[], lookback = 3): { support: number[]; resistance: number[] } {
  const n = candles.length;
  if (n < lookback * 2 + 1) return { support: [], resistance: [] };
  const last = candles[n - 1].close;
  const tol = last * 0.0075; // cluster levels within ~0.75%

  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = lookback; i < n - lookback; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    let isHigh = true;
    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].high >= h) isHigh = false;
      if (candles[j].low <= l) isLow = false;
    }
    if (isHigh) highs.push(h);
    if (isLow) lows.push(l);
  }

  const cluster = (raw: number[]): Level[] => {
    const sorted = [...raw].sort((a, b) => a - b);
    const levels: Level[] = [];
    for (const p of sorted) {
      const existing = levels.find((lv) => Math.abs(lv.price - p) <= tol);
      if (existing) {
        existing.price = (existing.price * existing.touches + p) / (existing.touches + 1);
        existing.touches += 1;
      } else {
        levels.push({ price: p, touches: 1 });
      }
    }
    return levels;
  };

  const resLevels = cluster(highs)
    .filter((lv) => lv.price > last)
    .sort((a, b) => a.price - b.price);
  const supLevels = cluster(lows)
    .filter((lv) => lv.price < last)
    .sort((a, b) => b.price - a.price);

  return {
    resistance: resLevels.slice(0, 2).map((lv) => lv.price),
    support: supLevels.slice(0, 2).map((lv) => lv.price),
  };
}

/** Build buy/sell (EMA cross) + reversal (RSI exit of extreme) markers from candles. */
export function buildSignals(candles: Candle[]): SeriesMarker<Time>[] {
  const closes = candles.map((c) => c.close);
  const e9 = ema(closes, 9);
  const e21 = ema(closes, 21);
  const r = rsi(closes, 14);
  const markers: SeriesMarker<Time>[] = [];

  for (let i = 1; i < candles.length; i++) {
    const t = candles[i].time as UTCTimestamp as Time;
    const prevDiff = e9[i - 1] - e21[i - 1];
    const diff = e9[i] - e21[i];
    if (Number.isFinite(prevDiff) && Number.isFinite(diff)) {
      if (prevDiff <= 0 && diff > 0) {
        markers.push({ time: t, position: "belowBar", color: "#10b981", shape: "arrowUp", text: "BUY" });
      } else if (prevDiff >= 0 && diff < 0) {
        markers.push({ time: t, position: "aboveBar", color: "#ef4444", shape: "arrowDown", text: "SELL" });
      }
    }
    const prevR = r[i - 1];
    const curR = r[i];
    if (Number.isFinite(prevR) && Number.isFinite(curR)) {
      if (prevR < 30 && curR >= 30) {
        markers.push({ time: t, position: "belowBar", color: "#fbbf24", shape: "circle", text: "↑" });
      } else if (prevR > 70 && curR <= 70) {
        markers.push({ time: t, position: "aboveBar", color: "#fbbf24", shape: "circle", text: "↓" });
      }
    }
  }

  // Sort ascending by time (required) and keep only the most recent ~40 to avoid clutter.
  markers.sort((a, b) => (a.time as number) - (b.time as number));
  return markers.slice(-40);
}

export interface TAHandle {
  remove: () => void;
}

/**
 * Draw EMA(9/21/50) lines, support/resistance price lines and buy/sell/reversal
 * markers onto an existing chart + candle series. Returns a handle that fully
 * removes every overlay it created. Pure overlay — does not touch the candle data.
 */
export function applyTAOverlays(
  chart: IChartApi,
  candleSeries: ISeriesApi<"Candlestick">,
  candles: Candle[],
): TAHandle {
  const closes = candles.map((c) => c.close);
  const emaConfigs: { period: number; color: string }[] = [
    { period: 9, color: "#38bdf8" },
    { period: 21, color: "#a78bfa" },
    { period: 50, color: "#f59e0b" },
  ];

  const lineSeries: ISeriesApi<"Line">[] = [];
  for (const cfg of emaConfigs) {
    const vals = ema(closes, cfg.period);
    const data = candles
      .map((c, i) => ({ time: c.time as UTCTimestamp, value: vals[i] }))
      .filter((d) => Number.isFinite(d.value));
    if (data.length === 0) continue;
    const s = chart.addSeries(LineSeries, {
      color: cfg.color,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    s.setData(data);
    lineSeries.push(s);
  }

  // Bollinger Bands
  const { upper, lower } = bollinger(closes, 20, 2);
  const bbUpper = candles
    .map((c, i) => ({ time: c.time as UTCTimestamp, value: upper[i] }))
    .filter((d) => Number.isFinite(d.value));
  const bbLower = candles
    .map((c, i) => ({ time: c.time as UTCTimestamp, value: lower[i] }))
    .filter((d) => Number.isFinite(d.value));
  let bbUpperSeries: ISeriesApi<"Line"> | null = null;
  let bbLowerSeries: ISeriesApi<"Line"> | null = null;
  if (bbUpper.length > 0 && bbLower.length > 0) {
    bbUpperSeries = chart.addSeries(LineSeries, {
      color: "rgba(168, 85, 247, 0.4)", lineWidth: 1, priceLineVisible: false,
      lastValueVisible: false, crosshairMarkerVisible: false,
    });
    bbLowerSeries = chart.addSeries(LineSeries, {
      color: "rgba(168, 85, 247, 0.4)", lineWidth: 1, priceLineVisible: false,
      lastValueVisible: false, crosshairMarkerVisible: false,
    });
    bbUpperSeries.setData(bbUpper);
    bbLowerSeries.setData(bbLower);
  }

  const { support, resistance } = supportResistance(candles);
  const priceLines = [
    ...resistance.map((p) =>
      candleSeries.createPriceLine({
        price: p,
        color: "#ef4444",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "R",
      }),
    ),
    ...support.map((p) =>
      candleSeries.createPriceLine({
        price: p,
        color: "#10b981",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "S",
      }),
    ),
  ];

  const markersApi = createSeriesMarkers(candleSeries, buildSignals(candles));

  return {
    remove: () => {
      for (const s of lineSeries) {
        try { chart.removeSeries(s); } catch { /* noop */ }
      }
      if (bbUpperSeries) { try { chart.removeSeries(bbUpperSeries); } catch {} }
      if (bbLowerSeries) { try { chart.removeSeries(bbLowerSeries); } catch {} }
      for (const pl of priceLines) {
        try { candleSeries.removePriceLine(pl); } catch { /* noop */ }
      }
      try {
        markersApi.setMarkers([]);
        markersApi.detach();
      } catch {
        /* noop */
      }
    },
  };
}

/* ──── Advanced Indicators ──────────────────────────────────────────────── */

/** MACD: returns { macd, signal, hist } arrays aligned to closes. */
export function macd(closes: number[], fast = 12, slow = 26, signal = 9) {
  const eFast = ema(closes, fast);
  const eSlow = ema(closes, slow);
  const macdLine = closes.map((_, i) => (Number.isFinite(eFast[i]) && Number.isFinite(eSlow[i]) ? eFast[i] - eSlow[i] : NaN));
  const signalLine = ema(macdLine.filter((v) => Number.isFinite(v)).length === macdLine.length ? macdLine : macdLine.map((v) => (Number.isFinite(v) ? v : 0)), signal);
  const hist = macdLine.map((v, i) => (Number.isFinite(v) && Number.isFinite(signalLine[i]) ? v - signalLine[i] : NaN));
  return { macd: macdLine, signal: signalLine, hist };
}

/** Bollinger Bands: returns { upper, middle, lower } arrays. */
export function bollinger(closes: number[], period = 20, stdDev = 2) {
  const middle = ema(closes, period);
  const upper: number[] = new Array(closes.length).fill(NaN);
  const lower: number[] = new Array(closes.length).fill(NaN);
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / slice.length;
    const sd = Math.sqrt(variance);
    upper[i] = mean + stdDev * sd;
    lower[i] = mean - stdDev * sd;
  }
  return { upper, middle, lower };
}

/** Stochastic %K and %D. */
export function stochastic(candles: Candle[], kPeriod = 14, dPeriod = 3) {
  const k = new Array(candles.length).fill(NaN);
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const slice = candles.slice(i - kPeriod + 1, i + 1);
    const highest = Math.max(...slice.map((c) => c.high));
    const lowest = Math.min(...slice.map((c) => c.low));
    const range = highest - lowest;
    k[i] = range === 0 ? 50 : ((candles[i].close - lowest) / range) * 100;
  }
  const d = ema(k, dPeriod);
  return { k, d };
}

/** Average True Range. */
export function atr(candles: Candle[], period = 14) {
  const tr = new Array(candles.length).fill(NaN);
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pClose = candles[i - 1].close;
    tr[i] = Math.max(h - l, Math.abs(h - pClose), Math.abs(l - pClose));
  }
  const out = new Array(candles.length).fill(NaN);
  if (candles.length > period) {
    let sum = tr.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
    out[period] = sum;
    for (let i = period + 1; i < candles.length; i++) {
      sum = (sum * (period - 1) + tr[i]) / period;
      out[i] = sum;
    }
  }
  return out;
}

/** Fibonacci retracement levels from a recent swing high/low. */
export function fibonacciLevels(candles: Candle[]) {
  if (candles.length < 20) return { levels: [] as number[], high: NaN, low: NaN };
  const recent = candles.slice(-60);
  const high = Math.max(...recent.map((c) => c.high));
  const low = Math.min(...recent.map((c) => c.low));
  const diff = high - low;
  const ratios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  return { levels: ratios.map((r) => high - diff * r), high, low };
}

/* ──── Auto-Analysis Engine ──────────────────────────────────────────────── */

export type SignalVerdict = "LONG" | "SHORT" | "NEUTRAL";

export interface IndicatorSignal {
  name: string;
  signal: "BUY" | "SELL" | "NEUTRAL";
  confidence: number; // 0-100
  detail: string;
}

export interface AnalysisResult {
  verdict: SignalVerdict;
  confidence: number; // 0-100
  indicators: IndicatorSignal[];
  summary: string;
  entry?: number;
  sl?: number;
  tp?: number;
}

/** Composite auto-analysis of a candle array. Returns a unified signal. */
export function autoAnalyze(candles: Candle[], lastPrice?: number, lang: Lang = "he"): AnalysisResult {
  if (candles.length < 50) {
    return { verdict: "NEUTRAL", confidence: 0, indicators: [], summary: "Not enough data" };
  }
  const closes = candles.map((c) => c.close);
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const indicators: IndicatorSignal[] = [];

  // 1. EMA Trend
  const e9 = ema(closes, 9);
  const e21 = ema(closes, 21);
  const e50 = ema(closes, 50);
  const emaBuy = Number.isFinite(e9.at(-1)) && Number.isFinite(e21.at(-1)) && e9.at(-1)! > e21.at(-1)!;
  const emaSell = Number.isFinite(e9.at(-1)) && Number.isFinite(e21.at(-1)) && e9.at(-1)! < e21.at(-1)!;
  const trendStrong = Number.isFinite(e50.at(-1)) && last.close > e50.at(-1)!;
  indicators.push({
    name: "EMA Trend",
    signal: emaBuy ? "BUY" : emaSell ? "SELL" : "NEUTRAL",
    confidence: trendStrong ? 75 : 50,
    detail: `EMA(9) ${e9.at(-1)?.toFixed(2) ?? "--"} vs EMA(21) ${e21.at(-1)?.toFixed(2) ?? "--"}`,
  });

  // 2. RSI
  const r = rsi(closes, 14);
  const lastR = r.at(-1);
  let rsiSig: IndicatorSignal["signal"] = "NEUTRAL";
  let rsiConf = 50;
  if (Number.isFinite(lastR)) {
    if (lastR! < 30) { rsiSig = "BUY"; rsiConf = 80; }
    else if (lastR! > 70) { rsiSig = "SELL"; rsiConf = 80; }
    else if (lastR! < 45) { rsiSig = "BUY"; rsiConf = 55; }
    else if (lastR! > 55) { rsiSig = "SELL"; rsiConf = 55; }
  }
  indicators.push({
    name: "RSI(14)", signal: rsiSig, confidence: rsiConf,
    detail: `RSI = ${Number.isFinite(lastR) ? lastR!.toFixed(1) : "--"}`,
  });

  // 3. MACD
  const { macd: macdLine, signal: sigLine, hist } = macd(closes, 12, 26, 9);
  const macdBuy = Number.isFinite(hist.at(-1)) && Number.isFinite(hist.at(-2)) && hist.at(-2)! <= 0 && hist.at(-1)! > 0;
  const macdSell = Number.isFinite(hist.at(-1)) && Number.isFinite(hist.at(-2)) && hist.at(-2)! >= 0 && hist.at(-1)! < 0;
  indicators.push({
    name: "MACD",
    signal: macdBuy ? "BUY" : macdSell ? "SELL" : hist.at(-1)! > 0 ? "BUY" : "SELL",
    confidence: macdBuy || macdSell ? 85 : 50,
    detail: `Hist ${hist.at(-1)?.toFixed(3) ?? "--"}`,
  });

  // 4. Bollinger Bands
  const { upper, lower } = bollinger(closes, 20, 2);
  const bbBuy = Number.isFinite(last.close) && Number.isFinite(lower.at(-1)) && last.close < lower.at(-1)!;
  const bbSell = Number.isFinite(last.close) && Number.isFinite(upper.at(-1)) && last.close > upper.at(-1)!;
  indicators.push({
    name: "Bollinger",
    signal: bbBuy ? "BUY" : bbSell ? "SELL" : "NEUTRAL",
    confidence: bbBuy || bbSell ? 70 : 40,
    detail: `Price ${last.close.toFixed(2)} vs bands`,
  });

  // 5. Stochastic
  const { k: sk, d: sd } = stochastic(candles, 14, 3);
  const stochBuy = Number.isFinite(sk.at(-1)) && Number.isFinite(sd.at(-1)) && sk.at(-1)! < 20 && sd.at(-1)! < 20;
  const stochSell = Number.isFinite(sk.at(-1)) && Number.isFinite(sd.at(-1)) && sk.at(-1)! > 80 && sd.at(-1)! > 80;
  indicators.push({
    name: "Stochastic",
    signal: stochBuy ? "BUY" : stochSell ? "SELL" : "NEUTRAL",
    confidence: stochBuy || stochSell ? 75 : 45,
    detail: `%K=${sk.at(-1)?.toFixed(1) ?? "--"} %D=${sd.at(-1)?.toFixed(1) ?? "--"}`,
  });

  // 6. Support / Resistance proximity
  const { support, resistance } = supportResistance(candles);
  const nearSupport = support.length > 0 && Math.abs(last.close - support[0]) / last.close < 0.01;
  const nearResistance = resistance.length > 0 && Math.abs(last.close - resistance[0]) / last.close < 0.01;
  indicators.push({
    name: "S/R Zones",
    signal: nearSupport ? "BUY" : nearResistance ? "SELL" : "NEUTRAL",
    confidence: nearSupport || nearResistance ? 65 : 35,
    detail: nearSupport ? `Near support ${support[0].toFixed(2)}` : nearResistance ? `Near resistance ${resistance[0].toFixed(2)}` : "Mid-range",
  });

  // Composite verdict
  const buyVotes = indicators.filter((i) => i.signal === "BUY").reduce((a, i) => a + i.confidence, 0);
  const sellVotes = indicators.filter((i) => i.signal === "SELL").reduce((a, i) => a + i.confidence, 0);
  const totalWeight = indicators.reduce((a, i) => a + i.confidence, 0);
  const buyPct = totalWeight > 0 ? (buyVotes / totalWeight) * 100 : 0;
  const sellPct = totalWeight > 0 ? (sellVotes / totalWeight) * 100 : 0;

  let verdict: SignalVerdict = "NEUTRAL";
  let confidence = 0;
  if (buyPct > 55 && buyPct > sellPct + 15) { verdict = "LONG"; confidence = Math.round(buyPct); }
  else if (sellPct > 55 && sellPct > buyPct + 15) { verdict = "SHORT"; confidence = Math.round(sellPct); }
  else { confidence = Math.round(Math.max(buyPct, sellPct)); }

  // Entry / SL / TP
  const price = lastPrice ?? last.close;
  const atrVal = atr(candles, 14).at(-1);
  const atrDist = Number.isFinite(atrVal) ? atrVal! * 2.5 : price * 0.03;
  const entry = price;
  const sl = verdict === "LONG" ? entry - atrDist : verdict === "SHORT" ? entry + atrDist : undefined;
  const tp = verdict === "LONG" ? entry + atrDist * 2 : verdict === "SHORT" ? entry - atrDist * 2 : undefined;

  const summary = verdict === "LONG"
    ? t("analysis.summaryLong", lang)
        .replace("{n}", String(indicators.filter((i) => i.signal === "BUY").length))
        .replace("{total}", String(indicators.length))
    : verdict === "SHORT"
      ? t("analysis.summaryShort", lang)
          .replace("{n}", String(indicators.filter((i) => i.signal === "SELL").length))
          .replace("{total}", String(indicators.length))
      : t("analysis.summaryNeutral", lang);

  return { verdict, confidence, indicators, summary, entry, sl, tp };
}
