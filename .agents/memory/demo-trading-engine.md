---
name: Demo-trading & Auto-Trader engine
description: How the crypto-arb paper-trading portfolio, its open/close API, and the headless Auto-Trader engine fit together — and the non-obvious stateRef contract.
---

# Demo trading

All paper trading lives in `portfolio-context` (localStorage `arb_scan_portfolio`, virtual balance). It exposes `open*/close*Position`, `checkSlTp`, `addFunds`, `resetPortfolio`, and a `tradeHistory: ClosedTrade[]`.

## stateRef contract (important)

The `open*Position` helpers validate synchronously against a `stateRef` mirror, **not** inside the `setState` updater.

**Why:** the old code set an `error` variable inside the `setState` updater and returned it immediately — that updater runs later, so the returned error was unreliable (callers saw `null` even on rejection). The Auto-Trader loop and quick-invest both depend on a trustworthy return value.

**How to apply:** `stateRef.current = state` is re-synced every render (so updater-based closes stay reflected) and is **optimistically advanced inside each open helper** so multiple opens within one synchronous tick (the Auto-Trader loop) see decremented cash before React commits. If you add a new mutation, keep this invariant: reads for validation come from `stateRef.current`; the actual mutation still goes through `setState(prev => ...)`.

# Auto-Trader

- Settings live in `autotrader-context` (localStorage `arb_scan_autotrader`).
- A single headless `AutoTraderEngine` is mounted once under the providers in `App.tsx`. It (1) runs global SL/TP checks from live overview prices for ALL open positions, and (2) opens auto-trades from scalp signals when enabled.
- Dedupe/safety: per-asset in-memory cooldown (cleared on reload), `openAssets` filter, local `availableCash` + `autoOpen` cap, plus the synchronous open-helper validation. Auto positions are tagged `auto: true` / `source`; closed trades carry `exit: MANUAL|SL|TP|LIQ` for the Trade History page.
- The auto-trade effect must keep `isFavorite` in its deps so `favoritesOnly` reacts to favorite toggles immediately.

# Risk pipeline & kill-switch

- Risk effect order is **trail → checkRiskGuards (LIQ) → checkSlTp → drawdown kill-switch**. The pre-liquidation guard must run *before* SL/TP so a position past its emergency loss threshold exits as `LIQ`, not as an ordinary `SL`. Reordering changes close semantics on severe losers.
- `flattenAll(prices)` (portfolio drawdown kill-switch) must compute its result **from `stateRef.current` before `setState`**, then `stateRef.current = next; setState(next)` — same contract as the open helpers. **Why:** the engine gates disarm on its return (`if (closed > 0) update({enabled:false})`); a count returned from inside a `setState` updater is unreliable, so the trader could flatten yet stay armed and re-open into the crash.
- Kill-switch fires only on large equity-peak drawdown where everything flattens anyway, so `flattenAll` overwriting any same-tick SL/TP/guard closes (plain-object setState replaces the updater result) is acceptable — the end state is "all closed" either way.

# Polymarket BTC auto-investor

- Reuses the existing `useGetShortTermMarkets` feed (no new endpoint); filters BTC same-day up/down markets client-side (`BTC_RE` on question + `endDate` within horizon). Directional bias comes from `overview` BTC `changePercent` (the 24h field is `changePercent`, **not** `change24h`). Buys YES/NO aligned with bias via `yesMeansUp()` title classifier, skips near-resolved odds (<0.1/>0.9), exits on TP/SL, 30-min per-condition cooldown. Bounded by `polyMaxOpenBets` + synchronous `openPolyPosition` cash validation.
