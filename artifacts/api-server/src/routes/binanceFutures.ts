import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq, and } from "drizzle-orm";
import { db, userState } from "@workspace/db";
import { logger } from "../lib/logger";
import { makeRateLimiter } from "../lib/rateLimiter";
import { encryptCredential, decryptCredential, type EncryptedBlob } from "../lib/crypto";
import {
  type FuturesMode,
  type FuturesCreds,
  GeoBlockError,
  BinanceFuturesError,
  validateFutures,
  getFuturesBalance,
  setLeverage,
  placeMarketOrder,
  closePosition,
  closeAllPositions,
  syncFuturesPositions,
  toFuturesSymbol,
} from "../lib/binanceFutures";

const router: IRouter = Router();

const SLOT = "binance_futures";

const writeLimit = makeRateLimiter(
  20,
  60_000,
  "Too many requests, please slow down.",
  (req) => getAuth(req).userId ?? req.ip ?? "unknown",
);

// Order placement is the hottest path — bots can fire many opens. Keep it bounded
// but generous enough for an active fleet.
const orderLimit = makeRateLimiter(
  60,
  60_000,
  "Too many live orders, please slow down.",
  (req) => getAuth(req).userId ?? req.ip ?? "unknown",
);

// ── Stored shape ──────────────────────────────────────────────────────────────
interface EnvCred {
  key: EncryptedBlob;
  secret: EncryptedBlob;
  liveTradingEnabled: boolean;
}
interface FuturesCredData {
  liveMode: FuturesMode;
  testnet?: EnvCred;
  mainnet?: EnvCred;
}

function isMode(v: unknown): v is FuturesMode {
  return v === "testnet" || v === "mainnet";
}

async function loadData(userId: string): Promise<FuturesCredData> {
  const rows = await db
    .select()
    .from(userState)
    .where(and(eq(userState.userId, userId), eq(userState.slot, SLOT)));
  const data = rows[0]?.data as FuturesCredData | null;
  if (!data || !isMode(data.liveMode)) return { liveMode: "testnet" };
  return data;
}

async function saveData(userId: string, data: FuturesCredData): Promise<void> {
  await db
    .insert(userState)
    .values({ userId, slot: SLOT, data, version: 2 })
    .onConflictDoUpdate({
      target: [userState.userId, userState.slot],
      set: { data, version: 2 },
    });
}

/** Decrypt one environment's credentials, or null when not connected/usable. */
function decryptEnv(env: EnvCred | undefined): FuturesCreds | null {
  if (!env?.key?.c || !env?.secret?.c) return null;
  const apiKey = decryptCredential(env.key);
  const secret = decryptCredential(env.secret);
  if (!apiKey || !secret) return null;
  return { apiKey, secret };
}

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

interface EnvStatus {
  connected: boolean;
  liveTradingEnabled: boolean;
  key: string | null;
}
function envStatus(env: EnvCred | undefined): EnvStatus {
  const creds = decryptEnv(env);
  return {
    connected: !!creds,
    liveTradingEnabled: !!env?.liveTradingEnabled,
    key: creds ? maskKey(creds.apiKey) : null,
  };
}

function statusPayload(data: FuturesCredData) {
  return {
    liveMode: data.liveMode,
    testnet: envStatus(data.testnet),
    mainnet: envStatus(data.mainnet),
  };
}

/** Map a thrown Binance error to an HTTP response. */
function sendBinanceError(res: import("express").Response, err: unknown, userId: string, context: string): void {
  if (err instanceof GeoBlockError) {
    logger.warn({ userId, context }, "Binance Futures geo-blocked");
    res.status(451).json({ error: "GEO_BLOCK", detail: err.message });
    return;
  }
  if (err instanceof BinanceFuturesError) {
    logger.error({ userId, context, status: err.status, code: err.binanceCode }, "Binance Futures error");
    res.status(502).json({ error: "Binance Futures rejected the request", detail: err.message });
    return;
  }
  logger.error({ err, userId, context }, "Unexpected Binance Futures failure");
  res.status(502).json({ error: "Binance Futures request failed" });
}

