import { logger } from "./logger";

export type StockCategory = "TECH" | "ENERGY" | "RESOURCES" | "LARGE_CAP" | "INDEX";

export interface StockQuote {
  symbol: string;
  name: string;
  category: StockCategory;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  dayHigh: number | null;
  dayLow: number | null;
  monthHigh: number | null;
  monthLow: number | null;
  momentum5dPercent: number | null;
  volume: number | null;
  currency: string;
  tradingViewSymbol: string;
  fetchedAt: string;
}

export type StockAction = "BUY" | "SELL" | "HOLD";
export type StockConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface StockRecommendation {
  rank: number;
  symbol: string;
  name: string;
  category: StockCategory;
  action: StockAction;
  confidence: StockConfidence;
  rationale: string;
  price: number;
  changePercent: number;
  momentum5dPercent: number;
  rangePositionPercent: number;
  tradingViewSymbol: string;
}

interface TickerDef {
  symbol: string;
  name: string;
  category: StockCategory;
}

// Curated universe (~100): technology, energy, resources/materials, large caps, indices/ETFs.
const TICKERS: TickerDef[] = [
  // ── Technology ──
  { symbol: "AAPL", name: "Apple", category: "TECH" },
  { symbol: "MSFT", name: "Microsoft", category: "TECH" },
  { symbol: "NVDA", name: "NVIDIA", category: "TECH" },
  { symbol: "GOOGL", name: "Alphabet", category: "TECH" },
  { symbol: "AMZN", name: "Amazon", category: "TECH" },
  { symbol: "META", name: "Meta Platforms", category: "TECH" },
  { symbol: "TSLA", name: "Tesla", category: "TECH" },
  { symbol: "AVGO", name: "Broadcom", category: "TECH" },
  { symbol: "ORCL", name: "Oracle", category: "TECH" },
  { symbol: "ADBE", name: "Adobe", category: "TECH" },
  { symbol: "CRM", name: "Salesforce", category: "TECH" },
  { symbol: "AMD", name: "Advanced Micro Devices", category: "TECH" },
  { symbol: "INTC", name: "Intel", category: "TECH" },
  { symbol: "CSCO", name: "Cisco", category: "TECH" },
  { symbol: "QCOM", name: "Qualcomm", category: "TECH" },
  { symbol: "TXN", name: "Texas Instruments", category: "TECH" },
  { symbol: "IBM", name: "IBM", category: "TECH" },
  { symbol: "NOW", name: "ServiceNow", category: "TECH" },
  { symbol: "INTU", name: "Intuit", category: "TECH" },
  { symbol: "AMAT", name: "Applied Materials", category: "TECH" },
  { symbol: "MU", name: "Micron Technology", category: "TECH" },
  { symbol: "NFLX", name: "Netflix", category: "TECH" },
  { symbol: "SHOP", name: "Shopify", category: "TECH" },
  { symbol: "UBER", name: "Uber", category: "TECH" },
  { symbol: "PLTR", name: "Palantir", category: "TECH" },
  { symbol: "SNOW", name: "Snowflake", category: "TECH" },
  { symbol: "ARM", name: "Arm Holdings", category: "TECH" },
  { symbol: "SMCI", name: "Super Micro Computer", category: "TECH" },
  { symbol: "PYPL", name: "PayPal", category: "TECH" },
  { symbol: "MRVL", name: "Marvell Technology", category: "TECH" },

  // ── Energy ──
  { symbol: "XOM", name: "Exxon Mobil", category: "ENERGY" },
  { symbol: "CVX", name: "Chevron", category: "ENERGY" },
  { symbol: "COP", name: "ConocoPhillips", category: "ENERGY" },
  { symbol: "SLB", name: "Schlumberger", category: "ENERGY" },
  { symbol: "EOG", name: "EOG Resources", category: "ENERGY" },
  { symbol: "MPC", name: "Marathon Petroleum", category: "ENERGY" },
  { symbol: "PSX", name: "Phillips 66", category: "ENERGY" },
  { symbol: "VLO", name: "Valero Energy", category: "ENERGY" },
  { symbol: "OXY", name: "Occidental Petroleum", category: "ENERGY" },
  { symbol: "WMB", name: "Williams Companies", category: "ENERGY" },
  { symbol: "KMI", name: "Kinder Morgan", category: "ENERGY" },
  { symbol: "HAL", name: "Halliburton", category: "ENERGY" },
  { symbol: "DVN", name: "Devon Energy", category: "ENERGY" },
  { symbol: "HES", name: "Hess", category: "ENERGY" },
  { symbol: "BKR", name: "Baker Hughes", category: "ENERGY" },
  { symbol: "FANG", name: "Diamondback Energy", category: "ENERGY" },
  { symbol: "ENPH", name: "Enphase Energy", category: "ENERGY" },
  { symbol: "FSLR", name: "First Solar", category: "ENERGY" },

  // ── Resources / Materials / Mining ──
  { symbol: "LIN", name: "Linde", category: "RESOURCES" },
  { symbol: "FCX", name: "Freeport-McMoRan", category: "RESOURCES" },
  { symbol: "NEM", name: "Newmont", category: "RESOURCES" },
  { symbol: "SCCO", name: "Southern Copper", category: "RESOURCES" },
  { symbol: "NUE", name: "Nucor", category: "RESOURCES" },
  { symbol: "DOW", name: "Dow", category: "RESOURCES" },
  { symbol: "APD", name: "Air Products", category: "RESOURCES" },
  { symbol: "SHW", name: "Sherwin-Williams", category: "RESOURCES" },
  { symbol: "ALB", name: "Albemarle", category: "RESOURCES" },
  { symbol: "CTVA", name: "Corteva", category: "RESOURCES" },
  { symbol: "MOS", name: "Mosaic", category: "RESOURCES" },
  { symbol: "CF", name: "CF Industries", category: "RESOURCES" },
  { symbol: "GOLD", name: "Barrick Gold", category: "RESOURCES" },
  { symbol: "AA", name: "Alcoa", category: "RESOURCES" },
  { symbol: "X", name: "United States Steel", category: "RESOURCES" },
  { symbol: "VALE", name: "Vale", category: "RESOURCES" },
  { symbol: "RIO", name: "Rio Tinto", category: "RESOURCES" },
  { symbol: "BHP", name: "BHP Group", category: "RESOURCES" },

  // ── Large caps (financials / consumer / industrial / healthcare) ──
  { symbol: "BRK-B", name: "Berkshire Hathaway", category: "LARGE_CAP" },
  { symbol: "JPM", name: "JPMorgan Chase", category: "LARGE_CAP" },
  { symbol: "V", name: "Visa", category: "LARGE_CAP" },
  { symbol: "MA", name: "Mastercard", category: "LARGE_CAP" },
  { symbol: "BAC", name: "Bank of America", category: "LARGE_CAP" },
  { symbol: "WFC", name: "Wells Fargo", category: "LARGE_CAP" },
  { symbol: "GS", name: "Goldman Sachs", category: "LARGE_CAP" },
  { symbol: "WMT", name: "Walmart", category: "LARGE_CAP" },
  { symbol: "COST", name: "Costco", category: "LARGE_CAP" },
  { symbol: "HD", name: "Home Depot", category: "LARGE_CAP" },
  { symbol: "PG", name: "Procter & Gamble", category: "LARGE_CAP" },
  { symbol: "KO", name: "Coca-Cola", category: "LARGE_CAP" },
  { symbol: "PEP", name: "PepsiCo", category: "LARGE_CAP" },
  { symbol: "MCD", name: "McDonald's", category: "LARGE_CAP" },
  { symbol: "DIS", name: "Walt Disney", category: "LARGE_CAP" },
  { symbol: "NKE", name: "Nike", category: "LARGE_CAP" },
  { symbol: "JNJ", name: "Johnson & Johnson", category: "LARGE_CAP" },
  { symbol: "UNH", name: "UnitedHealth", category: "LARGE_CAP" },
  { symbol: "LLY", name: "Eli Lilly", category: "LARGE_CAP" },
  { symbol: "ABBV", name: "AbbVie", category: "LARGE_CAP" },
  { symbol: "PFE", name: "Pfizer", category: "LARGE_CAP" },
  { symbol: "CAT", name: "Caterpillar", category: "LARGE_CAP" },
  { symbol: "BA", name: "Boeing", category: "LARGE_CAP" },
  { symbol: "GE", name: "GE Aerospace", category: "LARGE_CAP" },

  // ── Indices / ETFs ──
  { symbol: "SPY", name: "S&P 500 ETF", category: "INDEX" },
  { symbol: "QQQ", name: "Nasdaq 100 ETF", category: "INDEX" },
  { symbol: "DIA", name: "Dow Jones ETF", category: "INDEX" },
  { symbol: "IWM", name: "Russell 2000 ETF", category: "INDEX" },
  { symbol: "VTI", name: "Total US Market ETF", category: "INDEX" },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", category: "INDEX" },
  { symbol: "EEM", name: "Emerging Markets ETF", category: "INDEX" },
  { symbol: "GLD", name: "Gold ETF", category: "INDEX" },
  { symbol: "SLV", name: "Silver ETF", category: "INDEX" },
  { symbol: "USO", name: "US Oil Fund", category: "INDEX" },
];

