---
name: Funding Arb Agent (delta-neutral paper model)
description: How the cash-and-carry funding paper-trading strategy models capital and PnL, and how it plugs into the bot fleet.
---

# Funding Arb Agent — paper model

A delta-neutral cash-and-carry strategy in crypto-arb. A position is one logical
pair (base leg + opposite perp leg) that only ever earns simulated funding.

**Rule:** capital deployed = `notionalPerLeg` (debited from cash at open); there
is NO directional price PnL — the pair is assumed delta-neutral. Funding accrues
unrealized in-position and realizes to cash on close. Closed trade is type
`FUNDING`.

**Why:** the whole point is to isolate the funding carry for education; mixing in
mark-to-market price PnL would defeat the delta-neutral teaching framing and make
the "scenario" misleading.

**How to apply:**
- Accrual must be idempotent: advance `lastAccrualAt` each tick and only credit
  the elapsed window. A timer that re-runs must never double-count.
- Any new fleet-wide operation (kill-switch/flatten, close-all-bots, reset,
  wallet open-position counts, "Bots Active N/total") must be updated for funding
  positions in lockstep — they live in their own `fundingPositions` array, not in
  `binancePositions`/`stockPositions`.
- Bot-attributed "open" counts must be source-scoped (`source === "Funding Arb
  Agent"`), not `fundingPositions.length`, or manual funding positions opened from
  the page inflate the bot's telemetry.
- The engine is headless and gated on its own per-bot flag (mirrors the other
  extra bots), honoring cash floor + cooldown + max-open + min-annualized.
