import {
  pgTable,
  text,
  jsonb,
  integer,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";

/**
 * Per-user client-owned state, stored one ROW PER SLOT (wallets / autotrader /
 * favorites / onboarding). The server treats `data` as an opaque JSON blob — it
 * never interprets the shape, which is fully owned by the frontend contexts.
 *
 * `version` powers optimistic concurrency: a writer sends the version it based
 * its edit on; the update only applies when the stored version still matches,
 * otherwise the caller gets the current server snapshot back (409) and resolves.
 *
 * Per-slot rows (rather than one big row) give each context its own independent
 * save loop, so a wallets write can never clobber a concurrent favorites toggle.
 */
export const userState = pgTable(
  "user_state",
  {
    userId: text("user_id").notNull(),
    slot: text("slot").notNull(),
    data: jsonb("data").notNull(),
    version: integer("version").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.slot] })],
);

export type UserStateRow = typeof userState.$inferSelect;
