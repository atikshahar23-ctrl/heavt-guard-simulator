import express, {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { desc, eq, sql } from "drizzle-orm";
import { db, appUser, type AppUserRow } from "@workspace/db";
import {
  ReportWalletBody,
  ReportWalletResponse,
  GetLeaderboardResponse,
  GetDailyRewardResponse,
  ClaimDailyRewardResponse,
  GetReferralResponse,
  RedeemReferralBody,
  RedeemReferralResponse,
  GetCreditsResponse,
  AckCreditsBody,
  AckCreditsResponse,
} from "@workspace/api-zod";
import { makeRateLimiter } from "../lib/rateLimiter";

const router: IRouter = Router();

/** Fixed bonus amounts (paper dollars). */
const DAILY_REWARD = 500;
const REFERRAL_BONUS = 2000;

/**
 * Server-enforced "brand-new user" window for referral redemption. A referral
 * bonus may only be claimed by an account whose Clerk creation time is within
 * this window — established accounts cannot farm referral bonuses by calling the
 * API directly. The client-side stash heuristic is convenience only; this is the
 * authoritative gate.
 */
const REFERRAL_SIGNUP_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Sane server-side bound on a reported wallet value. The simulator runs in the
 * browser so values are not tamper-proof; we only reject clearly-impossible
 * numbers (negative / non-finite / absurdly large) rather than attempting full
 * anti-cheat (explicitly out of scope).
 */
const MAX_WALLET_VALUE = 1e12;

/**
 * Per-user write limiter for the social endpoints: 30 writes/min keyed by Clerk
 * user id (falls back to IP for unauthenticated callers, who are rejected
 * anyway). Additional to the global 120/min-per-IP admission control in app.ts.
 */
const socialWriteLimit = makeRateLimiter(
  30,
  60_000,
  "Too many requests, please slow down.",
  (req) => getAuth(req).userId ?? req.ip ?? "unknown",
);

/** Small JSON body parser scoped to the social POST routes (global parser skips /api/social). */
const jsonBody = express.json({ limit: "16kb" });

function parseSocialBody(req: Request, res: Response, next: NextFunction): void {
  jsonBody(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err && typeof err === "object" && "type" in err) {
      const type = (err as { type?: string }).type;
      if (type === "entity.too.large") {
        res.status(413).json({ error: "Payload too large" });
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

/** Today's calendar day (YYYY-MM-DD) in Asia/Jerusalem. */
function jerusalemDay(date = new Date()): string {
  // en-CA yields ISO-style YYYY-MM-DD. Full ICU (Node 24 default) is required
  // for the Asia/Jerusalem zone to resolve — see replit.md "Gotchas".
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Generate a short, URL-safe, human-friendly referral code. */
function newReferralCode(): string {
  // Crockford-ish alphabet (no ambiguous 0/O/1/I) for codes people may type.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

/**
 * Fetch the caller's profile row, creating it on first sight with a unique
 * referral code. Retries the insert a few times if a generated code happens to
 * collide with the unique constraint.
 */
async function ensureUser(userId: string): Promise<AppUserRow> {
  const existing = await db
    .select()
    .from(appUser)
    .where(eq(appUser.userId, userId));
  if (existing[0]) return existing[0];

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [created] = await db
        .insert(appUser)
        .values({ userId, referralCode: newReferralCode() })
        // If the row was created concurrently, do nothing and re-read below.
        .onConflictDoNothing({ target: appUser.userId })
        .returning();
      if (created) return created;

      const [row] = await db
        .select()
        .from(appUser)
        .where(eq(appUser.userId, userId));
      if (row) return row;
    } catch (err) {
      // Most likely a referral_code unique collision — try a fresh code.
      if (attempt === 4) throw err;
    }
  }
  throw new Error("Could not create user profile");
}

/** Build the absolute sign-up link carrying a referral code. */
function referralLink(req: Request, code: string): string {
  const proto = req.protocol;
  const host = req.get("host") ?? "";
  return `${proto}://${host}/?ref=${encodeURIComponent(code)}`;
}

/** POST /social/report — upsert display name + latest wallet value. */
router.post(
  "/social/report",
  socialWriteLimit,
  parseSocialBody,
  async (req, res): Promise<void> => {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const body = ReportWalletBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const displayName = body.data.displayName.trim().slice(0, 40) || "Trader";
    const raw = body.data.walletValue;
    const valid = Number.isFinite(raw) && raw >= 0 && raw <= MAX_WALLET_VALUE;

    try {
      const profile = await ensureUser(userId);
      // Always persist the display name; only persist the wallet value when it
      // passes the sanity bound (implausible values are silently ignored).
      const [updated] = await db
        .update(appUser)
        .set({
          displayName,
          ...(valid
            ? { walletValue: raw, walletReportedAt: sql`now()` }
            : {}),
          updatedAt: sql`now()`,
        })
        .where(eq(appUser.userId, userId))
        .returning();

      const row = updated ?? profile;
      res.json(
        ReportWalletResponse.parse({
          displayName: row.displayName,
          walletValue: row.walletValue,
          referralCode: row.referralCode,
        }),
      );
    } catch (err) {
      req.log.error({ err }, "Failed to report wallet");
      res.status(500).json({ error: "Failed to save profile" });
    }
  },
);

/** GET /social/leaderboard — top 10 by wallet value + caller's own rank. */
router.get("/social/leaderboard", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    await ensureUser(userId);

    const top = await db
      .select({
        userId: appUser.userId,
        // Admin-set override (set via the admin panel) wins over the user's own
        // self-reported name; falls back to the user's name when unset.
        displayName: sql<string>`COALESCE(${appUser.displayNameOverride}, ${appUser.displayName})`,
        walletValue: appUser.walletValue,
      })
      .from(appUser)
      .orderBy(desc(appUser.walletValue), appUser.userId)
      .limit(10);

    const entries = top.map((r, i) => ({
      rank: i + 1,
      displayName: r.displayName,
      walletValue: r.walletValue,
      isSelf: r.userId === userId,
    }));

    let self = entries.find((e) => e.isSelf) ?? null;
    if (!self) {
      // Caller is outside the top 10 — compute their dense rank by counting how
      // many users have a strictly greater wallet value.
      const [me] = await db
        .select({
          displayName: sql<string>`COALESCE(${appUser.displayNameOverride}, ${appUser.displayName})`,
          walletValue: appUser.walletValue,
        })
        .from(appUser)
        .where(eq(appUser.userId, userId));
      if (me) {
        const [{ ahead }] = await db
          .select({ ahead: sql<number>`count(*)::int` })
          .from(appUser)
          .where(sql`${appUser.walletValue} > ${me.walletValue}`);
        self = {
          rank: ahead + 1,
          displayName: me.displayName,
          walletValue: me.walletValue,
          isSelf: true,
        };
      }
    }

    res.json(GetLeaderboardResponse.parse({ entries, self }));
  } catch (err) {
    req.log.error({ err }, "Failed to load leaderboard");
    res.status(500).json({ error: "Failed to load leaderboard" });
  }
});

/** GET /social/daily-reward — claim status for today (Asia/Jerusalem). */
router.get("/social/daily-reward", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const profile = await ensureUser(userId);
    const today = jerusalemDay();
    res.json(
      GetDailyRewardResponse.parse({
        claimable: profile.lastClaimDate !== today,
        amount: DAILY_REWARD,
        lastClaimDate: profile.lastClaimDate ?? null,
      }),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to load daily reward status");
    res.status(500).json({ error: "Failed to load reward status" });
  }
});

/** POST /social/daily-reward/claim — claim once per Asia/Jerusalem day. */
router.post(
  "/social/daily-reward/claim",
  socialWriteLimit,
  async (req, res): Promise<void> => {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      await ensureUser(userId);
      const today = jerusalemDay();

      // Atomic claim: only credit + stamp the day when the stored day differs
      // from today. A same-day re-claim updates zero rows → alreadyClaimed.
      const [claimed] = await db
        .update(appUser)
        .set({
          lastClaimDate: today,
          unclaimedCredits: sql`${appUser.unclaimedCredits} + ${DAILY_REWARD}`,
          updatedAt: sql`now()`,
        })
        .where(
          sql`${appUser.userId} = ${userId} AND (${appUser.lastClaimDate} IS DISTINCT FROM ${today})`,
        )
        .returning({ userId: appUser.userId });

      if (claimed) {
        res.json(
          ClaimDailyRewardResponse.parse({
            claimed: true,
            alreadyClaimed: false,
            amount: DAILY_REWARD,
          }),
        );
        return;
      }

      res.json(
        ClaimDailyRewardResponse.parse({
          claimed: false,
          alreadyClaimed: true,
          amount: DAILY_REWARD,
        }),
      );
    } catch (err) {
      req.log.error({ err }, "Failed to claim daily reward");
      res.status(500).json({ error: "Failed to claim reward" });
    }
  },
);

