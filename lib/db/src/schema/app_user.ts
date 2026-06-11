import {
  pgTable,
  text,
  doublePrecision,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

/**
 * Per-user profile that powers the social/retention features (Top Traders
 * leaderboard, daily login reward, referral program). Keyed by the Clerk user
 * id. The simulator itself stays client-side (see `user_state`); this row only
 * holds the small slice of data that must be compared across users or enforced
 * server-side.
 *
 * - `walletValue` is the latest *reported* active-wallet value (cash + open
 *   position value). Because the simulator runs in the browser it is not
 *   tamper-proof — the server applies sane bounds and ignores implausible
 *   values, but does not attempt full anti-cheat.
 * - `lastClaimDate` is the Asia/Jerusalem calendar day (YYYY-MM-DD) of the last
 *   daily-reward claim, so a second claim on the same Israel day is rejected.
 * - `unclaimedCredits` is a server-side ledger of bonus dollars (daily reward +
 *   referral) not yet applied to the user's browser wallet. The client drains
 *   it on load and acknowledges, so a bonus is granted exactly once even if the
 *   browser is cleared between earning and applying it.
 */
export const appUser = pgTable("app_user", {
  userId: text("user_id").primaryKey(),
  /** Privacy-safe name shown on the leaderboard (never an email). */
  displayName: text("display_name").notNull().default("Trader"),
  /**
   * Admin-set name that overrides the user's self-reported `displayName` on the
   * leaderboard and in admin views. Set by the software manager via the admin
   * panel; `null` means "use the user's own `displayName`". Kept separate so the
   * user's periodic self-report (`/social/report`) never clobbers the override.
   */
  displayNameOverride: text("display_name_override"),
  /** Latest reported active-wallet value (paper dollars). */
  walletValue: doublePrecision("wallet_value").notNull().default(0),
  /** When walletValue was last reported. */
  walletReportedAt: timestamp("wallet_reported_at", { withTimezone: true }),
  /** Asia/Jerusalem calendar day (YYYY-MM-DD) of the last daily-reward claim. */
  lastClaimDate: text("last_claim_date"),
  /** Unique code used to build this user's referral link. */
  referralCode: text("referral_code").notNull().unique(),
  /** userId of whoever referred this user (set once, on redemption). */
  referredBy: text("referred_by"),
  /** True once this user has redeemed a referral as a referee (one per user). */
  referralRedeemed: boolean("referral_redeemed").notNull().default(false),
  /** Server-side ledger of bonus dollars not yet applied to the browser wallet. */
  unclaimedCredits: doublePrecision("unclaimed_credits").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertAppUserSchema = createInsertSchema(appUser);
export const selectAppUserSchema = createSelectSchema(appUser);

export type AppUserRow = typeof appUser.$inferSelect;
export type AppUserInsert = typeof appUser.$inferInsert;