/** Resolve the credentials for the user's active live mode, or null. */
async function activeCreds(
  userId: string,
): Promise<{ mode: FuturesMode; creds: FuturesCreds; enabled: boolean } | null> {
  const data = await loadData(userId);
  const env = data[data.liveMode];
  const creds = decryptEnv(env);
  if (!creds) return null;
  return { mode: data.liveMode, creds, enabled: !!env?.liveTradingEnabled };
}

// ── GET /api/user/binance/futures/credentials ──
router.get("/user/binance/futures/credentials", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const data = await loadData(userId);
  res.json(statusPayload(data));
});

// ── PUT /api/user/binance/futures/credentials ──
router.put("/user/binance/futures/credentials", writeLimit, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const { mode, apiKey, secret } = (req.body ?? {}) as { mode?: unknown; apiKey?: unknown; secret?: unknown };
  if (!isMode(mode)) {
    res.status(400).json({ error: "mode must be 'testnet' or 'mainnet'" });
    return;
  }
  if (!apiKey || typeof apiKey !== "string" || !secret || typeof secret !== "string") {
    res.status(400).json({ error: "apiKey and secret are required" });
    return;
  }

  try {
    const ok = await validateFutures(mode, { apiKey, secret });
    if (!ok) {
      res.status(400).json({ error: "Invalid API key or secret — Binance rejected the test call" });
      return;
    }
  } catch (err) {
    sendBinanceError(res, err, userId, "validate");
    return;
  }

  const data = await loadData(userId);
  data[mode] = {
    key: encryptCredential(apiKey),
    secret: encryptCredential(secret),
    // Saving fresh keys does not auto-enable live trading — the user must opt in.
    liveTradingEnabled: data[mode]?.liveTradingEnabled ?? false,
  };
  try {
    await saveData(userId, data);
    res.json(statusPayload(data));
  } catch (err) {
    logger.error({ err, userId }, "Failed to save Binance Futures credentials");
    res.status(500).json({ error: "Failed to save credentials" });
  }
});

// ── DELETE /api/user/binance/futures/credentials?mode=testnet ──
router.delete("/user/binance/futures/credentials", writeLimit, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const mode = req.query.mode;
  if (!isMode(mode)) {
    res.status(400).json({ error: "mode query param must be 'testnet' or 'mainnet'" });
    return;
  }
  const data = await loadData(userId);
  delete data[mode];
  try {
    await saveData(userId, data);
    res.json(statusPayload(data));
  } catch (err) {
    logger.error({ err, userId }, "Failed to delete Binance Futures credentials");
    res.status(500).json({ error: "Failed to delete credentials" });
  }
});

// ── PATCH /api/user/binance/futures/config ──
// Toggle the active live mode and/or enable/disable live trading for an env.
router.patch("/user/binance/futures/config", writeLimit, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const { liveMode, mode, liveTradingEnabled } = (req.body ?? {}) as {
    liveMode?: unknown;
    mode?: unknown;
    liveTradingEnabled?: unknown;
  };
  const data = await loadData(userId);

  if (liveMode !== undefined) {
    if (!isMode(liveMode)) {
      res.status(400).json({ error: "liveMode must be 'testnet' or 'mainnet'" });
      return;
    }
    data.liveMode = liveMode;
  }

  if (liveTradingEnabled !== undefined) {
    if (!isMode(mode)) {
      res.status(400).json({ error: "mode is required when toggling liveTradingEnabled" });
      return;
    }
    if (typeof liveTradingEnabled !== "boolean") {
      res.status(400).json({ error: "liveTradingEnabled must be a boolean" });
      return;
    }
    const env = data[mode];
    if (!env || !decryptEnv(env)) {
      res.status(400).json({ error: "Connect and validate an API key for this environment first" });
      return;
    }
    env.liveTradingEnabled = liveTradingEnabled;
  }

  try {
    await saveData(userId, data);
    res.json(statusPayload(data));
  } catch (err) {
    logger.error({ err, userId }, "Failed to update Binance Futures config");
    res.status(500).json({ error: "Failed to update config" });
  }
});

