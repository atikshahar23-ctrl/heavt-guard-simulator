import { logger } from "./logger";
import { fetchBinanceData, ASSET_SYMBOLS } from "./binance";
import {
  fetchHyperliquidFunding,
  fetchHyperliquidAsset,
  fetchHyperliquidFundingHistory,
  type FundingRatePoint,
  type HlFundingLive,
} from "./hyperliquid";

/**
 * Funding (cash-and-carry) arbitrage engine — paper / educational only.
 *
 * The "carry" trade is delta-neutral: hold the underlying (spot/base leg) and
 * take the OPPOSITE side on the perpetual future so price moves cancel out, and
 * you simply collect (or pay) the perp funding. When funding is positive, perp
 * longs pay shorts, so the collecting structure is: LONG base + SHORT perp.
 * When funding is negative it inverts.
 *
 * Nothing here promises a return — funding rates flip, and the analysis is
 * framed as scenarios for learning, not advice.
 */

export type FundingVenue = "BINANCE" | "HYPERLIQUID";
/** Perp leg you would take to COLLECT the funding premium. */
export type FundingSide = "SHORT_PERP" | "LONG_PERP";
export type FundingViability = "STRONG" | "MODERATE" | "WEAK" | "AVOID";

/** Binance funds every 8h → 3 * 365 periods per year. */
const BINANCE_PERIODS_PER_YEAR = 3 * 365;

export interface FundingOpportunity {
  rank: number;
  asset: string;
  spotPrice: number;
  /** Binance per-8h funding (percent); null when unavailable (geo-block). */
  binanceFundingPercent: number | null;
  binanceAnnualizedPercent: number | null;
  /** Hyperliquid per-1h funding (percent); null when the asset isn't listed. */
  hyperliquidFundingPercent: number | null;
  hyperliquidAnnualizedPercent: number | null;
  /** Venue offering the larger absolute annualized funding (the perp leg). */
  bestVenue: FundingVenue;
  /** Absolute annualized funding on the best venue (percent). */
  annualizedPercent: number;
  /** Perp leg to take to collect the premium. */
  side: FundingSide;
  viabilityScore: number;
  viability: FundingViability;
  analysisHe: string;
  analysisEn: string;
  fetchedAt: string;
}

export interface FundingAssetCheck {
  asset: string;
  found: boolean;
  spotPrice: number;
  binanceFundingPercent: number | null;
  binanceAnnualizedPercent: number | null;
  hyperliquidFundingPercent: number | null;
  hyperliquidAnnualizedPercent: number | null;
  bestVenue: FundingVenue;
  annualizedPercent: number;
  side: FundingSide;
  viabilityScore: number;
  viability: FundingViability;
  analysisHe: string;
  analysisEn: string;
  /** Recent hourly Hyperliquid funding history for charting. */
  history: FundingRatePoint[];
  fetchedAt: string;
}

export interface FundingBacktest {
  asset: string;
  venue: FundingVenue;
  hours: number;
  /** Number of funding events observed in the window. */
  intervals: number;
  /** Assumed notional used to express accrued funding in USD. */
  notional: number;
  /** Total funding accrued (USD) collecting the premium over the window. */
  accruedFundingUsd: number;
  /** Total accrued funding as a percent of notional. */
  accruedFundingPercent: number;
  /** Extrapolated annualized percent based on the observed window. */
  annualizedPercent: number;
  positiveIntervals: number;
  negativeIntervals: number;
  /** Worst single interval as a percent (most adverse funding flip). */
  worstIntervalPercent: number;
  /** Largest cumulative giveback (percent) while collecting — a "drawdown". */
  maxAdversePercent: number;
  verdict: FundingViability;
  analysisHe: string;
  analysisEn: string;
  series: FundingRatePoint[];
  fetchedAt: string;
}

/* ── Scoring & analysis ─────────────────────────────────────────── */

function scoreViability(absAnnualized: number): { score: number; viability: FundingViability } {
  // Annualized carry magnitude maps to a 0-100 viability score. These bands are
  // intentionally conservative — funding is a thin, regime-dependent edge.
  const score = Math.max(0, Math.min(100, Math.round((absAnnualized / 40) * 100)));
  let viability: FundingViability;
  if (absAnnualized >= 25) viability = "STRONG";
  else if (absAnnualized >= 10) viability = "MODERATE";
  else if (absAnnualized >= 3) viability = "WEAK";
  else viability = "AVOID";
  return { score, viability };
}

