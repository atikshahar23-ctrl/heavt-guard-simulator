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
}

const POLYMARKET_API = "https://clob.polymarket.com/markets";

/** Extract a dollar target price from a contract question using regex */
function extractTargetPrice(question: string): number | null {
  // Matches patterns like $100,000 or $65k or $65K
  const match = /\$(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+[kK])/.exec(question);
  if (!match) return null;

  const raw = match[1].replace(/,/g, "").toLowerCase();
  if (raw.endsWith("k")) {
    return parseFloat(raw.slice(0, -1)) * 1000;
  }
  return parseFloat(raw);
}

export async function fetchBtcPolymarketMarkets(): Promise<PolymarketMarket[]> {
  const url = `${POLYMARKET_API}?active=true&limit=100`;
  const response = await fetch(url);

  if (!response.ok) {
    logger.error({ status: response.status }, "Polymarket API error");
    throw new Error(`Polymarket API returned ${response.status}`);
  }

  const json = await response.json() as Record<string, unknown>;
  const rawMarkets = (json["data"] ?? json) as Record<string, unknown>[];

  const markets: PolymarketMarket[] = [];

  for (const market of rawMarkets) {
    const question = (market["question"] as string) ?? "";

    // Filter only BTC/Bitcoin markets
    if (!question.includes("Bitcoin") && !question.includes("BTC")) {
      continue;
    }

    const tokens = (market["tokens"] as Record<string, unknown>[]) ?? [];
    if (tokens.length < 2) continue;

    const yesPrice = parseFloat((tokens[0]["price"] as string) ?? "0");
    const noPrice = parseFloat((tokens[1]["price"] as string) ?? "0");
    const yesProbabilityPercent = yesPrice * 100;

    // Filter out near-resolved markets
    if (yesPrice <= 0.01 || yesPrice >= 0.99) continue;

    const targetPrice = extractTargetPrice(question);
    if (!targetPrice) continue;

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
    });
  }

  return markets;
}
