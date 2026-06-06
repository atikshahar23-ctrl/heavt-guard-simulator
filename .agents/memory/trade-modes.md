---
name: Fleet trade modes (NORMAL / CALCULATED / SHLOMI)
description: How the fleet-wide trade-mode temperament layers over the intensity gear, and the leverage-cap gotcha for SHLOMI.
---

# Fleet trade modes

`TradeMode` is a fleet-wide temperament applied on top of the 1-5 intensity gear, affecting EVERY bot at once. Modes: NORMAL (gear alone), CALCULATED (patient/long-term), SHLOMI ("מצב שלומי" — the most extreme patient, ultra-selective, quality-over-quantity trader).

Mode multipliers live in one table (`TRADE_MODE_MULTS`) consumed by `intensityProfile(level, mode)`; both engines read the resolved profile, so adding/tuning a mode is centralized there.

## SHLOMI leverage-cap gotcha
**Rule:** SHLOMI hard-caps leverage low (`SHLOMI_MAX_LEVERAGE`), and this cap must be enforced in BOTH branches of `resolveSizing`.

**Why:** `resolveSizing` returns early when `dynamicCapitalEnabled` (Account Manager) is on. A cap applied only to the static path silently does nothing under dynamic/auto-pilot sizing, violating the mode's defining low-leverage intent.

**How to apply:** Any mode-level constraint (leverage, etc.) belongs after the dynamic `computeDynamicSizing` result too, not just in the static-settings path. The cap also intentionally overrides the global leverage slider.
