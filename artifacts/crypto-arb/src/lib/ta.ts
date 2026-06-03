import {
  LineSeries,
  LineStyle,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";

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
        try {
          chart.removeSeries(s);
        } catch {
          /* chart may already be disposed */
        }
      }
      for (const pl of priceLines) {
        try {
          candleSeries.removePriceLine(pl);
        } catch {
          /* noop */
        }
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