const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";

// TradingView uses dot notation for class shares (BRK.B not BRK-B)
function toTradingViewSymbol(symbol: string): string {
  return symbol.replace("-", ".");
}

interface YahooChartMeta {
  symbol?: string;
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  currency?: string;
}

async function fetchOneQuote(def: TickerDef): Promise<StockQuote | null> {
  const url = `${YAHOO_CHART}/${encodeURIComponent(def.symbol)}?interval=1d&range=1mo`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) {
      logger.warn({ symbol: def.symbol, status: res.status }, "Yahoo chart returned non-OK");
      return null;
    }
    const json = (await res.json()) as {
      chart?: { result?: { meta?: YahooChartMeta; timestamp?: number[]; indicators?: { quote?: { close?: (number | null)[] }[] } }[] };
    };
    const result = json.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta || typeof meta.regularMarketPrice !== "number") return null;

    const price = meta.regularMarketPrice;

    // Build daily-close history (used for daily change, momentum and range).
    const closes = (result?.indicators?.quote?.[0]?.close ?? []).filter(
      (c): c is number => typeof c === "number",
    );

    // Daily previous close = the prior trading day's close. With range=1mo the
    // meta.chartPreviousClose is ~1 month ago, so derive it from the closes array.
    const dailyPreviousClose =
      closes.length >= 2
        ? closes[closes.length - 2]
        : (meta.previousClose ?? meta.chartPreviousClose ?? price);
    const previousClose = dailyPreviousClose;
    const change = price - previousClose;
    const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0;

    let monthHigh: number | null = null;
    let monthLow: number | null = null;
    let momentum5dPercent: number | null = null;
    if (closes.length > 0) {
      monthHigh = Math.max(...closes, price);
      monthLow = Math.min(...closes, price);
      const idx5 = closes.length - 6;
      const ref5 = idx5 >= 0 ? closes[idx5] : closes[0];
      if (ref5 && ref5 !== 0) momentum5dPercent = ((price - ref5) / ref5) * 100;
    }

    return {
      symbol: def.symbol,
      name: def.name,
      category: def.category,
      price,
      previousClose,
      change,
      changePercent,
      dayHigh: meta.regularMarketDayHigh ?? null,
      dayLow: meta.regularMarketDayLow ?? null,
      monthHigh,
      monthLow,
      momentum5dPercent,
      volume: meta.regularMarketVolume ?? null,
      currency: meta.currency ?? "USD",
      tradingViewSymbol: toTradingViewSymbol(def.symbol),
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.warn({ symbol: def.symbol, err: String(err) }, "Yahoo chart fetch failed");
    return null;
  }
}

