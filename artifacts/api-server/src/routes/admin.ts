import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { desc, eq, sql } from "drizzle-orm";
import { db, appUser, userState } from "@workspace/db";
import {
  AdminMeResponse,
  AdminUsersResponse,
  AdminUserStateResponse,
  AdminRenameBody,
  AdminRenameResponse,
} from "@workspace/api-zod";
import { makeRateLimiter } from "../lib/rateLimiter";

const router: IRouter = Router();

/**
 * The single software-manager account. Admin tooling (rename leaderboard names,
 * full transparency into every user's wallets/bots/trader) is gated to this
 * Clerk username server-side — the client UI gate is cosmetic only.
 */
const ADMIN_USERNAME = "atik.shahar.23";

/**
 * Cache of userId -> isAdmin so we don't call Clerk on every admin request.
 * Short TTL so a username change (grant/revoke) takes effect within minutes.
 * Only successful lookups are cached; a Clerk error surfaces as a 500 and is
 * retried on the next request rather than locking the admin out.
 */
const ADMIN_TTL_MS = 5 * 60 * 1000;
const adminCache = new Map<string, { isAdmin: boolean; expiresAt: number }>();

async function resolveIsAdmin(userId: string): Promise<boolean> {
  const now = Date.now();
  const cached = adminCache.get(userId);
  if (cached && cached.expiresAt > now) return cached.isAdmin;
  const user = await clerkClient.users.getUser(userId);
  const isAdmin = user.username === ADMIN_USERNAME;
  adminCache.set(userId, { isAdmin, expiresAt: now + ADMIN_TTL_MS });
  return isAdmin;
}

/**
 * Per-user limiter for admin endpoints: 60/min keyed by Clerk user id (falls
 * back to IP). Additional to the global 120/min-per-IP admission control.
 */
const adminLimit = makeRateLimiter(
  60,
  60_000,
  "Too many admin requests, please slow down.",
  (req) => getAuth(req).userId ?? req.ip ?? "unknown",
);

/** Reject anyone who is not the software manager (401 unauth, 403 non-admin). */
async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const ok = await resolveIsAdmin(userId);
    if (!ok) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  } catch (err) {
    req.log.error({ err }, "Admin gate check failed");
    res.status(500).json({ error: "Admin check failed" });
  }
}

/**
 * GET /admin/me — whether the caller is the software manager. Open to any
 * authenticated user; returns { isAdmin: false } for everyone else (leaks
 * nothing). The client uses this to decide whether to render admin UI.
 */
router.get("/admin/me", adminLimit, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const isAdmin = await resolveIsAdmin(userId);
    res.json(AdminMeResponse.parse({ isAdmin }));
  } catch (err) {
    req.log.error({ err }, "Failed to resolve admin status");
    res.status(500).json({ error: "Admin check failed" });
  }
});

/**
 * GET /admin/users — every user ranked by wallet value (no state blobs). The
 * per-user wallets/bots/trader detail is fetched lazily via /admin/users/:id/state
 * so this list response stays small.
 */
router.get(
  "/admin/users",
  adminLimit,
  requireAdmin,
  async (req, res): Promise<void> => {
    try {
      const rows = await db
        .select({
          userId: appUser.userId,
          displayName: appUser.displayName,
          displayNameOverride: appUser.displayNameOverride,
          walletValue: appUser.walletValue,
          walletReportedAt: appUser.walletReportedAt,
          referralCode: appUser.referralCode,
          referredBy: appUser.referredBy,
          createdAt: appUser.createdAt,
        })
        .from(appUser)
        .orderBy(desc(appUser.walletValue), appUser.userId);

      const users = rows.map((r, i) => ({
        rank: i + 1,
        userId: r.userId,
        displayName: r.displayName,
        displayNameOverride: r.displayNameOverride ?? null,
        effectiveName: r.displayNameOverride ?? r.displayName,
        walletValue: r.walletValue,
        walletReportedAt: r.walletReportedAt
          ? r.walletReportedAt.toISOString()
          : null,
        referralCode: r.referralCode,
        referredBy: r.referredBy ?? null,
        createdAt: r.createdAt.toISOString(),
      }));

      res.json(AdminUsersResponse.parse({ users }));
    } catch (err) {
      req.log.error({ err }, "Failed to load admin users");
      res.status(500).json({ error: "Failed to load users" });
    }
  },
);

/**
 * GET /admin/users/:userId/state — one user's opaque client-owned state blobs
 * (wallets, autotrader/trader, performance). Fetched on panel expand so the
 * list endpoint never has to carry every user's multi-MB snapshot.
 */
router.get(
  "/admin/users/:userId/state",
  adminLimit,
  requireAdmin,
  async (req, res): Promise<void> => {
    const rawId = req.params.userId;
    const targetId = typeof rawId === "string" ? rawId : "";
    if (!targetId) {
      res.status(400).json({ error: "Missing user id" });
      return;
    }
    try {
      const rows = await db
        .select({ slot: userState.slot, data: userState.data })
        .from(userState)
        .where(eq(userState.userId, targetId));

      const slots = new Map(rows.map((r) => [r.slot, r.data]));
      res.json(
        AdminUserStateResponse.parse({
          userId: targetId,
          wallets: slots.get("wallets") ?? null,
          autotrader: slots.get("autotrader") ?? null,
          performance: slots.get("performance") ?? null,
        }),
      );
    } catch (err) {
      req.log.error({ err }, "Failed to load admin user state");
      res.status(500).json({ error: "Failed to load user state" });
    }
  },
);

/**
 * POST /admin/users/rename — set (or clear) a user's leaderboard display name.
 * Writes `displayNameOverride` so the user's own periodic self-report can't
 * clobber it; an empty name clears the override (reverts to the user's own).
 */
router.post(
  "/admin/users/rename",
  adminLimit,
  requireAdmin,
  async (req, res): Promise<void> => {
    const body = AdminRenameBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const targetId = body.data.userId;
    const trimmed = body.data.displayName.trim().slice(0, 40);
    const override = trimmed.length > 0 ? trimmed : null;

    try {
      const [updated] = await db
        .update(appUser)
        .set({ displayNameOverride: override, updatedAt: sql`now()` })
        .where(eq(appUser.userId, targetId))
        .returning({
          userId: appUser.userId,
          displayName: appUser.displayName,
          displayNameOverride: appUser.displayNameOverride,
        });

      if (!updated) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json(
        AdminRenameResponse.parse({
          userId: updated.userId,
          displayName: updated.displayName,
          displayNameOverride: updated.displayNameOverride ?? null,
          effectiveName: updated.displayNameOverride ?? updated.displayName,
        }),
      );
    } catch (err) {
      req.log.error({ err }, "Failed to rename user");
      res.status(500).json({ error: "Failed to rename user" });
    }
  },
);

export default router;
