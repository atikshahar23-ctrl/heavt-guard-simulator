---
name: Polymarket fetcher architecture
description: How the Polymarket data fetching, caching, and filtering pipeline works
---

## Rules

- **Cache**: In-memory, 3-minute TTL. Single shared `_cachedPages` variable. All filter modes share the same raw page cache.
- **Pagination**: Fixed parallel fetch — `TOTAL_PAGES` pages of `PAGE_SIZE` each fetched together via `Promise.all` (currently 20 × 100 ≈ 2000 raw records). Not cursor-based.
- **Short-term filter**: `maxHoursToEnd` option keeps only markets whose end date is within N hours from now. For an all-crypto short-term feed (e.g. `/crypto/shortterm`) pass `allCategories: true` + `category: "CRYPTO"` so the 4-coin `ASSET_PATTERNS.ALL` regex doesn't drop valid markets (XRP, etc.).
- **Asset filter**: Word-boundary regex (e.g. `/\bETH\b/i`) to avoid false positives like "FiveThirtyEight". Defined in `ASSET_PATTERNS`.
- **All-categories mode**: Pass `allCategories: true` to `fetchPolymarketMarkets()` to skip the asset filter entirely and return all markets. Used by the `/api/markets/all` endpoint.
- **Category detection**: `detectCategory(question)` checks crypto first (most specific for this platform), then politics, sports, economy, tech, other.
- **Deep-link slug (CRITICAL)**: `https://polymarket.com/event/{slug}` needs the PARENT EVENT slug, NOT the market slug. The market's own `market_slug`/`slug` produces broken/404 links. Extract `eventSlug` from `events[0].slug` in the raw market object and use that for all polymarket.com/event URLs. Frontend stores `eventSlug` (not `slug`) when persisting demo-trade positions so their links resolve too.

**Why:** The crypto-only filter was causing the markets page to look sparse. Keeping crypto filter for scan/recommendations (performance + relevance) and all-categories for the Browse page gives both speed and completeness.
