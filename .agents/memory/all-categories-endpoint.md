---
name: All-categories browse endpoint
description: Architecture of the /api/markets/all endpoint vs the crypto-only polymarket endpoint
---

## Two separate endpoints

1. **`/api/crypto/polymarket`** — crypto-only, uses `ASSET_PATTERNS[asset]` regex filter. For the Crypto Markets page and scan pipeline.
2. **`/api/markets/all`** — all categories (crypto, politics, sports, economy, tech, other). Uses `allCategories: true` flag which skips asset pattern matching. For the Live Markets browse page.

## Category filter
The `category` param on `/api/markets/all` maps to `CategoryFilter`: `ALL | CRYPTO | POLITICS | SPORTS | ECONOMY | TECH | OTHER`. Detected client-side via `detectCategory(question)` keyword regex.

## Scan pipeline stays crypto-only
`runScan()` and `buildRecommendations()` only call `fetchPolymarketMarkets({ asset, requireTargetPrice: true })` — crypto-only with price target requirement. Expanding to all categories would require Binance price data for non-crypto assets (not available in current setup).

**Why:** Keeping scan/recommendations crypto-only ensures every signal has a Binance mark price to compare against. The Browse page is read-only (no signal analysis), so it can safely show all 6000 markets.
