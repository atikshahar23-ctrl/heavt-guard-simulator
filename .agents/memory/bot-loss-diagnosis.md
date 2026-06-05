---
name: Bot loss diagnosis
description: Why the paper-trading bots kept booking large losses and tiny gains, and the durable risk principles that fix it.
---

# Bot loss diagnosis

Paper bots were taking outsized losses and undersized wins. Root causes were a
too-loose per-trade risk budget, leverage set far above what the strategy edge
justified, and bot entries that were sometimes opened with **no** stop-loss at all.

## The rules that fix it

- **Cap the per-trade risk budget tightly.** A bot must never be allowed to risk a
  large fraction of equity on one trade — the loss-per-trade percentage is the
  primary lever; keep it conservative.
- **Leverage must match the edge, not the ambition.** Defaults and the
  dynamic-sizing clamp (base + cap) should stay low. Recovery/streak logic must not
  push leverage back up into dangerous territory.
- **Every bot entry must carry an SL/TP.** If a signal gives none, set an explicit
  fallback (strategy-appropriate %). A position with no stop is the single biggest
  source of runaway losses.
- **Backstop legacy/no-SL positions with a stale-and-losing exit.** Close an auto
  position that is still losing after a minimum hold only when `!pos.slPrice`, so the
  backstop never fights a real stop on SL-bearing trades.

**Why:** asymmetric P&L (big losses, small gains) almost always traces to risk
sizing and missing stops, not to signal quality. Fixing sizing/stops is higher
leverage than tuning entries.

**How to apply:** when a bot's realized P&L skews negative, audit (1) loss-per-trade
budget, (2) effective leverage incl. dynamic/recovery paths, (3) whether every open
path sets a stop — before touching signal logic.
