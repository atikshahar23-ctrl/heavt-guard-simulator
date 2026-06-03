import { logger } from "./logger";

export interface MoverCoin {
  symbol: string;
  price: number;
  changePercent: number;
  quoteVolume: number | null;
}

export interface TrendingCoin {
  name: string;
  symbol: string;
  marketCapRank: number | null;
  thumb: string | null;
}

export interface NewsItem {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
}

export interface FearGreed {
  value: number;
  classification: string;
}

export interface MarketMovers {
  fetchedAt: string;
  fearGreed: FearGreed | null;
  gainers: MoverCoin[];
  losers: MoverCoin[];
  trending: TrendingCoin[];
  news: NewsItem[];
}

const BINANCE_24H = "https://data-api.binance.vision/api/v3/ticker/24hr";
const FNG_API = "https://api.alternative.me/fng/?limit=1";
const COINGECKO_TRENDING = "https://api.coingecko.com/api/v3/search/trending";
const NEWS_RSS =
  "https://news.google.com/rss/search?q=crypto+OR+bitcoin+OR+ethereum+when:2d&hl=en-US&gl=US&ceid=US:en";

const MIN_QUOTE_VOLUME = 30_000_000; // $30M — filter out illiquid pairs

/* ── Fear & Greed ──────────────────────────────────────────── */
async function fetchFearGreed(): Promise<FearGreed | null> {
  try {
    const res = await fetch(FNG_API);
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: Array<{ value: string; value_classification: string }> };
    const item = data.data?.[0];
    if (!item) return null;
    const value = parseInt(item.value, 10);
    if (!Number.isFinite(value)) return null;
    return {
      value,
      classification: item.value_classification,
    };
  } catch (err) {
    logger.warn({ err }, "Fear & Greed fetch failed");
    return null;
  }
}

/* ── Top gainers / losers (Binance 24h) ────────────────────── */
async function fetchGainersLosers(): Promise<{ gainers: MoverCoin[]; losers: MoverCoin[] }> {
  try {
    const res = await fetch(BINANCE_24H);
    if (!res.ok) return { gainers: [], losers: [] };
    const raw = (await res.json()) as Array<Record<string, string>>;

    const coins: MoverCoin[] = raw
      .filter(
        (t) =>
          t.symbol.endsWith("USDT") &&
          !t.symbol.includes("UP") &&
          !t.symbol.includes("DOWN") &&
          parseFloat(t.quoteVolume) > MIN_QUOTE_VOLUME,
      )
      .map((t) => ({
        symbol: t.symbol.replace("USDT", ""),
        price: parseFloat(t.lastPrice),
        changePercent: parseFloat(t.priceChangePercent),
        quoteVolume: parseFloat(t.quoteVolume),
      }))
      .filter((c) => Number.isFinite(c.price) && Number.isFinite(c.changePercent));

    const sorted = [...coins].sort((a, b) => b.changePercent - a.changePercent);
    const gainers = sorted.slice(0, 8);
    const losers = sorted.slice(-8).reverse();
    return { gainers, losers };
  } catch (err) {
    logger.warn({ err }, "Binance 24h fetch failed");
    return { gainers: [], losers: [] };
  }
}

/* ── Trending coins (CoinGecko) ────────────────────────────── */
async function fetchTrending(): Promise<TrendingCoin[]> {
  try {
    const res = await fetch(COINGECKO_TRENDING);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      coins?: Array<{ item?: { name: string; symbol: string; market_cap_rank: number | null; thumb: string | null } }>;
    };
    return (data.coins ?? [])
      .map((c) => c.item)
      .filter((i): i is NonNullable<typeof i> => !!i)
      .slice(0, 10)
      .map((i) => ({
        name: i.name,
        symbol: i.symbol,
        marketCapRank: i.market_cap_rank ?? null,
        thumb: i.thumb ?? null,
      }));
  } catch (err) {
    logger.warn({ err }, "CoinGecko trending fetch failed");
    return [];
  }
}

/* ── News headlines (Google News RSS, no key) ──────────────── */
function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

async function fetchNews(): Promise<NewsItem[]> {
  try {
    const res = await fetch(NEWS_RSS, { headers: { "User-Agent": "Mozilla/5.0 (HeavyGuard)" } });
    if (!res.ok) return [];
    const xml = await res.text();

    const items: NewsItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 20) {
      const block = match[1] ?? "";
      const titleRaw = /<title>([\s\S]*?)<\/title>/.exec(block)?.[1] ?? "";
      const linkRaw = /<link>([\s\S]*?)<\/link>/.exec(block)?.[1] ?? "";
      const pubRaw = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(block)?.[1] ?? "";
      const sourceRaw = /<source[^>]*>([\s\S]*?)<\/source>/.exec(block)?.[1] ?? "";

      const title = decodeEntities(titleRaw.replace(/<!\[CDATA\[|\]\]>/g, "").trim());
      const url = linkRaw.replace(/<!\[CDATA\[|\]\]>/g, "").trim();
      if (!title || !url) continue;

      // Google News titles end with " - <source>"; strip it for cleanliness.
      const cleanTitle = title.replace(/\s+-\s+[^-]+$/, "").trim() || title;
      const source = decodeEntities(sourceRaw.replace(/<!\[CDATA\[|\]\]>/g, "").trim()) || "News";

      items.push({
        title: cleanTitle,
        source,
        url,
        publishedAt: pubRaw ? new Date(pubRaw).toISOString() : new Date().toISOString(),
      });
    }
    return items;
  } catch (err) {
    logger.warn({ err }, "News RSS fetch failed");
    return [];
  }
}

/* ── In-memory cache (3 min) ───────────────────────────────── */
let cache: { data: MarketMovers; expiresAt: number } | null = null;
const CACHE_TTL_MS = 3 * 60 * 1000;

export async function fetchMarketMovers(): Promise<MarketMovers> {
  if (cache && Date.now() < cache.expiresAt) {
    return cache.data;
  }

  const [fearGreed, gl, trending, news] = await Promise.all([
    fetchFearGreed(),
    fetchGainersLosers(),
    fetchTrending(),
    fetchNews(),
  ]);

  const data: MarketMovers = {
    fetchedAt: new Date().toISOString(),
    fearGreed,
    gainers: gl.gainers,
    losers: gl.losers,
    trending,
    news,
  };

  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}
