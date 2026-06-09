import type { Request, Response, NextFunction } from "express";

interface WindowEntry {
  count: number;
  resetAt: number;
}

/**
 * Simple fixed-window in-memory rate limiter.
 *
 * @param maxRequests  Maximum requests per window per key
 * @param windowMs     Window duration in milliseconds
 * @param message      Error message returned on 429
 * @param keyFn        Derives the bucket key from the request. Defaults to the
 *                     client IP (resolved from the trusted proxy chain). Pass a
 *                     custom function to bucket by authenticated user id, etc.
 */
export function makeRateLimiter(
  maxRequests: number,
  windowMs: number,
  message = "Too many requests, please slow down.",
  keyFn: (req: Request) => string = (req) => req.ip ?? "unknown",
) {
  const windows = new Map<string, WindowEntry>();

  // Prune stale entries every 5 minutes so the map doesn't grow without bound.
  const pruneInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of windows) {
      if (now > entry.resetAt) windows.delete(key);
    }
  }, 5 * 60 * 1000).unref();

  // Allow the process to exit cleanly even if the interval is pending.
  void pruneInterval;

  return function rateLimiterMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    // Use req.ip by default, which Express resolves from the trusted proxy
    // chain when "trust proxy" is configured in app.ts. Never parse
    // X-Forwarded-For manually — doing so lets any caller spoof their IP and
    // bypass limits.
    const ip = keyFn(req);

    const now = Date.now();
    let entry = windows.get(ip);

    if (!entry || now > entry.resetAt) {
      entry = { count: 1, resetAt: now + windowMs };
      windows.set(ip, entry);
      next();
      return;
    }

    entry.count += 1;
    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      res.setHeader("X-RateLimit-Limit", String(maxRequests));
      res.setHeader("X-RateLimit-Remaining", "0");
      res.status(429).json({ error: message });
      return;
    }

    res.setHeader("X-RateLimit-Limit", String(maxRequests));
    res.setHeader("X-RateLimit-Remaining", String(maxRequests - entry.count));
    next();
  };
}

/** Global limiter: 120 requests per minute per IP. */
export const globalRateLimit = makeRateLimiter(120, 60_000);

/**
 * Strict limiter for expensive fan-out endpoints: 12 requests per minute per
 * IP. Each such request triggers dozens of outbound upstream calls, so even a
 * modest attacker-rate can saturate both the server and third-party quotas.
 */
export const expensiveRateLimit = makeRateLimiter(
  12,
  60_000,
  "This endpoint is rate-limited. Please wait before retrying.",
);
