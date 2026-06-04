---
name: TradingView Pro chart overlay
description: How the free TradingView Advanced widget is integrated as a "pro" drawing mode alongside the native lightweight-charts, and the pipeline-gating rule it requires.
---

# TradingView "Pro" drawing mode

Both the crypto and stock charts expose a חי (live, native lightweight-charts demo) ↔ ✏ Pro toggle. Pro mode renders the free TradingView **Advanced Real-Time Chart** widget (no API key) as an absolute `z-20` overlay over the still-mounted native chart container. This gives native drawing/markup tools, indicators, the auto-TA gauge, and (via `allow_symbol_change: true`) charting of any TradingView symbol — which doubles as the "add more coins to chart" answer.

- Crypto TV symbol: `BINANCE:${asset}USDT`. Stock TV symbol: pass the stock's dot-form `tradingViewSymbol` (e.g. `BRK.B`), NOT the dash form, or TradingView won't resolve class shares.
- Widget config that matters: `locale: "he"`, `autosize: true` (responsive), `theme: "dark"`, `hide_side_toolbar: false` (drawing tools), `allow_symbol_change: true`.

**Rule:** When in pro mode, gate the native data pipelines off — crypto WS/polling effect early-returns on `mode === "pro"` (and has `mode` in deps); stock chart sets React Query `refetchInterval: false`. 
**Why:** the overlay leaves the native chart mounted underneath, so without gating you run a duplicate live stream (native WS + TV) the whole time pro mode is open — wasted network/CPU that scales badly with multiple charts.
**How to apply:** any future overlay-style chart swap must suspend the hidden layer's live updates, not just visually cover it.
