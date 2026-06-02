---
name: Binance futures geo-block in deployment (HTTP 451)
description: Why crypto signals vanish in production but work in dev, and the spot-price fallback
---

# Binance futures geo-block (451)

The futures API host `fapi.binance.com` (premiumIndex → markPrice + funding
rate) returns **HTTP 451 "Unavailable For Legal Reasons"** from the deployment
region, while it works fine from the Replit dev container. Symptom: in
production the Trade Desk / recommendations show no crypto signals because the
scan crosses Binance mark prices with Polymarket and gets zero Binance prices.

**Fix:** `artifacts/api-server/src/lib/binance.ts` falls back to the public,
non-geo-blocked market-data mirror `data-api.binance.vision/api/v3/ticker/price`
when fapi fails (451 or network error). Spot price is a close proxy for the
futures mark price; funding rate is unavailable there so it is reported as 0.

**Why:** signals depend primarily on markPrice vs Polymarket target prices, so a
spot fallback restores them; the funding-rate column just shows 0 in blocked
regions.

**How to apply:**
- Dev still uses real futures data (fapi reachable), so funding rates are real
  locally — do not assume the fallback is exercised in dev.
- Any new Binance endpoint added must have the same non-geo-blocked fallback or
  it will silently break in production only.
- Changes to this file only reach the live site after a **republish**.
