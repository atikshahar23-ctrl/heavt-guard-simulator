import { fetchBinanceData, type BinanceData } from "./binance";
import { fetchBtcPolymarketMarkets, type PolymarketMarket } from "./polymarket";

export type SignalType = "overbought_sentiment" | "underpriced_probability" | "neutral";
export type SignalSeverity = "low" | "medium" | "high";

export interface ArbitrageSignal {
  type: SignalType;
  message: string;
  severity: SignalSeverity;
}

export interface MarketAnalysis {
  market: PolymarketMarket;
  distanceToTargetPercent: number;
  signal: ArbitrageSignal;
}

export interface SignalCounts {
  overbought: number;
  underpriced: number;
  neutral: number;
}

export interface ScanResult {
  binance: BinanceData;
  markets: MarketAnalysis[];
  scannedAt: string;
  totalMarkets: number;
  signalCounts: SignalCounts;
}

function classifySignal(
  distanceToTargetPercent: number,
  yesProbabilityPercent: number,
): ArbitrageSignal {
  // Target is far but crowd gives high probability → overbought sentiment
  if (distanceToTargetPercent > 10 && yesProbabilityPercent > 30) {
    const severity: SignalSeverity =
      distanceToTargetPercent > 25 && yesProbabilityPercent > 50
        ? "high"
        : distanceToTargetPercent > 15
          ? "medium"
          : "low";
    return {
      type: "overbought_sentiment",
      message: `Target is ${distanceToTargetPercent.toFixed(1)}% away but crowd assigns ${yesProbabilityPercent.toFixed(1)}% probability — crowd may be overconfident.`,
      severity,
    };
  }

  // Target is close but crowd gives very low probability → underpriced
  if (distanceToTargetPercent < 2 && yesProbabilityPercent < 10) {
    const severity: SignalSeverity =
      distanceToTargetPercent < 0.5 && yesProbabilityPercent < 5 ? "high" : "medium";
    return {
      type: "underpriced_probability",
      message: `Target is only ${distanceToTargetPercent.toFixed(1)}% away but crowd only assigns ${yesProbabilityPercent.toFixed(1)}% probability — market may be underpriced.`,
      severity,
    };
  }

  return {
    type: "neutral",
    message: `Distance ${distanceToTargetPercent.toFixed(1)}%, probability ${yesProbabilityPercent.toFixed(1)}% — no clear mispricing detected.`,
    severity: "low",
  };
}

export async function runScan(): Promise<ScanResult> {
  const [binance, markets] = await Promise.all([
    fetchBinanceData("BTCUSDT"),
    fetchBtcPolymarketMarkets(),
  ]);

  const analyzed: MarketAnalysis[] = markets.map((market) => {
    const distanceToTargetPercent = market.targetPrice != null
      ? ((market.targetPrice - binance.markPrice) / binance.markPrice) * 100
      : 0;

    const signal = classifySignal(
      Math.abs(distanceToTargetPercent),
      market.yesProbabilityPercent,
    );

    return { market, distanceToTargetPercent, signal };
  });

  // Sort: high signals first, then by absolute distance
  analyzed.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    const aSev = severityOrder[a.signal.severity];
    const bSev = severityOrder[b.signal.severity];
    if (aSev !== bSev) return aSev - bSev;
    return Math.abs(a.distanceToTargetPercent) - Math.abs(b.distanceToTargetPercent);
  });

  const signalCounts: SignalCounts = analyzed.reduce(
    (acc, m) => {
      if (m.signal.type === "overbought_sentiment") acc.overbought++;
      else if (m.signal.type === "underpriced_probability") acc.underpriced++;
      else acc.neutral++;
      return acc;
    },
    { overbought: 0, underpriced: 0, neutral: 0 },
  );

  return {
    binance,
    markets: analyzed,
    scannedAt: new Date().toISOString(),
    totalMarkets: analyzed.length,
    signalCounts,
  };
}