// ── In-memory cache (TTL: 30s) ───────────────────────────────────────────────
let _cached: StockQuote[] | null = null;
let _cacheExpiresAt = 0;
const CACHE_TTL_MS = 30 * 1000;
const CONCURRENCY = 10;

export async function fetchStockQuotes(): Promise<StockQuote[]> {
  const now = Date.now();
  if (_cached && now < _cacheExpiresAt) {
    logger.debug({ cached: true, total: _cached.length }, "Stock cache hit");
    return _cached;
  }

  const start = Date.now();
  const out: StockQuote[] = [];
  for (let i = 0; i < TICKERS.length; i += CONCURRENCY) {
    const chunk = TICKERS.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map(fetchOneQuote));
    for (const r of results) if (r) out.push(r);
  }

  if (out.length === 0) {
    throw new Error("Failed to fetch any stock quotes from Yahoo Finance");
  }

  logger.info({ total: out.length, ms: Date.now() - start }, "Stock quotes fetched (cold)");
  _cached = out;
  _cacheExpiresAt = now + CACHE_TTL_MS;
  return out;
}

export function invalidateStockCache(): void {
  _cached = null;
  _cacheExpiresAt = 0;
}

// ── Recommendations ───────────────────────────────────────────────────────────

function rangePosition(q: StockQuote): number {
  if (q.monthHigh == null || q.monthLow == null || q.monthHigh === q.monthLow) return 50;
  return ((q.price - q.monthLow) / (q.monthHigh - q.monthLow)) * 100;
}

