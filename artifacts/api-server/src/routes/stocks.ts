import { Router, type IRouter } from "express";
import {
  fetchStockQuotes,
  buildStockRecommendations,
  fetchStockKlines,
  searchStocks,
} from "../lib/stocks";
import { fetchInfluencerSignals } from "../lib/influencers";
import {
  GetStocksResponse,
  GetStockRecommendationsResponse,
  GetStockKlinesResponse,
  GetStockKlinesQueryParams,
  GetStockSearchResponse,
  GetStockSearchQueryParams,
  GetInfluencerSignalsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stocks/search", async (req, res): Promise<void> => {
  const parsed = GetStockSearchQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }
  try {
    const data = await searchStocks(parsed.data.q);
    res.json(GetStockSearchResponse.parse(data));
  } catch (err) {
    req.log.error({ err }, "Failed to search stocks");
    res.status(502).json({ error: "Failed to search stocks" });
  }
});

router.get("/stocks/klines", async (req, res): Promise<void> => {
  const parsed = GetStockKlinesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }
  const { symbol, range, interval } = parsed.data;
  try {
    const data = await fetchStockKlines(symbol, range, interval);
    res.json(GetStockKlinesResponse.parse(data));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "Invalid symbol") {
      res.status(400).json({ error: "Invalid symbol" });
      return;
    }
    req.log.error({ err, symbol }, "Failed to fetch stock klines");
    res.status(502).json({ error: "Failed to fetch stock candles" });
  }
});

router.get("/stocks", async (req, res): Promise<void> => {
  try {
    const data = await fetchStockQuotes();
    res.json(GetStocksResponse.parse(data));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch stock quotes");
    res.status(502).json({ error: "Failed to fetch stock market data" });
  }
});

router.get("/stocks/recommendations", async (req, res): Promise<void> => {
  try {
    const data = await buildStockRecommendations();
    res.json(GetStockRecommendationsResponse.parse(data));
  } catch (err) {
    req.log.error({ err }, "Failed to build stock recommendations");
    res.status(502).json({ error: "Failed to build stock recommendations" });
  }
});

router.get("/stocks/influencers", async (req, res): Promise<void> => {
  try {
    const data = await fetchInfluencerSignals();
    res.json(GetInfluencerSignalsResponse.parse(data));
  } catch (err) {
    req.log.error({ err }, "Failed to build influencer signals");
    res.status(502).json({ error: "Failed to build influencer signals" });
  }
});

export default router;
