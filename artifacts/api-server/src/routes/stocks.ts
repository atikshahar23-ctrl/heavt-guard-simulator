import { Router, type IRouter } from "express";
import { fetchStockQuotes, buildStockRecommendations, fetchStockKlines } from "../lib/stocks";
import {
  GetStocksResponse,
  GetStockRecommendationsResponse,
  GetStockKlinesResponse,
  GetStockKlinesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

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

export default router;