/** GET /social/referral — caller's code, link and successful-referral count. */
router.get("/social/referral", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const profile = await ensureUser(userId);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(appUser)
      .where(eq(appUser.referredBy, userId));

    res.json(
      GetReferralResponse.parse({
        code: profile.referralCode,
        link: referralLink(req, profile.referralCode),
        referralCount: count,
      }),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to load referral info");
    res.status(500).json({ error: "Failed to load referral info" });
  }
});

/** POST /social/referral/redeem — one-time bonus to referrer + new user. */
router.post(
  "/social/referral/redeem",
  socialWriteLimit,
  parseSocialBody,
  async (req, res): Promise<void> => {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const body = RedeemReferralBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const code = body.data.code.trim().toUpperCase();

    try {
      const me = await ensureUser(userId);
      if (me.referralRedeemed) {
        res.json(
          RedeemReferralResponse.parse({
            redeemed: false,
            bonus: 0,
            reason: "כבר מימשת קוד הזמנה",
          }),
        );
        return;
      }

      // Server-enforced eligibility: only genuinely-new accounts may redeem.
      // Use Clerk's authoritative account creation time so an established
      // account can't farm the bonus by hitting this endpoint directly.
      const clerkUser = await clerkClient.users.getUser(userId);
      const accountAgeMs = Date.now() - (clerkUser.createdAt ?? 0);
      if (
        !clerkUser.createdAt ||
        accountAgeMs < 0 ||
        accountAgeMs > REFERRAL_SIGNUP_WINDOW_MS
      ) {
        res.json(
          RedeemReferralResponse.parse({
            redeemed: false,
            bonus: 0,
            reason: "קוד הזמנה זמין רק למשתמשים חדשים",
          }),
        );
        return;
      }

      const [referrer] = await db
        .select({ userId: appUser.userId })
        .from(appUser)
        .where(eq(appUser.referralCode, code));

      if (!referrer) {
        res.json(
          RedeemReferralResponse.parse({
            redeemed: false,
            bonus: 0,
            reason: "קוד הזמנה לא תקין",
          }),
        );
        return;
      }
      if (referrer.userId === userId) {
        res.json(
          RedeemReferralResponse.parse({
            redeemed: false,
            bonus: 0,
            reason: "לא ניתן להזמין את עצמך",
          }),
        );
        return;
      }

      // Credit both sides atomically. Marking the referee is conditional on
      // referralRedeemed=false (guards double-redeem races); the referrer credit
      // happens in the SAME transaction so a failure on either side rolls back
      // the whole grant — both users are credited, or neither is.
      const redeemed = await db.transaction(async (tx) => {
        const [marked] = await tx
          .update(appUser)
          .set({
            referralRedeemed: true,
            referredBy: referrer.userId,
            unclaimedCredits: sql`${appUser.unclaimedCredits} + ${REFERRAL_BONUS}`,
            updatedAt: sql`now()`,
          })
          .where(
            sql`${appUser.userId} = ${userId} AND ${appUser.referralRedeemed} = false`,
          )
          .returning({ userId: appUser.userId });

        if (!marked) return false;

        await tx
          .update(appUser)
          .set({
            unclaimedCredits: sql`${appUser.unclaimedCredits} + ${REFERRAL_BONUS}`,
            updatedAt: sql`now()`,
          })
          .where(eq(appUser.userId, referrer.userId));

        return true;
      });

      if (!redeemed) {
        res.json(
          RedeemReferralResponse.parse({
            redeemed: false,
            bonus: 0,
            reason: "כבר מימשת קוד הזמנה",
          }),
        );
        return;
      }

      res.json(
        RedeemReferralResponse.parse({
          redeemed: true,
          bonus: REFERRAL_BONUS,
          reason: null,
        }),
      );
    } catch (err) {
      req.log.error({ err }, "Failed to redeem referral");
      res.status(500).json({ error: "Failed to redeem referral" });
    }
  },
);

