import { logger } from "./logger";

export interface BinanceData {
  symbol: string;
  asset: string;
  markPrice: number;
  fundingRate: number;
  fundingRatePercent: number;
  fetchedAt: string;
}

const BINANCE_FUTURES_API = "https://fapi.binance.com/fapi/v1/premiumIndex";
// Public market-data mirror that is not geo-blocked (futures fapi returns 451
// in many deployment regions). Used as a fallback for mark price.
const BINANCE_SPOT_FALLBACK = "https://data-api.binance.vision/api/v3/ticker/price";

export const ASSET_SYMBOLS: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  SOL: "SOLUSDT",
  BNB: "BNBUSDT",
};

export const ALL_SYMBOLS = Object.entries(ASSET_SYMBOLS);

/**
 * Spot-price fallback for regions where the futures API (fapi) is geo-blocked
 * with HTTP 451. Spot price is a close proxy for the futures mark price; the
 * funding rate is unavailable from this endpoint so it is reported as 0.
 */
async function fetchSpotFallback(symbol: string): Promise<BinanceData> {
  const url = new URL(BINANCE_SPOT_FALLBACK);
  url.searchParams.set("symbol", symbol);

  const response = await fetch(url.toString());
  if (!response.ok) {
    logger.error({ status: response.status, symbol }, "Binance spot fallback error");
    throw new Error(`Binance spot fallback returned ${response.status} for ${symbol}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const markPrice = parseFloat(data["price"] as string);
  if (!Number.isFinite(markPrice)) {
    logger.error({ symbol, price: data["price"] }, "Binance spot fallback returned non-numeric price");
    throw new Error(`Binance spot fallback returned invalid price for ${symbol}`);
  }

  return {
    symbol,
    asset: symbol.replace("USDT", ""),
    markPrice,
    fundingRate: 0,
    fundingRatePercent: 0,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchBinanceData(symbol = "BTCUSDT"): Promise<BinanceData> {
  const url = new URL(BINANCE_FUTURES_API);
  url.searchParams.set("symbol", symbol);

  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch (err) {
    logger.warn({ err, symbol }, "Binance futures fetch failed, using spot fallback");
    return fetchSpotFallback(symbol);
  }

  if (!response.ok) {
    // 451 (geo-blocked) and other upstream failures: fall back to spot price so
    // signals keep working in regions where the futures API is unavailable.
    logger.warn({ status: response.status, symbol }, "Binance futures unavailable, using spot fallback");
    return fetchSpotFallback(symbol);
  }

  const data = await response.json() as Record<string, unknown>;
  const markPrice = parseFloat(data["markPrice"] as string);
  const lastFundingRate = parseFloat(data["lastFundingRate"] as string);
  const asset = symbol.replace("USDT", "");

  return {
    symbol,
    asset,
    markPrice,
    fundingRate: lastFundingRate,
    fundingRatePercent: lastFundingRate * 100,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchAllBinanceData(): Promise<BinanceData[]> {
  const results = await Promise.allSettled(
    ALL_SYMBOLS.map(([, symbol]) => fetchBinanceData(symbol)),
  );

  const successful: BinanceData[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      successful.push(result.value);
    } else {
      logger.warn({ reason: result.reason }, "Failed to fetch Binance asset");
    }
  }
  return successful;
}

// ── Market overview (dynamic top-50 universe) ────────────────────────────────

export interface CoinTicker {
  symbol: string;       // e.g. BTCUSDT
  asset: string;        // e.g. BTC
  price: number;
  changePercent: number;
  high24h: number;
  low24h: number;
  quoteVolume: number;  // USD volume
  trades: number;
}

const BINANCE_24H = "https://data-api.binance.vision/api/v3/ticker/24hr";

// Stablecoins and wrapped/fiat tokens that shouldn't appear as "movers".
const STABLE_OR_FIAT = new Set([
  "USDC", "FDUSD", "TUSD", "DAI", "USDP", "BUSD", "USDD", "EUR", "GBP",
  "AEUR", "USDT", "PYUSD", "EURI", "XUSD",
]);

function isLeveraged(asset: string): boolean {
  return /(UP|DOWN|BULL|BEAR)$/.test(asset);
}

let _overviewCache: { data: CoinTicker[]; expiresAt: number } | null = null;
const OVERVIEW_TTL_MS = 30 * 1000;

/**
 * Fetch the full 24h ticker set from the non-geo-blocked Binance mirror and
 * return the top USDT pairs by quote volume (stablecoins + leveraged tokens
 * excluded). This is the live coin universe used across the app.
 */
export async function fetchMarketOverview(limit = 50): Promise<CoinTicker[]> {
  if (_overviewCache && Date.now() < _overviewCache.expiresAt) {
    return _overviewCache.data.slice(0, limit);
  }

  const res = await fetch(BINANCE_24H);
  if (!res.ok) {
    logger.error({ status: res.status }, "Binance 24h overview failed");
    throw new Error(`Binance 24h overview returned ${res.status}`);
  }
  const raw = (await res.json()) as Array<Record<string, string>>;

  const coins: CoinTicker[] = raw
    .filter((t) => t.symbol.endsWith("USDT"))
    .map((t) => ({ asset: t.symbol.replace(/USDT$/, ""), t }))
    .filter(({ asset }) => !STABLE_OR_FIAT.has(asset) && !isLeveraged(asset))
    .map(({ asset, t }) => ({
      symbol: t.symbol,
      asset,
      price: parseFloat(t.lastPrice),
      changePercent: parseFloat(t.priceChangePercent),
      high24h: parseFloat(t.highPrice),
      low24h: parseFloat(t.lowPrice),
      quoteVolume: parseFloat(t.quoteVolume),
      trades: parseInt(t.count ?? "0", 10),
    }))
    .filter((c) => Number.isFinite(c.price) && Number.isFinite(c.quoteVolume) && c.quoteVolume > 0)
    .sort((a, b) => b.quoteVolume - a.quoteVolume)
    .slice(0, 100);

  _overviewCache = { data: coins, expiresAt: Date.now() + OVERVIEW_TTL_MS };
  return coins.slice(0, limit);
}

/** Return the top-N liquid USDT symbols (e.g. ["BTCUSDT", ...]). */
export async function getTopSymbols(n = 30): Promise<string[]> {
  const overview = await fetchMarketOverview(n);
  return overview.map((c) => c.symbol);
}

export interface Kline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const BINANCE_KLINES = "https://data-api.binance.vision/api/v3/klines";

/** Fetch OHLCV candles from the non-geo-blocked mirror. */
export async function fetchKlines(
  symbol: string,
  interval = "15m",
  limit = 100,
): Promise<Kline[]> {
  const url = new URL(BINANCE_KLINES);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Binance klines ${symbol} returned ${res.status}`);
  const raw = (await res.json()) as unknown[][];

  return raw
    .map((k) => ({
      openTime: Number(k[0]),
      open: parseFloat(k[1] as string),
      high: parseFloat(k[2] as string),
      low: parseFloat(k[3] as string),
      close: parseFloat(k[4] as string),
      volume: parseFloat(k[5] as string),
    }))
    // Drop malformed candles so non-finite values never poison indicator math.
    .filter(
      (k) =>
        Number.isFinite(k.open) &&
        Number.isFinite(k.high) &&
        Number.isFinite(k.low) &&
        Number.isFinite(k.close) &&
        k.close > 0,
    );
}
