---
name: Hyperliquid funding history depth
description: How to fetch deep (multi-month/1y) funding history from Hyperliquid's capped API
---

Hyperliquid's public `fundingHistory` info call (keyless, not geo-blocked) returns
at most **500 rows per request**. Funding is hourly, so one call covers only
~20.8 days. To get deep history (90d / 1y) you must paginate FORWARD: start at the
window start, advance the cursor to `maxTime + 1ms` after each page, and stop on
any of — short page (<500 rows), no forward progress, cursor caught up to now, or
a page cap (DoS bound). Dedup pages by raw ms timestamp; on a page fetch error,
return what you already have rather than throwing so the chart degrades.

**Why:** a naive single call silently truncates to the most recent ~3 weeks, and
an unbounded loop would amplify fan-out against a rate-limited public endpoint.

**How to apply:** any "as far back as possible" funding/price history from
Hyperliquid (or similar row-capped venue APIs). Keep the page cap + the in-memory
TTL cache; the route stays behind the expensive rate limiter. 1y BTC ≈ 8760 points
≈ 18 paged calls.