/** GET /social/credits — current unclaimed-credit balance. */
router.get("/social/credits", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const profile = await ensureUser(userId);
    res.json(
      GetCreditsResponse.parse({ unclaimedCredits: profile.unclaimedCredits }),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to load credits");
    res.status(500).json({ error: "Failed to load credits" });
  }
});

/** POST /social/credits/ack — decrement the ledger by the applied amount. */
router.post(
  "/social/credits/ack",
  socialWriteLimit,
  parseSocialBody,
  async (req, res): Promise<void> => {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const body = AckCreditsBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const amount = body.data.amount;
    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: "Invalid amount" });
      return;
    }

    try {
      await ensureUser(userId);
      // Decrement by the acked amount, clamped at 0 so concurrently-earned
      // credits are preserved and a stale/oversized ack can't go negative.
      const [updated] = await db
        .update(appUser)
        .set({
          unclaimedCredits: sql`GREATEST(0, ${appUser.unclaimedCredits} - ${amount})`,
          updatedAt: sql`now()`,
        })
        .where(eq(appUser.userId, userId))
        .returning({ unclaimedCredits: appUser.unclaimedCredits });

      res.json(
        AckCreditsResponse.parse({
          unclaimedCredits: updated?.unclaimedCredits ?? 0,
        }),
      );
    } catch (err) {
      req.log.error({ err }, "Failed to ack credits");
      res.status(500).json({ error: "Failed to ack credits" });
    }
  },
);

export default router;
