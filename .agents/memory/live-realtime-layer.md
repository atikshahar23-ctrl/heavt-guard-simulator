---
name: Live real-time price + chart layer
description: How sub-second crypto prices and live candles are streamed for free, and the interval-casing gotcha that breaks daily charts.
---

# Live real-time layer (zero-cost)

- Crypto live prices come from one shared browser WebSocket to Binance miniTicker (`live-price-context.tsx`), exposed via `useLivePrices()`/`useLivePrice()`. The AutoTrader engine overlays these over the polled overview priceMap so SL/TP/guards react near-instantly.
- Candlestick charts seed from REST (`data-api.binance.vision`) then switch to a per-symbol kline WebSocket; REST polling is only a fallback if the socket never opens.

## Binance interval casing gotcha
**The UI uses `"1D"` as the daily interval label, but Binance REST + WS endpoints require lowercase `"1d"`.**
**Why:** A `1D` value sent to the Binance kline REST/WS URL returns a 4xx, so the daily chart (initial load AND polling fallback) silently fails.
**How to apply:** Normalize before every Binance call — `const i = period === "1D" ? "1d" : period`. Use that normalized value for the WS subscribe URL, the initial `fetchKlines`, and the polling-fallback `fetchKlines`. Don't normalize for WS only.
