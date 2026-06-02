import { fetchBinanceData, fetchAllBinanceData, ASSET_SYMBOLS, type BinanceData } from "./binance";
import { fetchPolymarketMarkets, type PolymarketMarket, type AssetFilter } from "./polymarket";

export type SignalType = "overbought_sentiment" | "underpriced_probability" | "neutral";
export type SignalSeverity = "low" | "medium" | "high";
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
export type ActionType = "BUY_YES" | "BUY_NO" | "WATCH";

export interface ArbitrageSignal {
  type: SignalType;
  message: string;
  severity: SignalSeverity;
}

export interface MarketAnalysis {
  market: PolymarketMarket;
  distanceToTargetPercent: number;
  signal: ArbitrageSignal;
  binanceSymbol: string;
  markPrice: number;
}

export interface SignalCounts {
  overbought: number;
  underpriced: number;
  neutral: number;
}

export interface ScanResult {
  binanceAssets: BinanceData[];
  markets: MarketAnalysis[];
  scannedAt: string;
  totalMarkets: number;
  signalCounts: SignalCounts;
}

export interface Recommendation {
  rank: number;
  action: ActionType;
  rationale: string;
  market: PolymarketMarket;
  signal: ArbitrageSignal;
  binanceSymbol: string;
  markPrice: number;
  distanceToTargetPercent: number;
  confidence: ConfidenceLevel;
  /** Probability mispricing in percentage points */
  edge: number;
  /** Return multiplier if position wins (e.g. 8.5 = 8.5×) */
  potentialReturn: number;
  /** Price to pay per contract */
  entryPrice: number;
}

// ── Signal helpers ────────────────────────────────────────────────────────────

/**
 * Estimate a "rational" probability based purely on price distance.
 * This is intentionally simple — just a heuristic reference point.
 */
function rationalProbability(distancePct: number): number {
  if (distancePct < 1) return 60;
  if (distancePct < 2) return 45;
  if (distancePct < 5) return 30;
  if (distancePct < 10) return 18;
  if (distancePct < 20) return 10;
  if (distancePct < 40) return 5;
  return 2;
}

function classifySignal(
  absDistancePct: number,
  yesProbabilityPercent: number,
): ArbitrageSignal {
  const rational = rationalProbability(absDistancePct);

  // Crowd is overconfident — target is far but probability is high
  if (absDistancePct > 10 && yesProbabilityPercent > 30) {
    const severity: SignalSeverity =
      absDistancePct > 25 && yesProbabilityPercent > 50 ? "high"
        : absDistancePct > 15 ? "medium"
        : "low";
    return {
      type: "overbought_sentiment",
      message: `Target is ${absDistancePct.toFixed(1)}% away from current price, but the crowd gives it ${yesProbabilityPercent.toFixed(1)}% probability — significantly above the rational ${rational}%.`,
      severity,
    };
  }

  // Target is close but crowd isn't pricing it
  if (absDistancePct < 2 && yesProbabilityPercent < 10) {
    const severity: SignalSeverity =
      absDistancePct < 0.5 && yesProbabilityPercent < 5 ? "high" : "medium";
    return {
      type: "underpriced_probability",
      message: `Target is only ${absDistancePct.toFixed(1)}% from current price, yet the crowd assigns just ${yesProbabilityPercent.toFixed(1)}% — far below the rational ${rational}%.`,
      severity,
    };
  }

  return {
    type: "neutral",
    message: `Distance ${absDistancePct.toFixed(1)}%, probability ${yesProbabilityPercent.toFixed(1)}% — crowd estimate is close to rational.`,
    severity: "low",
  };
}

function computeEdge(signal: ArbitrageSignal, absDistancePct: number, yesProbabilityPercent: number): number {
  const rational = rationalProbability(absDistancePct);
  if (signal.type === "overbought_sentiment") return Math.max(0, yesProbabilityPercent - rational);
  if (signal.type === "underpriced_probability") return Math.max(0, rational - yesProbabilityPercent);
  return 0;
}

function computeConfidence(signal: ArbitrageSignal, edge: number): ConfidenceLevel {
  if (signal.severity === "high" && edge > 25) return "HIGH";
  if (signal.severity === "high" || (signal.severity === "medium" && edge > 15)) return "HIGH";
  if (signal.severity === "medium" || edge > 10) return "MEDIUM";
  return "LOW";
}

/** Map a market's assetTag to the closest Binance mark price */
function resolveMarkPrice(assetTag: string, binanceAssets: BinanceData[]): BinanceData | undefined {
  const symbol = ASSET_SYMBOLS[assetTag];
  return symbol
    ? binanceAssets.find((b) => b.symbol === symbol)
    : binanceAssets.find((b) => b.symbol === "BTCUSDT");
}