// ── GET /api/user/binance/futures/balance ──
router.get("/user/binance/futures/balance", orderLimit, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const active = await activeCreds(userId);
  if (!active) {
    res.status(400).json({ error: "No Binance Futures credentials connected for the active mode" });
    return;
  }
  try {
    const balance = await getFuturesBalance(active.mode, active.creds);
    res.json({ mode: active.mode, ...balance });
  } catch (err) {
    sendBinanceError(res, err, userId, "balance");
  }
});

// ── POST /api/user/binance/futures/order ──
router.post("/user/binance/futures/order", orderLimit, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const { symbol, side, quantity, leverage } = (req.body ?? {}) as {
    symbol?: unknown;
    side?: unknown;
    quantity?: unknown;
    leverage?: unknown;
  };
  if (typeof symbol !== "string" || !symbol) {
    res.status(400).json({ error: "symbol is required" });
    return;
  }
  if (side !== "BUY" && side !== "SELL") {
    res.status(400).json({ error: "side must be 'BUY' or 'SELL'" });
    return;
  }
  if (typeof quantity !== "number" || !(quantity > 0)) {
    res.status(400).json({ error: "quantity must be a positive number" });
    return;
  }

  const active = await activeCreds(userId);
  if (!active) {
    res.status(400).json({ error: "No Binance Futures credentials connected for the active mode" });
    return;
  }
  if (!active.enabled) {
    res.status(403).json({ error: "Live trading is disabled for the active mode" });
    return;
  }

  const sym = toFuturesSymbol(symbol);
  try {
    if (typeof leverage === "number" && leverage >= 1) {
      try {
        await setLeverage(active.mode, active.creds, sym, leverage);
      } catch (err) {
        // Leverage caps vary per symbol; a failure here shouldn't block the order.
        logger.warn({ userId, sym, err: (err as Error).message }, "setLeverage failed (non-fatal)");
      }
    }
    const order = await placeMarketOrder(active.mode, active.creds, { symbol: sym, side, quantity });
    res.json({ orderId: order.orderId, fillPrice: order.fillPrice, fillQty: order.fillQty });
  } catch (err) {
    sendBinanceError(res, err, userId, "order");
  }
});

// ── POST /api/user/binance/futures/order/close ──
router.post("/user/binance/futures/order/close", orderLimit, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const { symbol } = (req.body ?? {}) as { symbol?: unknown };
  if (typeof symbol !== "string" || !symbol) {
    res.status(400).json({ error: "symbol is required" });
    return;
  }
  const active = await activeCreds(userId);
  if (!active) {
    res.status(400).json({ error: "No Binance Futures credentials connected for the active mode" });
    return;
  }
  try {
    const orderId = await closePosition(active.mode, active.creds, toFuturesSymbol(symbol));
    res.json({ orderId, closed: orderId !== null });
  } catch (err) {
    sendBinanceError(res, err, userId, "close");
  }
});

// ── POST /api/user/binance/futures/close-all ──
router.post("/user/binance/futures/close-all", writeLimit, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const active = await activeCreds(userId);
  if (!active) {
    res.json({ closed: 0 });
    return;
  }
  try {
    const result = await closeAllPositions(active.mode, active.creds);
    res.json(result);
  } catch (err) {
    sendBinanceError(res, err, userId, "close-all");
  }
});

// ── GET /api/user/binance/futures/positions ──
router.get("/user/binance/futures/positions", orderLimit, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const active = await activeCreds(userId);
  if (!active) {
    res.json({ positions: [] });
    return;
  }
  try {
    const positions = await syncFuturesPositions(active.mode, active.creds);
    res.json({ positions });
  } catch (err) {
    sendBinanceError(res, err, userId, "positions");
  }
});

export default router;
