import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq, and } from "drizzle-orm";
import { db, userState } from "@workspace/db";
import { logger } from "../lib/logger";
import { makeRateLimiter } from "../lib/rateLimiter";
import { encryptCredential, decryptCredential, signBinance } from "../lib/crypto";

const router: IRouter = Router();

const writeLimit = makeRateLimiter(
  10,
  60_000,
  "Too many credential saves, please slow down.",
  (req) => getAuth(req).userId ?? req.ip ?? "unknown",
);

// Each GET below makes a signed call out to Binance, so bound how often a
// single user can trigger that fan-out.
const readLimit = makeRateLimiter(
  30,
  60_000,
  "Too many requests, please slow down.",
  (req) => getAuth(req).userId ?? req.ip ?? "unknown",
);

const BINANCE_SPOT_BASE = "https://api.binance.com";

/** Fetch the user's stored Binance credentials (decrypted). */
async function getCredentials(userId: string): Promise<{ apiKey: string; secret: string } | null> {
  const rows = await db
    .select()
    .from(userState)
    .where(and(eq(userState.userId, userId), eq(userState.slot, "binance_credentials")));
  if (rows.length === 0) return null;
  const data = rows[0].data as { key?: { c: string }; secret?: { c: string } } | null;
  if (!data?.key?.c || !data?.secret?.c) return null;
  const apiKey = decryptCredential(data.key);
  const secret = decryptCredential(data.secret);
  if (!apiKey || !secret) return null;
  return { apiKey, secret };
}

/** Masked display helper. */
function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

// ── GET /api/user/binance/credentials ──
router.get("/user/binance/credentials", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const creds = await getCredentials(userId);
  if (!creds) {
    res.json({ connected: false, key: null });
    return;
  }

  res.json({ connected: true, key: maskKey(creds.apiKey) });
});

// ── PUT /api/user/binance/credentials ──
router.put("/user/binance/credentials", writeLimit, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { apiKey, secret } = req.body ?? {};
  if (!apiKey || typeof apiKey !== "string" || !secret || typeof secret !== "string") {
    res.status(400).json({ error: "apiKey and secret are required" });
    return;
  }

  // Validate credentials by making a lightweight test call to Binance
  const testOk = await validateCredentials(apiKey, secret);
  if (!testOk) {
    res.status(400).json({ error: "Invalid API key or secret — Binance rejected the test call" });
    return;
  }

  const encrypted = {
    key: encryptCredential(apiKey),
    secret: encryptCredential(secret),
  };

  try {
    // Upsert into user_state (same slot model as the rest of the app)
    await db
      .insert(userState)
      .values({
        userId,
        slot: "binance_credentials",
        data: encrypted,
        version: 1,
      })
      .onConflictDoUpdate({
        target: [userState.userId, userState.slot],
        set: { data: encrypted, version: 1 },
      });

    res.json({ connected: true, key: maskKey(apiKey) });
  } catch (err) {
    logger.error({ err, userId }, "Failed to save Binance credentials");
    res.status(500).json({ error: "Failed to save credentials" });
  }
});

// ── DELETE /api/user/binance/credentials ──
router.delete("/user/binance/credentials", writeLimit, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    await db
      .delete(userState)
      .where(and(eq(userState.userId, userId), eq(userState.slot, "binance_credentials")));
    res.json({ connected: false });
  } catch (err) {
    logger.error({ err, userId }, "Failed to delete Binance credentials");
    res.status(500).json({ error: "Failed to delete credentials" });
  }
});

// ── GET /api/user/binance/balance ──
router.get("/user/binance/balance", readLimit, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const creds = await getCredentials(userId);
  if (!creds) {
    res.status(400).json({ error: "No Binance API credentials connected" });
    return;
  }

  const { apiKey, secret } = creds;
  const timestamp = Date.now();
  const params = `timestamp=${timestamp}`;
  const signature = signBinance(params, secret);

  try {
    const url = `${BINANCE_SPOT_BASE}/api/v3/account?${params}&signature=${signature}`;
    const response = await fetch(url, {
      headers: { "X-MBX-APIKEY": apiKey },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      logger.error({ status: response.status, text, userId }, "Binance balance fetch failed");
      res.status(502).json({ error: "Binance API returned an error", detail: text });
      return;
    }

    const data = (await response.json()) as {
      balances?: Array<{ asset: string; free: string; locked: string }>;
    };

    const balances = (data.balances ?? [])
      .map((b) => ({
        asset: b.asset,
        free: parseFloat(b.free),
        locked: parseFloat(b.locked),
        total: parseFloat(b.free) + parseFloat(b.locked),
      }))
      .filter((b) => b.total > 0);

    const totalUsdt = balances.find((b) => b.asset === "USDT")?.total ?? 0;

    res.json({ totalUsdt, balances: balances.sort((a, b) => b.total - a.total) });
  } catch (err) {
    logger.error({ err, userId }, "Binance balance fetch failed");
    res.status(502).json({ error: "Failed to fetch Binance balance" });
  }
});

// ── GET /api/user/binance/orders ──
router.get("/user/binance/orders", readLimit, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const creds = await getCredentials(userId);
  if (!creds) {
    res.status(400).json({ error: "No Binance API credentials connected" });
    return;
  }

  const { apiKey, secret } = creds;
  const timestamp = Date.now();
  const params = `timestamp=${timestamp}`;
  const signature = signBinance(params, secret);

  try {
    const url = `${BINANCE_SPOT_BASE}/api/v3/openOrders?${params}&signature=${signature}`;
    const response = await fetch(url, {
      headers: { "X-MBX-APIKEY": apiKey },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      logger.error({ status: response.status, text, userId }, "Binance orders fetch failed");
      res.status(502).json({ error: "Binance API returned an error", detail: text });
      return;
    }

    const orders = (await response.json()) as Array<{
      symbol: string;
      side: string;
      type: string;
      price: string;
      origQty: string;
      status: string;
    }>;

    res.json({
      orders: orders.map((o) => ({
        symbol: o.symbol,
        side: o.side,
        type: o.type,
        price: parseFloat(o.price),
        qty: parseFloat(o.origQty),
        status: o.status,
      })),
    });
  } catch (err) {
    logger.error({ err, userId }, "Binance orders fetch failed");
    res.status(502).json({ error: "Failed to fetch Binance orders" });
  }
});

/** Quick test call to validate credentials before storing. */
async function validateCredentials(apiKey: string, secret: string): Promise<boolean> {
  const timestamp = Date.now();
  const params = `timestamp=${timestamp}`;
  const signature = signBinance(params, secret);
  try {
    const url = `${BINANCE_SPOT_BASE}/api/v3/account?${params}&signature=${signature}`;
    const response = await fetch(url, {
      headers: { "X-MBX-APIKEY": apiKey },
      signal: AbortSignal.timeout(8_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export default router;
