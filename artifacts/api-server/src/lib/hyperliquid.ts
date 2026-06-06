import { logger } from "./logger";

/**
 * Keyless Hyperliquid public info API client.
 *
 * Hyperliquid charges funding HOURLY (unlike Binance's 8h cadence), and its
 * public `info` endpoint is a single POST with no API key and is not
 * geo-blocked, which makes it an ideal free funding-rate source.
 *
 * Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint
 */
const HL_INFO_API = "https://api.hyperliquid.xyz/info";

/** Hyperliquid funds hourly → 24 * 365 periods per year. */
export const HL_PERIODS_PER_YEAR = 24 * 365;

export interface HlFundingLive {
  asset: string;
  /** Hourly funding rate as a decimal (e.g. 0.0000125). */
  fundingRate: number;
  /** Hourly funding rate as a percent. */
  fundingRatePercent: number;
  /** Annualized funding (hourly rate compounded simply over a year), percent. */
  annualizedPercent: number;
  markPrice: number;
  openInterest: number;
}

export interface FundingRatePoint {
  /** Epoch seconds of the funding event. */
  time: number;
  /** Per-interval funding rate as a percent. */
  fundingRatePercent: number;
  /** Annualized funding rate as a percent. */
  annualizedPercent: number;
  venue: "HYPERLIQUID" | "BINANCE";
}

async function postInfo<T>(body: Record<string, unknown>, timeoutMs = 9_000): Promise<T> {
  const res = await fetch(HL_INFO_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Hyperliquid info ${res.status}`);
  return (await res.json()) as T;
}

/* ── Live funding across all perps ──────────────────────────────── */

interface HlUniverseItem {
  name: string;
}
interface HlAssetCtx {
  funding?: string;
  openInterest?: string;
  markPx?: string;
}
type HlMetaAndCtxs = [{ universe: HlUniverseItem[] }, HlAssetCtx[]];

let _liveCache: { data: HlFundingLive[]; expiresAt: number } | null = null;
let _liveInflight: Promise<HlFundingLive[]> | null = null;
const LIVE_TTL_MS = 3 * 60 * 1000;

/**
 * Live funding rate + mark price for every Hyperliquid perp. Cached for 3
 * minutes with in-flight coalescing so concurrent callers share one POST.
 */
export async function fetchHyperliquidFunding(): Promise<HlFundingLive[]> {
  const now = Date.now();
  if (_liveCache && now < _liveCache.expiresAt) return _liveCache.data;
  if (_liveInflight) return _liveInflight;

  const promise = (async () => {
    const [meta, ctxs] = await postInfo<HlMetaAndCtxs>({ type: "metaAndAssetCtxs" });
    const universe = meta?.universe ?? [];
    const out: HlFundingLive[] = [];

    for (let i = 0; i < universe.length; i++) {
      const name = universe[i]?.name;
      const ctx = ctxs?.[i];
      if (!name || !ctx) continue;
      const fundingRate = parseFloat(ctx.funding ?? "");
      const markPrice = parseFloat(ctx.markPx ?? "");
      if (!Number.isFinite(fundingRate)) continue;
      out.push({
        asset: name.toUpperCase(),
        fundingRate,
        fundingRatePercent: fundingRate * 100,
        annualizedPercent: fundingRate * HL_PERIODS_PER_YEAR * 100,
        markPrice: Number.isFinite(markPrice) ? markPrice : 0,
        openInterest: parseFloat(ctx.openInterest ?? "0") || 0,
      });
    }

    if (out.length === 0) throw new Error("Hyperliquid returned no funding data");
    _liveCache = { data: out, expiresAt: Date.now() + LIVE_TTL_MS };
    return out;
  })();

  _liveInflight = promise;
  promise.finally(() => {
    if (_liveInflight === promise) _liveInflight = null;
  });
  return promise;
}

/** Find one asset's live Hyperliquid funding (case-insensitive). */
export async function fetchHyperliquidAsset(asset: string): Promise<HlFundingLive | null> {
  const sym = asset.trim().toUpperCase();
  if (!sym) return null;
  try {
    const all = await fetchHyperliquidFunding();
    return all.find((a) => a.asset === sym) ?? null;
  } catch (err) {
    logger.warn({ err: String(err), asset: sym }, "Hyperliquid asset lookup failed");
    return null;
  }
}

/* ── Historical funding series ──────────────────────────────────── */

interface HlFundingHistoryItem {
  coin?: string;
  fundingRate?: string;
  time?: number;
}

const _histCache = new Map<string, { data: FundingRatePoint[]; expiresAt: number }>();
const HIST_TTL_MS = 5 * 60 * 1000;

/**
 * Hourly funding history for one asset over the last `hours` (default 7 days).
 * Returns oldest→newest points with per-interval and annualized percents.
 */
export async function fetchHyperliquidFundingHistory(
  asset: string,
  hours = 24 * 7,
): Promise<FundingRatePoint[]> {
  const sym = asset.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,20}$/.test(sym)) throw new Error("Invalid asset");
  const clampedHours = Math.max(1, Math.min(24 * 30, Math.floor(hours)));
  const cacheKey = `${sym}|${clampedHours}`;
  const now = Date.now();
  const cached = _histCache.get(cacheKey);
  if (cached && now < cached.expiresAt) return cached.data;

  const startTime = now - clampedHours * 60 * 60 * 1000;
  const raw = await postInfo<HlFundingHistoryItem[]>({
    type: "fundingHistory",
    coin: sym,
    startTime,
  });

  const out: FundingRatePoint[] = [];
  for (const item of raw ?? []) {
    const rate = parseFloat(item.fundingRate ?? "");
    const t = item.time;
    if (!Number.isFinite(rate) || typeof t !== "number") continue;
    out.push({
      time: Math.floor(t / 1000),
      fundingRatePercent: rate * 100,
      annualizedPercent: rate * HL_PERIODS_PER_YEAR * 100,
      venue: "HYPERLIQUID",
    });
  }
  out.sort((a, b) => a.time - b.time);
  _histCache.set(cacheKey, { data: out, expiresAt: now + HIST_TTL_MS });
  return out;
}
