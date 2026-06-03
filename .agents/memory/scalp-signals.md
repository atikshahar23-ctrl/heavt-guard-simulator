---
name: Scalp signals architecture
description: How the fast-trade scalp signal engine computes entry/exit setups
---

## Rules

- **Universe**: top-N liquid USDT coins from `fetchMarketOverview()` (dynamic top-50 by quote volume from `data-api.binance.vision`, the non-geo-blocked mirror). Scalp defaults to 30 coins, 15m timeframe.
- **Indicators**: RSI(14), EMA(9/21), ATR(14), 20-bar swing high/low — all hand-rolled, no TA lib.
- **Signal**: bull/bear confluence scoring → LONG/SHORT/NEUTRAL. Entry = last close; stop = 1.5×ATR; target = 2.5×ATR (~1.7 R:R). Falls back to %-based stop/target when ATR is 0.
- **Robustness**: `fetchKlines()` drops non-finite/zero-close candles so indicator math never produces NaN that would fail the route's Zod `.parse()`. Per-symbol failures are caught and become `null` (filtered out), never poisoning the whole response.
- **Caching**: 60s in-memory cache keyed by `interval:coins`, plus in-flight promise coalescing so concurrent cold-cache requests share one upstream fan-out (~30 kline fetches at concurrency 8).
- `fetchKlines()` uses an 8s `AbortSignal.timeout` so a hung upstream can't stall the whole fan-out.

**Why:** A single bad candle or hung request used to be able to 502 the entire `/crypto/scalp` endpoint or duplicate ~30 upstream calls under cache expiry.
