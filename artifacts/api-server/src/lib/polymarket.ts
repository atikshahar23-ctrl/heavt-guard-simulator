import { logger } from "./logger";

export interface PolymarketMarket {
  conditionId: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  yesProbabilityPercent: number;
  targetPrice: number | null;
  active: boolean;
  endDate: string | null;
  volume: number | null;
  volume24hr: number | null;
  assetTag: string;
  category: string;
  slug: string | null;
  eventSlug: string | null;
  oneDayPriceChange: number | null;
  liquidity: number | null;
  spread: number | null;
  competitive: number | null;
}

// Gamma API — what Polymarket's own frontend uses; returns only open/active markets
const GAMMA_API = "https://gamma-api.polymarket.com/markets";

export type AssetFilter = "BTC" | "ETH" | "SOL" | "BNB" | "ALL";
export type CategoryFilter = "ALL" | "CRYPTO" | "POLITICS" | "SPORTS" | "ECONOMY" | "TECH" | "OTHER";

const ASSET_PATTERNS: Record<AssetFilter, RegExp> = {
  BTC: /bitcoin|\bbtc\b/i,
  ETH: /ethereum|\beth\b/i,
  SOL: /solana|\bsol\b/i,
  BNB: /\bbnb\b|binance coin/i,
  ALL: /bitcoin|\bbtc\b|ethereum|\beth\b|solana|\bsol\b|\bbnb\b|binance coin/i,
};

function detectAssetTag(question: string): string {
  if (/bitcoin|\bbtc\b/i.test(question)) return "BTC";
  if (/ethereum|\beth\b/i.test(question)) return "ETH";
  if (/solana|\bsol\b/i.test(question)) return "SOL";
  if (/\bbnb\b|binance coin/i.test(question)) return "BNB";
  return "CRYPTO";
}

export function detectCategory(question: string, _tags?: string[]): CategoryFilter {
  const q = question.toLowerCase();
  if (/bitcoin|\bbtc\b|ethereum|\beth\b|solana|\bsol\b|\bbnb\b|binance|crypto|defi|\bnft\b|blockchain|altcoin|token|\bxrp\b|\bdoge\b|\bshib\b|\bada\b|\bavax\b|\blink\b|\bmatic\b|\bdot\b/i.test(question)) return "CRYPTO";
  if (/president|election|senator|congress|parliament|minister|prime minister|governor|mayor|vote|ballot|democrat|republican|trump|biden|kamala|harris|macron|modi|zelensky|putin|sunak|scholz|war|ceasefire|nato|ukraine|gaza|israel|geopolit|sanction|treaty|referendum|impeach/i.test(question)) return "POLITICS";
  if (/\bnfl\b|\bnba\b|\bnhl\b|\bmlb\b|\bncaa\b|\bnascar\b|soccer|football|basketball|baseball|hockey|tennis|golf|mma|ufc|boxing|olympics|world cup|champion|superbowl|super bowl|formula one|\bf1\b|formula 1|wimbledon|grand slam|serie a|premier league|la liga|bundesliga|champions league|mlbb|esport|valorant|cs2|dota|league of legends/i.test(question)) return "SPORTS";
  if (/\bgdp\b|inflation|federal reserve|\bfed\b|interest rate|recession|unemployment|\bcpi\b|\bpce\b|fiscal|monetary|treasury|bond yield|debt ceiling|ipo|merger|acquisition|earnings|\bsec\b|nasdaq|s&p|dow jones|\bfdi\b/i.test(question)) return "ECONOMY";
  if (/artificial intelligence|\bai\b|chatgpt|openai|google|apple|microsoft|meta|tesla|amazon|nvidia|spacex|starlink|elon musk|sam altman|gpt-|llm|regulation|antitrust|big tech|social media/i.test(question)) return "TECH";
  return "OTHER";
}

export function extractTargetPrice(question: string): number | null {
  const match = /\$(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?[kK])/.exec(question);
  if (!match) return null;
  const raw = match[1].replace(/,/g, "").toLowerCase();
  if (raw.endsWith("k")) return parseFloat(raw.slice(0, -1)) * 1000;
  return parseFloat(raw);
}

export interface FetchPolymarketOptions {
  asset?: AssetFilter;
  category?: CategoryFilter;
  search?: string;
  requireTargetPrice?: boolean;
  filterResolved?: boolean;
  allCategories?: boolean;
  /** Only return markets whose endDate is within this many hours from now. */
  maxHoursToEnd?: number;
}

// ── In-memory page cache (TTL: 3 min) ────────────────────────────────────────
let _cachedPages: Record<string, unknown>[] | null = null;
let _cacheExpiresAt = 0;
const CACHE_TTL_MS = 3 * 60 * 1000;

export function invalidatePolymarketCache(): void {
  _cachedPages = null;
  _cacheExpiresAt = 0;
}

/**
 * Fetch active open markets from Polymarket Gamma API.
 * Returns markets sorted by volume (most liquid first).
 * Filters: active=true, closed=false — only genuinely open markets.
 */
