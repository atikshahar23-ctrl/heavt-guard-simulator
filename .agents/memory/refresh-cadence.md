---
name: Refresh cadence coupling (frontend poll vs server cache)
description: Why stock refetchInterval and the server stock cache TTL must stay aligned
---

# Refresh cadence coupling

The stocks/recommendations endpoints in `artifacts/api-server` serve from an
in-memory cache (`stocks.ts` → `CACHE_TTL_MS`). The crypto-arb frontend polls
via React Query `refetchInterval`.

**Rule:** the frontend poll interval should be >= the server cache TTL. If the
frontend polls faster than the cache TTL, the extra polls just re-return the
same cached payload (same `fetchedAt`), so "live" feels stale.

**Why:** during round-2 we set frontend stock polling to 30s but the server
cache was 60s, so users saw unchanged data for two cycles. Fixed by lowering
`CACHE_TTL_MS` to 30s to match.

**How to apply:** if you change either the frontend `refetchInterval` for
stocks/recommendations or the server `CACHE_TTL_MS`, change both in lockstep
(or make the server TTL <= the frontend interval). Binance is independent
(separate path, 5s frontend).
