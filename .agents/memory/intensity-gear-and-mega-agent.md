---
name: Intensity gear + Mega-Agent attribution
description: How the fleet-wide trading-intensity selector and the bots-page Mega-Agent roll-up attribute trades and scale bot behavior
---

## Trading-intensity gear (one selector, all bots)
A single 1–5 "gear" in `AutoTraderSettings.intensity` (default 3) scales EVERY bot via `intensityProfile(level)` in autotrader-context. The profile exposes multipliers (cooldownMult, maxOpenMult, confRankAdd, scoreAdd, selectivityMult) and a display `tradeRate` (≈1.5^(level-1)). Engines multiply their own thresholds/cooldowns/max-open by these.

**Why:** user wanted an economy↔sport dial where each step is ~+50% trade activity; level 1 = calm/few/high-conviction, level 5 = turbo.
**How to apply:** when adding a new bot, fold `prof.selectivityMult` into its entry threshold, `prof.cooldownMult` into its cooldown, and `Math.round(maxOpen * prof.maxOpenMult)` (floor 1) into its cap. Boost mode still overrides cadence entirely — derive intensity at render, don't persist boost over it.

### Per-wallet gear
The gear is per simulator wallet, NOT one global value. Storage is `AutoTraderSettings.intensityByWallet` (map keyed by portfolio wallet id); `settings.intensity` is only the fallback for wallets without an entry (and the legacy/migration default). AutoTraderProvider reads `activeWalletId` via `usePortfolio()` (it's nested inside PortfolioProvider) and exposes the *effective* gear as `settings.intensity` through a `useMemo`, so engines/UI keep reading one field unchanged. `update({intensity})` routes the value into `intensityByWallet[activeWalletId]` via an `activeWalletIdRef` (the updater has empty deps); it does NOT touch the global `intensity`, so one wallet's gear never leaks into another or into new wallets.
**Why:** users running a "calm" and a "turbo" wallet side by side expect each to keep its own gear across wallet switches.

## Mega-Agent trade attribution
The bots-page Mega-Agent roll-up attributes closed trades to the 7 bots by `ClosedTrade.source` substring (Scalp / Momentum / Smart-Money / "Dip Buyer" / "Breakout Hunter" / "Blue-Chip DCA"). Poly is the exception.

**Gotcha:** Polymarket positions carry NO `auto` or `source` field (openPolyPosition's Omit excludes them), so poly closed trades can't be filtered by source/auto. Attribute the Polymarket bot by `t.type === "POLYMARKET"` instead — this also sweeps in manual poly bets, which is acceptable for a fleet overview.
