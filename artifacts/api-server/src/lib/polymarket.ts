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
  assetTag: string;
  category: string;
  slug: string | null;
}

const POLYMARKET_API = "https://clob.polymarket.com/markets";

export type AssetFilter = "BTC" | "ETH" | "SOL" | "BNB" | "ALL";
export type CategoryFilter = "ALL" | "CRYPTO" | "POLITICS" | "SPORTS" | "ECONOMY" | "TECH" | "OTHER";

// Word-boundary patterns prevent false positives like "FiveThirtyEight" matching "ETH"
const ASSET_PATTERNS: Record<AssetFilter, RegExp> = {
  BTC: /bitcoin|\bbtc\b/i,
  ETH: /ethereum|\beth\b/i,
  SOL: /solana|\bsol\b/i,
  BNB: /\bbnb\b|binance coin/i,
  ALL: /bitcoin|\bbtc\b|ethereum|\beth\b|solana|\bsol\b|\bbnb\b|binance coin/i,
};

/** Detect which crypto asset tag applies to a question */
function detectAssetTag(question: string): string {
  if (/bitcoin|\bbtc\b/i.test(question)) return "BTC";
  if (/ethereum|\beth\b/i.test(question)) return "ETH";
  if (/solana|\bsol\b/i.test(question)) return "SOL";
  if (/\bbnb\b|binance coin/i.test(question)) return "BNB";
  return "CRYPTO";
}

/** Detect broad market category from question text */
export function detectCategory(question: string, tags?: string[]): CategoryFilter {
  const q = question.toLowerCase();

  // Crypto (check first — most specific for this platform)
  if (/bitcoin|\bbtc\b|ethereum|\beth\b|solana|\bsol\b|\bbnb\b|binance|crypto|defi|\bnft\b|blockchain|altcoin|token|\bxrp\b|\bdoge\b|\bshib\b|\bada\b|\bavax\b|\blink\b|\bmatic\b|\bdot\b/i.test(question)) return "CRYPTO";

  // Politics / Elections
  if (/president|election|senator|congress|parliament|minister|prime minister|governor|mayor|vote|ballot|democrat|republican|trump|biden|kamala|harris|macron|modi|zelensky|putin|sunak|scholz|war|ceasefire|nato|ukraine|gaza|israel|geopolit|sanction|treaty|referendum|impeach/i.test(question)) return "POLITICS";

  // Sports
  if (/\bnfl\b|\bnba\b|\bnhl\b|\bmlb\b|\bncaa\b|\bnascar\b|soccer|football|basketball|baseball|hockey|tennis|golf|mma|ufc|boxing|olympics|world cup|champion|superbowl|super bowl|formula one|\bf1\b|formula 1|wimbledon|grand slam|serie a|premier league|la liga|bundesliga|champions league/i.test(question)) return "SPORTS";

  // Economy / Finance (non-crypto)
  if (/\bgdp\b|inflation|federal reserve|\bfed\b|interest rate|recession|unemployment|\bcpi\b|\bpce\b|fiscal|monetary|treasury|bond yield|debt ceiling|ipo|merger|acquisition|earnings|\bsec\b|nasdaq|s&p|dow jones|\bfdi\b/i.test(question)) return "ECONOMY";

  // Tech / AI
  if (/artificial intelligence|\bai\b|chatgpt|openai|google|apple|microsoft|meta|tesla|amazon|nvidia|spacex|starlink|elon musk|sam altman|gpt-|llm|regulation|antitrust|big tech|social media/i.test(question)) return "TECH";

  return "OTHER";
}

/** Extract a dollar target price from a contract question using regex */
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
  /** When true, skip the crypto asset filter entirely (returns all categories) */
  allCategories?: boolean;
}

// ── In-memory page cache (TTL: 2 min) ────────────────────────────────────────
let _cachedPages: Record<string, unknown>[] | null = null;
let _cacheExpiresAt = 0;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes for fresher data

