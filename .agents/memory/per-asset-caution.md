---
name: Per-asset caution learning
description: How bots raise caution on coins they keep losing on, and why trade-fold dedupe must be persisted (not derived from wallet-scoped history)
---

# Per-asset caution

Bots track a per-coin scorecard (keyed by symbol, e.g. "BTC", "AAPL") and raise a
caution multiplier (1 → 1.8) on coins they keep losing on, demanding a stronger
setup before re-opening there. Caution NEVER drops below 1 — coins only ever get
*more* careful — so at caution=1 every gate is a true no-op vs. prior behavior.

## Dedupe must be persisted, not derived from tradeHistory

**Why:** `tradeHistory` from `usePortfolio` is **wallet-scoped** — switching the
active wallet swaps it for a different list. Seeding an in-memory "already counted"
set from the *current* wallet's history means another wallet's historical trades
look "new" on switch and get re-folded, inflating caution. A reload loses the
in-memory set entirely.

**How to apply:** the dedupe ledger lives in persisted `AutoTraderSettings`
(`recordedTradeIds`, FIFO-capped well above the 200/wallet history cap). The
recorder no-ops if the trade id is already in the ledger, else folds the stat and
appends the id. The engine effect seeds its in-memory guard from the persisted
ledger (not from tradeHistory) and passes the trade id through. Trade ids are
`crypto.randomUUID()` → globally unique, safe as dedupe keys. Any future per-entity
"fold each record once" logic over wallet-scoped data must dedupe on a persisted,
global id ledger — never by diffing the active wallet's list.

## Scope

Only AUTO crypto (BINANCE) and STOCK closes feed caution; Polymarket is excluded
(user said "coins"). A full `resetAssetStats()` clears learned stats but
intentionally keeps `recordedTradeIds`, so old closes don't immediately repopulate
caution — only new closes relearn.
