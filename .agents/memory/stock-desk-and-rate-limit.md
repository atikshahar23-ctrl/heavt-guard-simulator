---
name: Stock Desk & expensive rate limit
description: The single stock-trading window, its agent recommendations contract, and the 12/min expensive limiter that causes transient empty data in dev
---

# Stock Desk + expensive rate limit

`/stock-desk` is the one focused "חדר המסחר — מניות" window aggregating index strip, market pulse, an agent panel of ranked recommendations, sector heatmap, movers, news, and calendar. The agent's Hebrew rationale and educational entry/target/stop levels are generated CLIENT-side from the recommendation rows; the server rationale is English.

The recommendations endpoint guarantees a minimum count by backfilling: actionable BUY/SELL are ranked by |score| first, then strongest HOLD candidates are appended up to the minimum, capped at a max. So a flat market still yields a full list without changing the API shape.

**Why this matters for dev verification:** expensive stock/crypto endpoints sit behind a fixed-window limiter of **12 requests/min per IP** (`expensiveRateLimit`). In dev the preview proxy collapses all browser traffic to one IP, so rapid page reloads (e.g. back-to-back screenshots) PLUS any manual `curl` to `/api/stocks*` quickly trip it, returning 429 and rendering empty index/pulse/agent panels.

**How to apply:** if the stock desk shows zeros/empty after edits, do NOT loosen the limiter (it's a deliberate DoS control from the threat model). Wait ~60s for the fixed window to reset, avoid extra curl calls, then screenshot once. Normal single-tab polling (~3 req/min) is well under the limit.