export function invalidatePolymarketCache(): void {
  _cachedPages = null;
  _cacheExpiresAt = 0;
}

/** Fetch all pages from Polymarket, following next_cursor pagination */
async function fetchAllPages(): Promise<Record<string, unknown>[]> {
  const now = Date.now();
  if (_cachedPages && now < _cacheExpiresAt) {
    logger.debug({ cached: true, total: _cachedPages.length }, "Polymarket cache hit");
    return _cachedPages;
  }

  const PAGE_SIZE = 500;
  const all: Record<string, unknown>[] = [];
  let cursor: string | undefined = undefined;
  let page = 0;
  const MAX_PAGES = 6;

  const fetchStart = Date.now();

  do {
    const url = new URL(POLYMARKET_API);
    url.searchParams.set("active", "true");
    url.searchParams.set("limit", String(PAGE_SIZE));
    if (cursor) url.searchParams.set("next_cursor", cursor);

    const response = await fetch(url.toString());
    if (!response.ok) {
      logger.error({ status: response.status, page }, "Polymarket API error");
      throw new Error(`Polymarket API returned ${response.status}`);
    }

    const json = await response.json() as Record<string, unknown>;
    const items = (json["data"] ?? json) as Record<string, unknown>[];
    all.push(...items);

    const next = json["next_cursor"] as string | undefined;
    cursor = next && next !== "LTE=" ? next : undefined;
    page++;
  } while (cursor && page < MAX_PAGES);

  const elapsed = Date.now() - fetchStart;
  logger.info({ total: all.length, pages: page, ms: elapsed }, "Polymarket pages fetched (cold)");

  _cachedPages = all;
  _cacheExpiresAt = now + CACHE_TTL_MS;
  return all;
}

export async function fetchPolymarketMarkets(opts: FetchPolymarketOptions = {}): Promise<PolymarketMarket[]> {
  const {
    asset = "ALL",
    category,
    search,
    requireTargetPrice = false,
    filterResolved = false,
    allCategories = false,
  } = opts;

  const assetPattern = allCategories ? null : ASSET_PATTERNS[asset];
  const rawMarkets = await fetchAllPages();
  const markets: PolymarketMarket[] = [];

  for (const market of rawMarkets) {
    const question = (market["question"] as string) ?? "";

    // Asset filter (skip if allCategories mode)
    if (assetPattern && !assetPattern.test(question)) continue;

    // Text search filter
    if (search && !question.toLowerCase().includes(search.toLowerCase())) continue;

    const tokens = (market["tokens"] as Record<string, unknown>[]) ?? [];
    if (tokens.length < 2) continue;

    const yesPrice = parseFloat((tokens[0]["price"] as string) ?? "0");
    const noPrice = parseFloat((tokens[1]["price"] as string) ?? "0");
    const yesProbabilityPercent = yesPrice * 100;

    if (filterResolved && (yesPrice <= 0.01 || yesPrice >= 0.99)) continue;

    const targetPrice = extractTargetPrice(question);
    if (requireTargetPrice && !targetPrice) continue;

    const detectedCategory = detectCategory(question);

    // Category filter for all-categories mode
    if (category && category !== "ALL" && detectedCategory !== category) continue;

    const slug = (market["market_slug"] as string) ?? (market["slug"] as string) ?? null;

    markets.push({
      conditionId: (market["condition_id"] as string) ?? (market["conditionId"] as string) ?? "",
      question,
      yesPrice,
      noPrice,
      yesProbabilityPercent,
      targetPrice,
      active: (market["active"] as boolean) ?? true,
      endDate: (market["end_date_iso"] as string) ?? (market["endDate"] as string) ?? null,
      volume: market["volume"] != null ? parseFloat(market["volume"] as string) : null,
      assetTag: allCategories ? detectedCategory : detectAssetTag(question),
      category: detectedCategory,
      slug,
    });
  }

  return markets;
}