async function fetchAllPages(): Promise<Record<string, unknown>[]> {
  const now = Date.now();
  if (_cachedPages && now < _cacheExpiresAt) {
    logger.debug({ cached: true, total: _cachedPages.length }, "Polymarket cache hit");
    return _cachedPages;
  }

  // Gamma API caps at 100 per request — fetch 20 pages in parallel for 2000 markets
  const PAGE_SIZE = 100;
  const TOTAL_PAGES = 20;
  const fetchStart = Date.now();

  const buildUrl = (offset: number) => {
    const url = new URL(GAMMA_API);
    url.searchParams.set("active", "true");
    url.searchParams.set("closed", "false");
    url.searchParams.set("order", "volume");
    url.searchParams.set("ascending", "false");
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("offset", String(offset));
    return url.toString();
  };

  const pageResults = await Promise.all(
    Array.from({ length: TOTAL_PAGES }, (_, i) =>
      fetch(buildUrl(i * PAGE_SIZE))
        .then(r => {
          if (!r.ok) throw new Error(`Gamma API page ${i} returned ${r.status}`);
          return r.json() as Promise<Record<string, unknown>[]>;
        })
        .catch(err => {
          logger.warn({ page: i, err: String(err) }, "Polymarket Gamma page failed, skipping");
          return [] as Record<string, unknown>[];
        })
    )
  );

  const all = pageResults.flat().filter(m => m && typeof m["question"] === "string");

  // Deduplicate by conditionId
  const seen = new Set<string>();
  const deduped = all.filter(m => {
    const id = (m["conditionId"] as string) ?? (m["id"] as string) ?? "";
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const elapsed = Date.now() - fetchStart;
  logger.info({ total: deduped.length, ms: elapsed }, "Polymarket Gamma pages fetched (cold)");

  _cachedPages = deduped;
  _cacheExpiresAt = now + CACHE_TTL_MS;
  return deduped;
}

export async function fetchPolymarketMarkets(opts: FetchPolymarketOptions = {}): Promise<PolymarketMarket[]> {
  const {
    asset = "ALL",
    category,
    search,
    requireTargetPrice = false,
    filterResolved = false,
    allCategories = false,
    maxHoursToEnd,
  } = opts;

  const assetPattern = allCategories ? null : ASSET_PATTERNS[asset];
  const rawMarkets = await fetchAllPages();
  const markets: PolymarketMarket[] = [];

  for (const market of rawMarkets) {
    const question = (market["question"] as string) ?? "";
    if (!question) continue;

    // Asset filter (skip in allCategories mode)
    if (assetPattern && !assetPattern.test(question)) continue;

    // Text search filter
    if (search && !question.toLowerCase().includes(search.toLowerCase())) continue;

    // Gamma API returns outcomePrices as a JSON-encoded string: '["0.72", "0.28"]'
    const rawPrices = market["outcomePrices"];
    let outcomePrices: string[];
    try {
      outcomePrices = typeof rawPrices === "string"
        ? (JSON.parse(rawPrices) as string[])
        : (rawPrices as string[]);
    } catch {
      continue;
    }
    if (!Array.isArray(outcomePrices) || outcomePrices.length < 2) continue;

    const yesPrice = parseFloat(outcomePrices[0] ?? "0");
    const noPrice = parseFloat(outcomePrices[1] ?? "0");
    if (isNaN(yesPrice) || isNaN(noPrice)) continue;

    const yesProbabilityPercent = yesPrice * 100;

    // Skip near-resolved markets when filterResolved is set
    if (filterResolved && (yesPrice <= 0.05 || yesPrice >= 0.95)) continue;

    const targetPrice = extractTargetPrice(question);
    if (requireTargetPrice && !targetPrice) continue;

    const detectedCategory = detectCategory(question);

    if (category && category !== "ALL" && detectedCategory !== category) continue;

    const endDateRaw = (market["endDateIso"] as string) ?? (market["endDate"] as string) ?? null;

    // Short-term filter: only markets resolving within maxHoursToEnd hours.
    if (maxHoursToEnd != null) {
      if (!endDateRaw) continue;
      const ms = new Date(endDateRaw).getTime() - Date.now();
      if (!Number.isFinite(ms) || ms <= 0 || ms > maxHoursToEnd * 3600_000) continue;
    }

    const slug = (market["slug"] as string) ?? null;
    const conditionId = (market["conditionId"] as string) ?? (market["condition_id"] as string) ?? "";

    // The public polymarket.com/event/<slug> URL uses the PARENT EVENT slug,
    // not the market slug. The market slug points to a non-existent page.
    const events = market["events"];
    let eventSlug: string | null = null;
    if (Array.isArray(events) && events.length > 0) {
      const ev = events[0] as Record<string, unknown>;
      eventSlug = (ev["slug"] as string) ?? null;
    }

    const rawVol = market["volumeNum"] ?? market["volume"];
    const rawVol24h = market["volume24hr"];
    const rawChange = market["oneDayPriceChange"];
    const rawLiquidity = market["liquidityNum"] ?? market["liquidity"];
    const rawSpread = market["spread"];
    const rawCompetitive = market["competitive"];

    const num = (v: unknown): number | null =>
      v != null && Number.isFinite(parseFloat(v as string)) ? parseFloat(v as string) : null;

    markets.push({
      conditionId,
      question,
      yesPrice,
      noPrice,
      yesProbabilityPercent,
      targetPrice,
      active: true,
      endDate: endDateRaw,
      volume: num(rawVol),
      volume24hr: num(rawVol24h),
      assetTag: allCategories ? detectedCategory : detectAssetTag(question),
      category: detectedCategory,
      slug,
      eventSlug,
      oneDayPriceChange: num(rawChange),
      liquidity: num(rawLiquidity),
      spread: num(rawSpread),
      competitive: num(rawCompetitive),
    });
  }

  return markets;
}
