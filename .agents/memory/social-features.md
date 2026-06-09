---
name: Social features (leaderboard / daily reward / referral)
description: Invariants for the server-authoritative social layer (top-traders, daily reward, referral) — what must hold, and why
---

# Social layer (leaderboard, daily reward, referral)

Server-authoritative per-user social state lives in its own table, separate from
the opaque client `user_state` slots. All social endpoints are auth-gated.

## Bonuses are deposits, never P&L
All reward money (daily + referral) is granted by the server as *credits* and
applied client-side as a **deposit** (cash + totalDeposited), not as trading
profit.
**Why:** a reward that looked like realized P&L would corrupt the equity-curve
baseline and win/loss stats — and the app is paper/educational, so it must never
imply returns.
**How to apply:** server only ever increments an unclaimed-credits ledger; the
client drains it (get credits → addFunds → ack). Never mutate a wallet from the
server.

## Referral eligibility is server-enforced, not client-trusted
"New user only" gating MUST be enforced on the server using the identity
provider's authoritative account-creation time — never a client timestamp or a
stashed flag.
**Why:** a client-only heuristic is trivially bypassed by calling the endpoint
directly, letting established accounts farm the bonus. A code review rejected
exactly this.
**How to apply:** in redeem, look up the account's real creation time and reject
if older than the signup window; the client stash is convenience only.

## Referral grant must be atomic across both users
Marking the referee redeemed and crediting both referrer and referee must happen
in a single DB transaction.
**Why:** the invariant is "both sides credited, or neither". A non-transactional
two-step grant can credit one side then fail, leaving the ledger inconsistent.
**How to apply:** wrap the conditional referee-mark + both credits in one
transaction; the referee mark stays conditional on not-yet-redeemed to also win
double-redeem races.

## Daily reward is one-claim-per-Israel-day
Gated once per **Asia/Jerusalem** calendar day, enforced server-side via a
conditional update (claim only writes when stored day ≠ today). Requires full
ICU (see replit.md gotcha). The client UI only mirrors this status.

## Leaderboard value
Ranking uses cash + committed capital (a stable, server-storable proxy), not live
mark-to-market. Display names must be privacy-safe — never the email.