function buildAnalysis(
  asset: string,
  side: FundingSide,
  venue: FundingVenue,
  annualizedPercent: number,
  viability: FundingViability,
): { he: string; en: string } {
  const venueName = venue === "BINANCE" ? "Binance" : "Hyperliquid";
  const annAbs = Math.abs(annualizedPercent).toFixed(1);
  const longLeg = side === "SHORT_PERP" ? "spot/base" : "perp";

  const enByViability: Record<FundingViability, string> = {
    STRONG: `Funding on ${venueName} is unusually rich (~${annAbs}%/yr annualized). A delta-neutral carry — LONG ${side === "SHORT_PERP" ? "the base asset" : "the perp"} and ${side === "SHORT_PERP" ? "SHORT the perp" : "SHORT the base"} — would currently collect the premium. Remember: funding can normalize or flip within hours, so this is a scenario, not a forecast.`,
    MODERATE: `${venueName} funding offers a moderate carry (~${annAbs}%/yr). The delta-neutral structure could collect it, but fees, slippage and a funding flip can erode a mid-sized edge quickly. Treat it as a learning scenario.`,
    WEAK: `${venueName} funding is thin (~${annAbs}%/yr). After costs there's little durable edge here — useful mainly to study how the carry behaves, not as an opportunity.`,
    AVOID: `${venueName} funding is near flat (~${annAbs}%/yr). There is no meaningful carry to collect right now; the legs would mostly just pay fees.`,
  };

  const heByViability: Record<FundingViability, string> = {
    STRONG: `המימון על ${venueName} גבוה במיוחד (כ-${annAbs}% שנתי). עסקת קארי דלתא-נייטרלית — לונג על ${side === "SHORT_PERP" ? "הנכס" : "הפרפ"} ושורט על ${side === "SHORT_PERP" ? "הפרפ" : "הנכס"} — הייתה גובה כעת את הפרמיה. שימו לב: המימון יכול להתאזן או להתהפך תוך שעות, אז זה תרחיש ללימוד ולא תחזית.`,
    MODERATE: `המימון על ${venueName} מציע קארי בינוני (כ-${annAbs}% שנתי). המבנה הדלתא-נייטרלי יכול לגבות אותו, אך עמלות, החלקה והיפוך מימון עלולים לשחוק יתרון בינוני במהירות. התייחסו לזה כתרחיש לימודי.`,
    WEAK: `המימון על ${venueName} דק (כ-${annAbs}% שנתי). אחרי עלויות אין כאן יתרון של ממש — שימושי בעיקר כדי ללמוד איך הקארי מתנהג, לא כהזדמנות.`,
    AVOID: `המימון על ${venueName} כמעט אפסי (כ-${annAbs}% שנתי). אין כרגע קארי משמעותי לגבייה; הרגליים בעיקר ישלמו עמלות.`,
  };

  // longLeg referenced to keep the educational framing explicit without leaking
  // it into the copy above when not needed.
  void longLeg;
  void asset;
  return { he: heByViability[viability], en: enByViability[viability] };
}

/* ── Opportunity ranking ────────────────────────────────────────── */

interface AssetSnapshot {
  asset: string;
  spotPrice: number;
  binancePercent: number | null;
  hyperliquidPercent: number | null;
}

function buildOpportunityFrom(snap: AssetSnapshot): Omit<FundingOpportunity, "rank"> {
  const binanceAnnualized =
    snap.binancePercent != null ? snap.binancePercent * BINANCE_PERIODS_PER_YEAR : null;
  // Hyperliquid live already supplies annualized, but recompute from the percent
  // for a single consistent path.
  const hlAnnualized =
    snap.hyperliquidPercent != null ? snap.hyperliquidPercent * (24 * 365) : null;

  // Pick the venue with the larger absolute annualized carry as the perp leg.
  const candidates: { venue: FundingVenue; annualized: number }[] = [];
  if (binanceAnnualized != null) candidates.push({ venue: "BINANCE", annualized: binanceAnnualized });
  if (hlAnnualized != null) candidates.push({ venue: "HYPERLIQUID", annualized: hlAnnualized });

  const best = candidates.sort((a, b) => Math.abs(b.annualized) - Math.abs(a.annualized))[0] ?? {
    venue: "HYPERLIQUID" as FundingVenue,
    annualized: 0,
  };

  // Positive funding → perp longs pay shorts → collect by SHORTING the perp.
  const side: FundingSide = best.annualized >= 0 ? "SHORT_PERP" : "LONG_PERP";
  const absAnn = Math.abs(best.annualized);
  const { score, viability } = scoreViability(absAnn);
  const analysis = buildAnalysis(snap.asset, side, best.venue, best.annualized, viability);

  return {
    asset: snap.asset,
    spotPrice: snap.spotPrice,
    binanceFundingPercent: snap.binancePercent,
    binanceAnnualizedPercent: binanceAnnualized,
    hyperliquidFundingPercent: snap.hyperliquidPercent,
    hyperliquidAnnualizedPercent: hlAnnualized,
    bestVenue: best.venue,
    annualizedPercent: absAnn,
    side,
    viabilityScore: score,
    viability,
    analysisHe: analysis.he,
    analysisEn: analysis.en,
    fetchedAt: new Date().toISOString(),
  };
}

