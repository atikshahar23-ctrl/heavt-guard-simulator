---
name: Auto-Pilot & cancel light-speed (bots page)
description: How the Auto-Pilot master toggle and the "cancel light-speed" control behave, and why over-trading was a boost-only problem.
---

# Over-trading was BOOST-only, not a normal-mode bug
Every auto open-loop already blocks a 2nd position on an asset it already holds
(crypto `!openAssets`, stock `!openSymbols`, poly `!openConditions`, dip/breakout
`!openAssets`) and uses a long normal cooldown (crypto/stock 10min, poly 30min).
The "many trades flooding one position" feeling comes ONLY from BOOST / "light
speed" mode: it collapses cooldowns to ~4s and recycles tiny-tick profits.

**Why:** user reported flooding; the durable lesson is that the fix is to end
boost, NOT to add more guards or stop trading.

**How to apply:** "ביטול מהירות האור" = `stopBoost()` only — keep bots armed and
positions open (calm normal cadence). Keep the FULL kill (close all + disarm) as a
separate, less-prominent "עצירת חירום" button so the safety isn't lost.

# Auto-Pilot ("אוטומטי") is a convenience macro, not a new engine path
The toggle flips on `autoPilotEnabled` + `dynamicCapitalEnabled` + the whole
management stack (smartExit/trailing/adaptive/riskManager/alphaCoordinator/
catastrophicExit/dailyStop) and arms all bots in one click. Sizing/leverage/SL-TP
are then decided per trade by the existing `computeDynamicSizing` + recommendLevels
paths — no separate "auto" code path. Turning it off only clears the marker (leaves
tuned switches) to avoid a contradictory state.

**How to apply:** to make a bot loop respect Auto-Pilot sizing, just have it honor
`dynamicCapitalEnabled` (poly was the last loop wired this way). Paper-trading only;
never add win-rate/return promises.
