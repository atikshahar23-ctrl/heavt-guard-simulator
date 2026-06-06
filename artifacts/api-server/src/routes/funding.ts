import { Router, type IRouter } from "express";
import { expensiveRateLimit } from "../lib/rateLimiter";
import {
  buildFundingOpportunities,
  checkFundingAsset,
  backtestFundingAsset,
} from "../lib/funding-arb";
import {
  GetFundingOpportunitiesResponse,
  CheckFundingAssetQueryParams,
  CheckFundingAssetResponse,
  BacktestFundingAssetQueryParams,
  BacktestFundingAssetResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/funding/opportunities", expensiveRateLimit, async (req, res): Promise<void> => {
  try {
    const opps = await buildFundingOpportunities();
    res.json(GetFundingOpportunitiesResponse.parse(opps));
  } catch (err) {
    req.log.error({ err }, "Failed to build funding opportunities");
    res.status(502).json({ error: "Failed to fetch funding opportunities" });
  }
});

router.get("/funding/check", expensiveRateLimit, async (req, res): Promise<void> => {
  const query = CheckFundingAssetQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid asset" });
    return;
  }
  try {
    const result = await checkFundingAsset(query.data.asset);
    res.json(CheckFundingAssetResponse.parse(result));
  } catch (err) {
    req.log.error({ err }, "Failed to check funding asset");
    res.status(502).json({ error: "Failed to check funding asset" });
  }
});

router.get("/funding/backtest", expensiveRateLimit, async (req, res): Promise<void> => {
  const query = BacktestFundingAssetQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid asset" });
    return;
  }
  try {
    const result = await backtestFundingAsset(query.data.asset, query.data.hours ?? 168);
    res.json(BacktestFundingAssetResponse.parse(result));
  } catch (err) {
    req.log.error({ err }, "Failed to run funding backtest");
    res.status(502).json({ error: "Failed to run funding backtest" });
  }
});

export default router;
