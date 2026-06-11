import express, {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { getAuth } from "@clerk/express";
import { makeRateLimiter } from "../lib/rateLimiter";
import { SendTelegramMessageBody, SendTelegramMessageResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const telegramLimit = makeRateLimiter(
  20,
  60_000,
  "Too many Telegram requests. Please slow down.",
  (req) => getAuth(req).userId ?? req.ip ?? "unknown",
);

const jsonBody = express.json({ limit: "8kb" });

function parseBody(req: Request, res: Response, next: NextFunction): void {
  jsonBody(req, res, (err: unknown) => {
    if (!err) { next(); return; }
    if (err && typeof err === "object" && "type" in err) {
      const e = err as { type?: string };
      if (e.type === "entity.too.large") { res.status(413).json({ error: "Payload too large" }); return; }
      if (e.type === "entity.parse.failed") { res.status(400).json({ error: "Invalid JSON body" }); return; }
    }
    next(err);
  });
}

/**
 * POST /telegram/send
 *
 * Server-side proxy to the Telegram Bot API. The user supplies their own bot
 * token + chat ID (stored client-side). We never persist credentials.
 * Rate-limited to 20 sends/min per authenticated user.
 */
router.post("/telegram/send", telegramLimit, parseBody, async (req: Request, res: Response): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const parsed = SendTelegramMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { chatId, botToken, message } = parsed.data;

  if (message.length > 4096) {
    res.status(400).json({ error: "Message exceeds Telegram's 4096-character limit" });
    return;
  }

  // Validate token format: digits colon alphanum (35+ chars)
  if (!/^\d+:[A-Za-z0-9_-]{35,}$/.test(botToken)) {
    res.status(400).json({ error: "Invalid bot token format" });
    return;
  }

  try {
    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: message }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    const tgJson = await tgRes.json() as { ok: boolean; description?: string };

    if (!tgRes.ok || !tgJson.ok) {
      const errMsg = tgJson.description ?? "Telegram API error";
      req.log.warn({ chatId, errMsg }, "Telegram send rejected");
      res.status(502).json({ error: errMsg });
      return;
    }

    res.json(SendTelegramMessageResponse.parse({ ok: true }));
  } catch (err) {
    req.log.error({ err }, "Telegram send failed");
    res.status(502).json({ error: "Failed to reach Telegram API" });
  }
});

export default router;
