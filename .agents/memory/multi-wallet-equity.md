---
name: Multi-wallet portfolio + equity curve
description: How portfolio-context supports multiple isolated wallets and how the per-wallet equity curve must be computed
---

# Multi-wallet portfolio refactor

The portfolio context holds `wallets[]` + `activeWalletId`, but the **active wallet's
fields stay exposed at the top level** and a `setState` wrapper routes every mutation to
the active wallet only. This keeps all existing open/close/SL-TP/guard helpers unchanged
(they still operate on a plain `PortfolioState`).

**Why:** lets the whole app keep treating the context as a single portfolio while
gaining create/rename/switch/delete + isolation, with zero changes to the dozens of
existing consumers.

**How to apply:** any new mutation helper should just call the wrapped `setState` — do
NOT thread a wallet id through it. The global auto-trader intentionally operates on
whichever wallet is active.

# Equity-curve math (the non-obvious bug)

For a per-wallet realized-equity progress graph, the baseline must be
`base = totalDeposited`, then step the line by each closed trade's realized PnL so the
final point = `totalDeposited + realizedPnl`.

**Why:** an earlier version used `base = totalDeposited - realized`, which forces the
final plotted value to always equal `totalDeposited` (because base + realized cancels) —
a flat, meaningless curve regardless of actual profit/loss. Deposits aren't timestamped,
so treating `totalDeposited` as the starting equity is the correct simplification.
