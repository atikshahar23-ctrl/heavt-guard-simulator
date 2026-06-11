---
name: Admin tooling & leaderboard name override
description: How the software-manager admin console gates access and why renames use a separate column.
---

# Admin tooling

Admin console (`/admin` page + `/api/admin/*` routes) is exclusive to a single
Clerk username (the software manager). Gating is **server-authoritative**: every
privileged route is behind a `requireAdmin` middleware that resolves the caller's
Clerk username and compares it; the client nav link and page gate are cosmetic
only. The gate caches *successful* lookups with a short TTL and fails closed
(Clerk error → 500, never grants).

## Leaderboard rename uses a SEPARATE column

Admin renames write `app_user.displayNameOverride`, NOT `displayName`.

**Why:** every client periodically self-reports its own name via
`/api/social/report`, which writes `displayName`. If an admin edited `displayName`
directly, the next self-report would silently clobber the edit. The override lives
in its own column so it survives self-reports.

**How to apply:** the public leaderboard (and any place that shows a user's name)
must read `COALESCE(displayNameOverride, displayName)`. An empty rename clears the
override (reverts to the user's self-reported name). If you add a new surface that
displays names, use the COALESCE form, not raw `displayName`.

## Per-user state exposure

`/admin/users/:userId/state` returns only the `wallets` / `autotrader` /
`performance` user_state slots. Never widen it to return the encrypted
`binance_credentials` slot. Regular `/user-state` routes stay self-scoped via the
caller's own Clerk id — only the admin route reads another user's rows.
