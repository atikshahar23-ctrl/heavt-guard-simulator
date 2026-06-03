---
name: Free no-key market data sources
description: Which external data APIs work without API keys for crypto/market data, and which don't
---

## Working (no key, used by /api/crypto/movers)

- **Fear & Greed Index**: `https://api.alternative.me/fng/?limit=1` — returns `data[0].value` (0-100) + `value_classification`.
- **Top gainers/losers**: `https://data-api.binance.vision/api/v3/ticker/24hr` — full 24h ticker array. Filter to `*USDT` pairs, exclude leveraged (`UP`/`DOWN`), require `quoteVolume > $30M` to drop illiquid noise, sort by `priceChangePercent`.
- **Trending coins**: `https://api.coingecko.com/api/v3/search/trending` — `coins[].item` has name/symbol/market_cap_rank/thumb.
- **News headlines**: `https://news.google.com/rss/search?q=...&hl=en-US&gl=US&ceid=US:en` — RSS XML, parse `<item>` blocks with regex. Titles end with ` - <source>`; strip it. Send a browser User-Agent header.

## NOT usable (do not retry these)

- CryptoCompare — now requires an API key.
- Reddit JSON — blocks datacenter IPs.
- CoinDesk RSS — redirects, unreliable.

**Why:** Project constraint is FREE-only, no paid API keys. These four were verified working; the failures waste time if re-attempted.

**How to apply:** New market-intelligence features should aggregate these in a server lib with an in-memory cache (movers.ts uses 3-min TTL) and `Promise.all` the sources so one slow/failing source doesn't block the rest (each fetch catches and returns empty/null).
