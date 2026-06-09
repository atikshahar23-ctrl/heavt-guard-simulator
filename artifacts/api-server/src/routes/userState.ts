import express, {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { getAuth } from "@clerk/express";
import { and, eq, sql } from "drizzle-orm";
import { db, userState } from "@workspace/db";
import {
  GetUserStateResponse,
  PutUserStateParams,
  PutUserStateBody,
  PutUserStateResponse,
} from "@workspace/api-zod";
import { makeRateLimiter } from "../lib/rateLimiter";

const router: IRouter = Router();

/**
 * Per-user write limiter: 30 saves/min keyed by Clerk user id. Falls back to IP
 * for unauthenticated callers (who are rejected anyway). This is stricter than
 * and additional to the global 120/min-per-IP admission control in app.ts.
 */
const userStateWriteLimit = makeRateLimiter(
  30,
  60_000,
  "Too many state saves, please slow down.",
  (req) => getAuth(req).userId ?? req.ip ?? "unknown",
);

/**
 * Per-user read limiter for hydration GETs: 60/min keyed by Clerk user id
 * (falls back to IP). /api/user-state is exempted from the shared per-IP
 * admission control in app.ts so a page-load burst against the expensive
 * fan-out routes can't starve hydration; this keeps the read protected on its
 * own, generous per-user budget. The GET is a single indexed per-user lookup.
 */
const userStateReadLimit = makeRateLimiter(
  60,
  60_000,
  "Too many state reads, please slow down.",
  (req) => getAuth(req).userId ?? req.ip ?? "unknown",
);

/**
 * Route-scoped body parser with a larger cap for the snapshot blobs. The global
 * parser caps at 100kb and skips this path (see app.ts), so this is the only
 * place /api/user-state bodies get parsed. Wrapped as a normal middleware (not a
 * 4-arg Express error handler) so it converts parser failures into clean JSON
 * without breaking handler-type inference for the rest of the route chain.
 */
const jsonBody = express.json({ limit: "2mb" });

function parseStateBody(req: Request, res: Response, next: NextFunction): void {
  jsonBody(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err && typeof err === "object" && "type" in err) {
      const type = (err as { type?: string }).type;
      if (type === "entity.too.large") {
        res.status(413).json({ error: "State payload too large" });
        return;
      }
      if (type === "entity.parse.failed") {
        res.status(400).json({ error: "Invalid JSON body" });
        return;
      }
    }
    next(err);
  });
}

router.get("/user-state", userStateReadLimit, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const rows = await db
      .select()
      .from(userState)
      .where(eq(userState.userId, userId));

    const entries = rows.map((r) => ({
      slot: r.slot,
      data: r.data,
      version: r.version,
      updatedAt: r.updatedAt.toISOString(),
    }));

    res.json(GetUserStateResponse.parse(entries));
  } catch (err) {
    req.log.error({ err }, "Failed to load user state");
    res.status(500).json({ error: "Failed to load saved state" });
  }
});

router.put(
  "/user-state/:slot",
  userStateWriteLimit,
  parseStateBody,
  async (req, res): Promise<void> => {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const params = PutUserStateParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Unknown state slot" });
      return;
    }
    const slot = params.data.slot;

    const body = PutUserStateBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const { data, baseVersion } = body.data;

    // The blob is opaque, but it must be a JSON object/array — never a bare
    // primitive — so it round-trips cleanly through jsonb.
    if (typeof data !== "object" || data === null) {
      res.status(400).json({ error: "State data must be an object or array" });
      return;
    }

    try {
      // Optimistic-concurrency upsert: insert a brand-new slot at version 1, or
      // bump an existing slot ONLY when its stored version still matches
      // baseVersion. A stale baseVersion updates zero rows → we report 409.
      const [updated] = await db
        .insert(userState)
        .values({ userId, slot, data, version: 1 })
        .onConflictDoUpdate({
          target: [userState.userId, userState.slot],
          set: {
            data,
            version: sql`${userState.version} + 1`,
            updatedAt: sql`now()`,
          },
          setWhere: eq(userState.version, baseVersion),
        })
        .returning({
          version: userState.version,
          updatedAt: userState.updatedAt,
        });

      if (updated) {
        res.json(
          PutUserStateResponse.parse({
            slot,
            version: updated.version,
            updatedAt: updated.updatedAt.toISOString(),
          }),
        );
        return;
      }

      // No row written → version conflict. Return the current server snapshot
      // (409) so the client can resolve: an active tab re-saves with the new
      // version (last-write-wins), a background tab adopts server state.
      const [current] = await db
        .select()
        .from(userState)
        .where(and(eq(userState.userId, userId), eq(userState.slot, slot)));

      if (!current) {
        res.status(409).json({
          slot,
          data: {},
          version: 0,
          updatedAt: new Date(0).toISOString(),
        });
        return;
      }

      res.status(409).json({
        slot: current.slot,
        data: current.data,
        version: current.version,
        updatedAt: current.updatedAt.toISOString(),
      });
    } catch (err) {
      req.log.error({ err, slot }, "Failed to save user state");
      res.status(500).json({ error: "Failed to save state" });
    }
  },
);

export default router;
