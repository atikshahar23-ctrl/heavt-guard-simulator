import { logger } from "./logger";

export interface BinanceData {
  symbol: string;
  markPrice: number;
  fundingRate: number;
  fundingRatePercent: number;
  fetchedAt: string;
}

const BINANCE_FUTURES_API = "https://fapi.binance.com/fapi/v1/premiumIndex";

export async function fetchBinanceData(symbol = "BTCUSDT"): Promise<BinanceData> {
  const url = new URL(BINANCE_FUTURES_API);
  url.searchParams.set("symbol", symbol);

  const response = await fetch(url.toString());
  if (!response.ok) {
    logger.error({ status: response.status, symbol }, "Binance API error");
    throw new Error(`Binance API returned ${response.status}`);
  }

  const data = await response.json() as Record<string, unknown>;

  const markPrice = parseFloat(data["markPrice"] as string);
  const lastFundingRate = parseFloat(data["lastFundingRate"] as string);

  return {
    symbol,
    markPrice,
    fundingRate: lastFundingRate,
    fundingRatePercent: lastFundingRate * 100,
    fetchedAt: new Date().toISOString(),
  };
}
