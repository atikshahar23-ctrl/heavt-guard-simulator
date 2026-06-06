---
name: Render perf boundaries (crypto-arb)
description: Which hot-path computations must stay un-memoized vs safe to memoize, given the 250ms live-price re-render cadence.
---

# Render performance boundaries

The app re-renders ~4x/sec because many components subscribe to the live-price
context (useSyncExternalStore, 250ms throttle). When optimizing, respect these
boundaries:

- **autotrader-engine `priceMap` must NOT be memoized.** It overlays sub-second
  live crypto prices (`getLivePrice`) onto the polled overview/stocks data and
  feeds the SL/TP + trailing-stop pipeline. It is intentionally rebuilt every
  render so mark-to-market stays current.
  **Why:** memoizing on `[overview, stocks, binancePositions]` would freeze out
  the live-price updates between polls (getLivePrice's reference is stable, so
  useMemo never re-runs), silently degrading SL/TP responsiveness — the whole
  point of the live layer. The rebuild cost (~few dozen iterations) is trivial.
  **How to apply:** if a future "optimization" wraps priceMap in useMemo, revert
  it. Same rule for any derived value that must reflect live prices each tick.

- **Safe to memoize:** purely data-derived values keyed on react-query results
  (e.g. ticker-tape indices/centralStocks, dashboard btcAsset/filteredMarkets/
  top3/winRate). These only change when the underlying query data changes, so
  memoizing them removes wasted work on the 250ms cadence without staleness.

- **Route-level code splitting:** pages are React.lazy() in App.tsx with a
  Suspense fallback; Dashboard stays eager as the landing route.
