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
