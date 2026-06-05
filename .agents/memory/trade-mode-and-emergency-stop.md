---
name: Fleet trade-mode & emergency stop
description: How the fleet-wide CALCULATED trade mode and the speed-of-light emergency close are wired, and the price-map gotchas for closing all bot positions.
---

# Fleet-wide trade mode (NORMAL | CALCULATED)

A single fleet-wide temperament toggle layered on top of the intensity gear, read
by EVERY bot through one chokepoint: `intensityProfile(level, mode)` in
autotrader-context. CALCULATED multiplies the gear profile to make all bots
stricter and slower (longer cooldown, fewer concurrent opens, higher selectivity,
higher score/confidence bar, much lower trade rate). Both engines must pass
`settings.tradeMode` into `intensityProfile` or the toggle silently does nothing.

CALCULATED also reshapes the smart-exit ("let winners run, don't fast-recycle"):
raise the take-profit threshold, widen the giveback, and disable quick recycle.
Boost mode still overrides cadence and contradicts CALCULATED — surface a hint to
the user when both are on.

**Why:** the user wanted one "extra-calculated long-term" switch affecting ALL
bots, not per-bot tuning. Centralizing in `intensityProfile` keeps every engine
honest with zero per-bot edits.

# Speed-of-light emergency stop — price-map gotchas

The emergency close builds three price maps and calls
`closeAllBotPositions(binancePrices, stockPrices, polyPrices)` (closes only
`auto===true` positions), then disarms all bots and stops boost.

**Key gotchas:**
- `useLivePrices` is **crypto-only** (Binance USDT miniTicker WS). It has NO stock
  or Polymarket prices. Sourcing stock/poly closes from it silently closes them at
  the entry price (breakeven), distorting realized PnL.
- Source per asset class from the same cached React Query data the engines use:
  crypto = WS live price → `useGetMarketOverview` quote → entry; stocks =
  `useGetStocks` quote → entry; poly = `useGetShortTermMarkets`, keyed by
  `conditionId`, using `yesPrice`/`noPrice` per the position's `side`.
- `closeAllBotPositions` **skips** (keeps open) a binance/stock position whose price
  is missing/non-finite, so you MUST always provide a fallback (entry price) for
  every open auto position or it survives the "close everything" action. Poly is
  different: it falls back to entry internally when `polyPrices[conditionId]` is
  absent.

**How to apply:** any "close all / panic" feature that spans crypto+stock+poly must
assemble all three maps from class-appropriate sources with an entry-price fallback;
never reuse a single price source across asset classes.