export async function buildStockRecommendations(): Promise<StockRecommendation[]> {
  const quotes = await fetchStockQuotes();

  const scored = quotes.map((q) => {
    const momentum = q.momentum5dPercent ?? 0;
    const day = q.changePercent;
    const rangePos = rangePosition(q);

    let action: StockAction = "HOLD";
    let confidence: StockConfidence = "LOW";

    // Composite signal: 5-day momentum is the primary driver, daily change confirms it.
    const score = momentum + day * 0.5;

    if (score > 3) {
      action = "BUY";
      confidence = score > 8 ? "HIGH" : score > 5 ? "MEDIUM" : "LOW";
    } else if (score < -3) {
      action = "SELL";
      confidence = score < -8 ? "HIGH" : score < -5 ? "MEDIUM" : "LOW";
    } else {
      action = "HOLD";
      confidence = "LOW";
    }

    let rationale: string;
    if (action === "BUY") {
      rationale = `${q.name} (${q.symbol}) is up ${momentum.toFixed(1)}% over the last 5 sessions and ${day >= 0 ? "+" : ""}${day.toFixed(1)}% today, trading at ${rangePos.toFixed(0)}% of its monthly range. Momentum favors continuation — a candidate to buy.`;
    } else if (action === "SELL") {
      rationale = `${q.name} (${q.symbol}) is down ${Math.abs(momentum).toFixed(1)}% over the last 5 sessions and ${day.toFixed(1)}% today, trading at ${rangePos.toFixed(0)}% of its monthly range. Negative momentum suggests reducing or shorting exposure.`;
    } else {
      rationale = `${q.name} (${q.symbol}) is roughly flat (5d ${momentum >= 0 ? "+" : ""}${momentum.toFixed(1)}%, today ${day >= 0 ? "+" : ""}${day.toFixed(1)}%). No clear edge — hold and wait for a stronger signal.`;
    }

    return {
      symbol: q.symbol,
      name: q.name,
      category: q.category,
      action,
      confidence,
      rationale,
      price: q.price,
      changePercent: day,
      momentum5dPercent: momentum,
      rangePositionPercent: rangePos,
      tradingViewSymbol: q.tradingViewSymbol,
      _score: score,
    };
  });

  // Surface the strongest convictions first (BUY and SELL over HOLD), by score magnitude.
  const actionable = scored.filter((s) => s.action !== "HOLD");
  actionable.sort((a, b) => Math.abs(b._score) - Math.abs(a._score));

  return actionable.slice(0, 24).map(({ _score, ...rest }, i) => ({ rank: i + 1, ...rest }));
}
