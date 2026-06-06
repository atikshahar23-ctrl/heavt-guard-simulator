---
name: JARVIS boost advisor
description: How JARVIS decides when activating "boost" (light-speed/max-cadence) is worthwhile and surfaces a clear alert.
---

# What it does
JARVIS detects a hot crypto window and proactively urges the user to engage boost
(the AutoTrader's max-cadence mode), recommends a duration, and offers one-tap
activation. It speaks the alert once per opportunity and shows a badge/bubble while
the panel is closed plus banners while open.

# Durable decisions
- **Heat signal = momentum surges + scalp confidence**, not price alone. Strong =
  momentum score≥70 & stage SURGING/HOT; plus HIGH/MEDIUM scalp signals and avg
  rvol. Duration tiers 15/30/60 min by heat. **Why:** boost only adds value when
  there are many fresh short-term opportunities to trade faster; calm markets just
  waste the run.
- **Share the generated query keys** (momentum/scalp) so React Query dedupes with
  the existing pages. **Why:** the threat model's top risk is upstream fan-out;
  JARVIS is always mounted, so a unique key here would double those polls fleet-wide.
- **One-tap activation goes through `useAutoTrader().startBoost(ms)`** — JARVIS must
  be inside `AutoTraderProvider` (it is, via Router→Layout). During Vite HMR you may
  see transient "useAutoTrader must be used inside AutoTraderProvider" from
  ExtraBotsEngine when the context module hot-swaps; it clears on full reload.
- **Anti-spam:** speak once per `level-duration` signature; after activating, mute
  re-alert ~30min; dismiss mutes ~8min. The closed-panel clock must tick even with
  zero tips or the mute window/alert won't refresh.
- Keep the educational/demo, no-profit-promise caveat in the alert copy.
