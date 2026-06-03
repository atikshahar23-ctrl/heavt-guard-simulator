import { Router, type IRouter } from "express";
import { fetchBinanceData, fetchAllBinanceData, fetchMarketOverview } from "../lib/binance";
import { fetchPolymarketMarkets, type AssetFilter, type CategoryFilter } from "../lib/polymarket";
import { fetchMarketMovers } from "../lib/movers";
import { fetchScalpSignals } from "../lib/scalp";
import { runScan, buildRecommendations } from "../lib/scanner";
import {
  GetBinanceDataQueryParams,
  GetBinanceDataResponse,
  GetBinanceMultiResponse,
  GetPolymarketMarketsQueryParams,
  GetPolymarketMarketsResponse,
  GetScanResultsQueryParams,
  GetScanResultsResponse,
  GetRecommendationsResponse,
  GetAllMarketsQueryParams,
  GetAllMarketsResponse,
  GetMarketMoversResponse,
  GetMarketOverviewResponse,
  GetScalpSignalsResponse,
  GetShortTermMarketsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/crypto/binance", async (req, res): Promise<void> => {
  const query = GetBinanceDataQueryParams.safeParse(req.query);
  const symbol = query.success ? (query.data.symbol ?? "BTCUSDT") : "BTCUSDT";

  try {
    const data = await fetchBinanceData(symbol);
    res.json(GetBinanceDataResponse.parse(data));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch Binance data");
    res.status(502).json({ error: "Failed to fetch Binance futures data" });
  }
});

router.get("/crypto/binance/multi", async (req, res): Promise<void> => {
  try {
    const data = await fetchAllBinanceData();
    res.json(GetBinanceMultiResponse.parse(data));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch multi Binance data");
    res.status(502).json({ error: "Failed to fetch Binance futures data" });
  }
});

router.get("/crypto/polymarket", async (req, res): Promise<void> => {
  const query = GetPolymarketMarketsQueryParams.safeParse(req.query);

  try {
    const markets = await fetchPolymarketMarkets({
      asset: (query.success ? query.data.asset : "ALL") as AssetFilter,
      search: query.success ? (query.data.search ?? undefined) : undefined,
      requireTargetPrice: false,
      filterResolved: false,
    });
    res.json(GetPolymarketMarketsResponse.parse(markets));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch Polymarket data");
    res.status(502).json({ error: "Failed to fetch Polymarket markets" });
  }
});

router.get("/crypto/scan", async (req, res): Promise<void> => {
  const query = GetScanResultsQueryParams.safeParse(req.query);

  try {
    const result = await runScan({
      asset: (query.success ? query.data.asset : "ALL") as AssetFilter,
      search: query.success ? (query.data.search ?? undefined) : undefined,
    });
    res.json(GetScanResultsResponse.parse(result));
  } catch (err) {
    req.log.error({ err }, "Scan failed");
    res.status(502).json({ error: "Scan failed — external API unavailable" });
  }
});

router.get("/crypto/recommendations", async (req, res): Promise<void> => {
  try {
    const recs = await buildRecommendations();
    res.json(GetRecommendationsResponse.parse(recs));
  } catch (err) {
    req.log.error({ err }, "Recommendations build failed");
    res.status(502).json({ error: "Failed to build recommendations" });
  }
});

router.get("/crypto/movers", async (req, res): Promise<void> => {
  try {
    const movers = await fetchMarketMovers();
    res.json(GetMarketMoversResponse.parse(movers));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch market movers");
    res.status(502).json({ error: "Failed to fetch market movers" });
  }
});

router.get("/crypto/overview", async (req, res): Promise<void> => {
  try {
    const overview = await fetchMarketOverview(50);
    res.json(GetMarketOverviewResponse.parse(overview));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch market overview");
    res.status(502).json({ error: "Failed to fetch market overview" });
  }
});

router.get("/crypto/scalp", async (req, res): Promise<void> => {
  try {
    const signals = await fetchScalpSignals({ interval: "15m", coins: 30 });
    res.json(GetScalpSignalsResponse.parse(signals));
  } catch (err) {
    req.log.error({ err }, "Failed to compute scalp signals");
    res.status(502).json({ error: "Failed to compute scalp signals" });
  }
});

router.get("/crypto/shortterm", async (req, res): Promise<void> => {
  try {
    const markets = await fetchPolymarketMarkets({
      allCategories: true,
      category: "CRYPTO",
      filterResolved: false,
      maxHoursToEnd: 48,
    });
    markets.sort((a, b) => {
      const ta = a.endDate ? new Date(a.endDate).getTime() : Infinity;
      const tb = b.endDate ? new Date(b.endDate).getTime() : Infinity;
      return ta - tb;
    });
    res.json(GetShortTermMarketsResponse.parse(markets));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch short-term markets");
    res.status(502).json({ error: "Failed to fetch short-term markets" });
  }
});

router.get("/markets/all", async (req, res): Promise<void> => {
  const query = GetAllMarketsQueryParams.safeParse(req.query);

  try {
    const category = (query.success ? (query.data.category ?? "ALL") : "ALL") as CategoryFilter;
    const search = query.success ? (query.data.search ?? undefined) : undefined;

    const markets = await fetchPolymarketMarkets({
      allCategories: true,
      category,
      search,
      requireTargetPrice: false,
      filterResolved: false, // Gamma API already returns only open/active markets
    });

    res.json(GetAllMarketsResponse.parse(markets));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch all markets");
    res.status(502).json({ error: "Failed to fetch markets" });
  }
});

export default router;