// ── Public scan API ───────────────────────────────────────────────────────────

export async function runScan(opts: { asset?: AssetFilter; search?: string } = {}): Promise<ScanResult> {
  const { asset = "ALL" } = opts;

  const [binanceAssets, polymarkets] = await Promise.all([
    asset === "ALL"
      ? fetchAllBinanceData()
      : fetchBinanceData(ASSET_SYMBOLS[asset] ?? "BTCUSDT").then((d) => [d]),
    fetchPolymarketMarkets({ ...opts, requireTargetPrice: true, filterResolved: true }),
  ]);

  const analyzed: MarketAnalysis[] = [];

  for (const market of polymarkets) {
    const binanceEntry = resolveMarkPrice(market.assetTag, binanceAssets);
    if (!binanceEntry) continue;

    const distanceToTargetPercent = market.targetPrice != null
      ? ((market.targetPrice - binanceEntry.markPrice) / binanceEntry.markPrice) * 100
      : 0;

    const signal = classifySignal(Math.abs(distanceToTargetPercent), market.yesProbabilityPercent);

    analyzed.push({
      market,
      distanceToTargetPercent,
      signal,
      binanceSymbol: binanceEntry.symbol,
      markPrice: binanceEntry.markPrice,
    });
  }

  analyzed.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    const diff = severityOrder[a.signal.severity] - severityOrder[b.signal.severity];
    if (diff !== 0) return diff;
    return Math.abs(a.distanceToTargetPercent) - Math.abs(b.distanceToTargetPercent);
  });

  const signalCounts = analyzed.reduce(
    (acc, m) => {
      if (m.signal.type === "overbought_sentiment") acc.overbought++;
      else if (m.signal.type === "underpriced_probability") acc.underpriced++;
      else acc.neutral++;
      return acc;
    },
    { overbought: 0, underpriced: 0, neutral: 0 },
  );

  return {
    binanceAssets,
    markets: analyzed,
    scannedAt: new Date().toISOString(),
    totalMarkets: analyzed.length,
    signalCounts,
  };
}

export async function buildRecommendations(): Promise<Recommendation[]> {
  const scan = await runScan({ asset: "ALL" });

  const actionable = scan.markets.filter((m) => m.signal.type !== "neutral");

  const recommendations: Recommendation[] = actionable.map((m, i) => {
    const absDistance = Math.abs(m.distanceToTargetPercent);
    const action: ActionType = m.signal.type === "overbought_sentiment" ? "BUY_NO" : "BUY_YES";

    const entryPrice = action === "BUY_YES" ? m.market.yesPrice : m.market.noPrice;
    const potentialReturn = entryPrice > 0 ? parseFloat((1 / entryPrice).toFixed(2)) : 0;
    const edge = computeEdge(m.signal, absDistance, m.market.yesProbabilityPercent);
    const confidence = computeConfidence(m.signal, edge);

    const rationale = m.signal.type === "overbought_sentiment"
      ? `The crowd assigns ${m.market.yesProbabilityPercent.toFixed(1)}% probability to a ${m.market.assetTag} target that is ${absDistance.toFixed(1)}% away. Rational probability at this distance is ~${rationalProbability(absDistance)}%. The crowd is overconfident by ${edge.toFixed(0)} pts — buying NO at $${entryPrice.toFixed(3)} gives a potential ${potentialReturn.toFixed(1)}× return.`
      : `${m.market.assetTag} is only ${absDistance.toFixed(1)}% away from the target price, but the crowd prices it at just ${m.market.yesProbabilityPercent.toFixed(1)}%. Rational probability is ~${rationalProbability(absDistance)}% — the crowd is underestimating by ${edge.toFixed(0)} pts. Buying YES at $${entryPrice.toFixed(3)} gives a potential ${potentialReturn.toFixed(1)}× return.`;

    return {
      rank: i + 1,
      action,
      rationale,
      market: m.market,
      signal: m.signal,
      binanceSymbol: m.binanceSymbol,
      markPrice: m.markPrice,
      distanceToTargetPercent: m.distanceToTargetPercent,
      confidence,
      edge,
      potentialReturn,
      entryPrice,
    };
  });

  // Sort: HIGH confidence first, then by edge (larger edge = better opportunity)
  const confidenceOrder: Record<ConfidenceLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  recommendations.sort((a, b) => {
    const confDiff = confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
    if (confDiff !== 0) return confDiff;
    return b.edge - a.edge;
  });

  recommendations.forEach((r, i) => { r.rank = i + 1; });

  return recommendations.slice(0, 20);
}
