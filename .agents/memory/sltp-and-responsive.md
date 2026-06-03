---
name: SL/TP recommendations & responsive conventions
description: Durable conventions for recommended Stop Loss/Take Profit levels, the global auto-exit price map, and the Tailwind landscape/short variant.
---

# Recommended SL/TP

`recommendLevels(entry, dir, { slPct, tpPct })` is the single source for one-click SL/TP across both trade flows.

- Crypto futures default: 1.5% risk / 3% target (2R).
- Stocks default: 3% risk / 6% target (2R). Stocks are always treated long.
- **Why:** keep a consistent reward:risk (2R) so suggestions read predictably for the trader; stocks use wider bands because they're unleveraged and slower-moving.
- **How to apply:** any new asset class that needs auto SL/TP should reuse `recommendLevels` and pick a percentage pair that still yields ~2R, rather than inventing ad-hoc level math.

# Global SL/TP auto-exit price map

`checkSlTp(priceMap)` (portfolio context) closes both Binance and stock positions. The map must contain BOTH crypto asset keys AND stock symbol keys, merged in `autotrader-engine.tsx`'s global effect.
- **Why:** stock positions silently never auto-close if their symbols aren't in the price map. Crypto-only maps were the original bug.
- **How to apply:** when adding a new tradable source, merge its live prices into the same map and add it to that effect's deps. `checkSlTp` filters by `priceMap[key]` presence, so mixing key namespaces is safe (no collisions observed).

# Landscape / tablet adaptation

Use a Tailwind v4 custom variant `@custom-variant short (@media (max-height: 600px));` (declared in `src/index.css`) and `short:` utilities for compacting chrome (sidebar logo/padding).
- **Why:** plain `landscape:` ALSO matches wide desktop monitors and would shrink the desktop UI. Gating on max-height targets phones/tablets held sideways without touching desktops.
- **How to apply:** prefer `short:` (height-based) over `landscape:` for any "make it fit when rotated" tweak.