let _oppCache: { data: FundingOpportunity[]; expiresAt: number } | null = null;
let _oppInflight: Promise<FundingOpportunity[]> | null = null;
const OPP_TTL_MS = 60 * 1000;
const CONCURRENCY = 6;

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
 * Ranked cash-and-carry opportunities across the major-coin universe, combining
 * Binance (8h) and Hyperliquid (1h) funding. Sorted by viability score. Cached
 * 60s with in-flight coalescing.
 */
export async function buildFundingOpportunities(): Promise<FundingOpportunity[]> {
  const now = Date.now();
  if (_oppCache && now < _oppCache.expiresAt) return _oppCache.data;
  if (_oppInflight) return _oppInflight;

  const promise = (async () => {
    // Hyperliquid live funding for all perps (one POST) keyed by asset.
    let hlByAsset = new Map<string, HlFundingLive>();
    try {
      const hl = await fetchHyperliquidFunding();
      hlByAsset = new Map(hl.map((h) => [h.asset, h]));
    } catch (err) {
      logger.warn({ err: String(err) }, "Hyperliquid live funding unavailable for opportunities");
    }

    const assets = Object.keys(ASSET_SYMBOLS);
    const snaps = await mapLimit(assets, CONCURRENCY, async (asset): Promise<AssetSnapshot | null> => {
      try {
        const bn = await fetchBinanceData(ASSET_SYMBOLS[asset]);
        const hl = hlByAsset.get(asset);
        // fundingRate === 0 from Binance means the spot fallback kicked in (no
        // futures funding available in this region) → report as null, not 0.
        const binancePercent = bn.fundingRate !== 0 ? bn.fundingRatePercent : null;
        const spotPrice = bn.markPrice || hl?.markPrice || 0;
        if (!(spotPrice > 0)) return null;
        return {
          asset,
          spotPrice,
          binancePercent,
          hyperliquidPercent: hl ? hl.fundingRatePercent : null,
        };
      } catch (err) {
        logger.warn({ err: String(err), asset }, "Funding snapshot failed");
        return null;
      }
    });

    const opps = snaps
      .filter((s): s is AssetSnapshot => s !== null)
      .filter((s) => s.binancePercent != null || s.hyperliquidPercent != null)
      .map(buildOpportunityFrom)
      .sort((a, b) => b.viabilityScore - a.viabilityScore)
      .map((o, i) => ({ rank: i + 1, ...o }));

    if (opps.length === 0) throw new Error("No funding opportunities available");
    _oppCache = { data: opps, expiresAt: Date.now() + OPP_TTL_MS };
    return opps;
  })();

  _oppInflight = promise;
  promise.finally(() => {
    if (_oppInflight === promise) _oppInflight = null;
  });
  return promise;
}

/* ── Single-asset check ─────────────────────────────────────────── */

export async function checkFundingAsset(asset: string): Promise<FundingAssetCheck> {
  const sym = asset.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,20}$/.test(sym)) throw new Error("Invalid asset");

  const binanceSymbol = ASSET_SYMBOLS[sym] ?? `${sym}USDT`;
  const [bnRes, hl, history] = await Promise.allSettled([
    fetchBinanceData(binanceSymbol),
    fetchHyperliquidAsset(sym),
    fetchHyperliquidFundingHistory(sym, 24 * 7),
  ]);

  const bn = bnRes.status === "fulfilled" ? bnRes.value : null;
  const hlLive = hl.status === "fulfilled" ? hl.value : null;
  const hist = history.status === "fulfilled" ? history.value : [];

  const binancePercent = bn && bn.fundingRate !== 0 ? bn.fundingRatePercent : null;
  const spotPrice = bn?.markPrice || hlLive?.markPrice || 0;
  const found = binancePercent != null || hlLive != null;

  const snap: AssetSnapshot = {
    asset: sym,
    spotPrice,
    binancePercent,
    hyperliquidPercent: hlLive ? hlLive.fundingRatePercent : null,
  };
  const opp = buildOpportunityFrom(snap);

  return {
    asset: sym,
    found,
    spotPrice,
    binanceFundingPercent: opp.binanceFundingPercent,
    binanceAnnualizedPercent: opp.binanceAnnualizedPercent,
    hyperliquidFundingPercent: opp.hyperliquidFundingPercent,
    hyperliquidAnnualizedPercent: opp.hyperliquidAnnualizedPercent,
    bestVenue: opp.bestVenue,
    annualizedPercent: opp.annualizedPercent,
    side: opp.side,
    viabilityScore: opp.viabilityScore,
    viability: opp.viability,
    analysisHe: opp.analysisHe,
    analysisEn: opp.analysisEn,
    history: hist,
    fetchedAt: new Date().toISOString(),
  };
}

