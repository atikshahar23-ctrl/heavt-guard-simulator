---
name: Performance analytics baseline
description: Which equity baseline drawdown/peak math must use, and the field that's easy to mismatch.
---

# Performance analytics baseline

- Drawdown and peak-equity math MUST use the wallet's `totalDeposited` (its actual
  deposit baseline), NOT a hardcoded `STARTING_BALANCE`. Multi-wallet portfolios
  start from different deposits, so a fixed constant produces wrong drawdown/peak.
- `trade.taPeakEquity` must render `drawdown.peak`, never `riskMetrics.avgCost` —
  the two are easy to silently swap and the UI won't error, it just shows a wrong
  number.

**Why:** both are silent-mismatch traps (no crash, just wrong analytics). Recorded
because they were each gotten wrong once.
