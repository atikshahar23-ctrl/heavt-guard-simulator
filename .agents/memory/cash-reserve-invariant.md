---
name: Account Manager cash reserve invariant
description: How the "never run the account to ~zero" cash floor is enforced for the auto-trading bots, and why per-loop checks alone are insufficient.
---

The Account Manager keeps a configurable % of equity (`cashFloorPct`) as free cash; bots must never open a trade that pushes free cash below that floor.

**Rule:** the floor must be enforced at the portfolio mutation boundary (the `open*` helpers in portfolio-context), checked against `stateRef.current.cash` (the live, synchronously-decremented snapshot), NOT only inside each bot's open-loop.

**Why:** each bot's effect loop reads the same `cash` snapshot from context at the start of a render cycle. Multiple loops (crypto / stocks / poly / dip / breakout / dca) can run in one tick; each can independently pass its own local `availableCash - stake >= floor` check using the stale snapshot and open, collectively breaching the floor. Only `stateRef.current.cash` reflects opens already applied earlier in the same tick.

**How to apply:** the open helpers take an optional `minCashReserve` (default 0) and reject with "Below cash reserve" when `stateRef.current.cash - cost < minCashReserve`. Engines still keep their per-loop gate (cheap early-out + avoids spamming attempts) AND pass the computed floor (`cashReserveFloor(totalDeposited, cashFloorPct)`) as the reserve arg. Sizing (`computeDynamicSizing`) sizes off *investable* cash above the floor and enters a recoveryMode (smaller size, leverage ≤3) when investable cash is thin.
