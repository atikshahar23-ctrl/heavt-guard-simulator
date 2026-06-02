import { Router, type IRouter } from "express";
import { fetchBinanceData } from "../lib/binance";
import { fetchBtcPolymarketMarkets } from "../lib/polymarket";
import { runScan } from "../lib/scanner";
import {
  GetBinanceDataQueryParams,
  GetBinanceDataResponse,
  GetPolymarketMarketsResponse,
  GetScanResultsResponse,
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

router.get("/crypto/polymarket", async (req, res): Promise<void> => {
  try {
    const markets = await fetchBtcPolymarketMarkets();
    res.json(GetPolymarketMarketsResponse.parse(markets));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch Polymarket data");
    res.status(502).json({ error: "Failed to fetch Polymarket markets" });
  }
});

router.get("/crypto/scan", async (req, res): Promise<void> => {
  try {
    const result = await runScan();
    res.json(GetScanResultsResponse.parse(result));
  } catch (err) {
    req.log.error({ err }, "Scan failed");
    res.status(502).json({ error: "Scan failed — external API unavailable" });
  }
});

export default router;
