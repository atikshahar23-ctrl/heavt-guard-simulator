---
name: lightweight-charts v5 quirks
description: v5 API change + the "Object is disposed" ResizeObserver crash and how it's handled
---

# v5 API

Use `chart.addSeries(CandlestickSeries, opts)` / `chart.addSeries(AreaSeries, opts)` —
the old `addCandlestickSeries()` / `addAreaSeries()` helpers were removed in v5. Use
`ColorType.Solid` for solid backgrounds. Klines come from `data-api.binance.vision`
(non-geo-blocked).

# "Object is disposed" crash (runtime-error overlay)

**Symptom:** an uncaught `Error: Object is disposed` with a stack through
`DevicePixelContentBoxBinding.resizeCanvasElement` → `TimeAxisWidget._internal_setSizes`.
Surfaces as a Replit runtime-error overlay the user perceives as a crash. Fires on
chart unmount/remount (tab switch, symbol change, navigation), and also during HMR.

**Root cause:** lightweight-charts has its OWN internal ResizeObserver
(`DevicePixelContentBoxBinding`) that can fire one last queued callback AFTER
`chart.remove()`. That throw happens inside the library, so a try/catch around your own
`applyOptions` call can NOT catch it.

**Two-layer fix (both needed):**
1. In every chart effect, guard your own ResizeObserver: a `let disposed = false` flag
   set true in cleanup before `chart.remove()`, checked at the top of the callback, plus
   a try/catch around `applyOptions`. Handles the case where YOUR observer is the caller.
2. A global suppressor in `main.tsx` (capture-phase `error` + `unhandledrejection`
   listeners) that calls `preventDefault()`/`stopImmediatePropagation()` ONLY when the
   message includes "Object is disposed" AND the stack includes "lightweight-charts".
   This catches the throw from the library's INTERNAL observer, which layer 1 can't.

**Why:** without layer 2 the benign internal-observer throw still hits the overlay; the
narrow message+stack match keeps all other real errors propagating normally.