/* ── Backtest (over recent funding history) ─────────────────────── */

export async function backtestFundingAsset(asset: string, hours = 24 * 7): Promise<FundingBacktest> {
  const sym = asset.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,20}$/.test(sym)) throw new Error("Invalid asset");
  const series = await fetchHyperliquidFundingHistory(sym, hours);
  const notional = 1000;

  if (series.length === 0) {
    throw new Error(`No funding history for ${sym}`);
  }

  // Collecting the premium means earning +funding when positive, paying when it
  // flips. Sum the absolute-direction-consistent carry: we model collecting the
  // dominant side, so accrual = sign(mean) * each interval.
  const meanPercent = series.reduce((a, p) => a + p.fundingRatePercent, 0) / series.length;
  const dir = meanPercent >= 0 ? 1 : -1;

  let accruedPercent = 0;
  let positiveIntervals = 0;
  let negativeIntervals = 0;
  let worstIntervalPercent = 0;
  let cumulative = 0;
  let peak = 0;
  let maxAdversePercent = 0;

  for (const p of series) {
    const collected = dir * p.fundingRatePercent; // + when funding aligns with our side
    accruedPercent += collected;
    if (collected >= 0) positiveIntervals++;
    else negativeIntervals++;
    if (collected < worstIntervalPercent) worstIntervalPercent = collected;
    cumulative += collected;
    if (cumulative > peak) peak = cumulative;
    const giveback = peak - cumulative;
    if (giveback > maxAdversePercent) maxAdversePercent = giveback;
  }

  const accruedFundingUsd = (accruedPercent / 100) * notional;
  const intervals = series.length;
  // Each Hyperliquid interval is ~1h → annualize from the observed window.
  const annualizedPercent = intervals > 0 ? (accruedPercent / intervals) * (24 * 365) : 0;

  const { viability } = scoreViability(Math.abs(annualizedPercent));
  let verdict: FundingViability = viability;
  // Penalize choppy histories where the funding flipped often.
  const flipRatio = intervals > 0 ? negativeIntervals / intervals : 1;
  if (flipRatio > 0.4 && verdict === "STRONG") verdict = "MODERATE";
  if (flipRatio > 0.45 && verdict === "MODERATE") verdict = "WEAK";

  const annAbs = Math.abs(annualizedPercent).toFixed(1);
  const days = (hours / 24).toFixed(0);
  const sideLabel = dir >= 0 ? "SHORT the perp + LONG spot" : "LONG the perp + SHORT spot";
  const sideLabelHe = dir >= 0 ? "שורט על הפרפ + לונג על הספוט" : "לונג על הפרפ + שורט על הספוט";

  const analysisEn =
    `Over the last ~${days}d (${intervals} hourly funding points), a delta-neutral carry (${sideLabel}) would have accrued ~${accruedPercent.toFixed(3)}% on notional (~$${accruedFundingUsd.toFixed(2)} per $${notional}), ≈${annAbs}%/yr. Funding stayed favorable ${positiveIntervals}/${intervals} intervals; worst flip ${worstIntervalPercent.toFixed(4)}%, max giveback ${maxAdversePercent.toFixed(3)}%. Past funding never guarantees future carry — this is an educational backtest.`;
  const analysisHe =
    `על פני ~${days} ימים (${intervals} נקודות מימון שעתיות), עסקת קארי דלתא-נייטרלית (${sideLabelHe}) הייתה צוברת כ-${accruedPercent.toFixed(3)}% על הנוטיונל (כ-$${accruedFundingUsd.toFixed(2)} לכל $${notional}), ≈${annAbs}% שנתי. המימון נשאר לטובתנו ב-${positiveIntervals} מתוך ${intervals} מרווחים; ההיפוך הגרוע ${worstIntervalPercent.toFixed(4)}%, נסיגה מרבית ${maxAdversePercent.toFixed(3)}%. עבר אינו מבטיח עתיד — זהו בקטסט לימודי בלבד.`;

  return {
    asset: sym,
    venue: "HYPERLIQUID",
    hours: Math.max(1, Math.min(24 * 30, Math.floor(hours))),
    intervals,
    notional,
    accruedFundingUsd,
    accruedFundingPercent: accruedPercent,
    annualizedPercent,
    positiveIntervals,
    negativeIntervals,
    worstIntervalPercent,
    maxAdversePercent,
    verdict,
    analysisHe,
    analysisEn,
    series,
    fetchedAt: new Date().toISOString(),
  };
}
