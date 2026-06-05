---
name: Alpha Convergence Coordinator
description: Fleet-level "brain" that resolves one direction across all bot signals and biases entries; lives in autotrader-context + engine + bots page.
---

# Alpha Convergence Coordinator (סוכן אלפא)

A top-level coordinator that makes all bots act in concert ("like Transformers" —
the user's framing). It is real confluence logic framed strictly as paper-trading
discipline; copy must NEVER promise wins/returns or claim it moves a real market
(replit.md constraint). The Hebrew UI explicitly says it only concentrates the
bots' agreement.

## How it works
- `AlphaState` (ephemeral, NOT persisted) is computed in the autotrader **engine**
  from the live signal sources it already fetches: scalp confidence, momentum
  surge (long-biased), smart-money stock BUY/SELL votes. It resolves a dominant
  direction + confluence % and publishes via `publishAlpha` into the context.
- The bots page reads `alpha` from context for the live readout.
- Bias is applied via the exported `alphaAdjust(alpha, enabled, dir)` helper:
  aligned trades get an easier bar (selMult down to 0.65 + one scalp confidence
  notch cheaper), opposing trades get stricter (selMult up to 1.6 + one notch
  harder). When confluence ≥ `ALPHA_STRONG_PCT` the crypto book gets +2 max-open
  slots ("press the advantage").
- Gated entirely by `settings.alphaCoordinatorEnabled` (default true).

**Why:** keeps the "god-tier coordinating agent" request genuine and functional
rather than decorative, while staying inside the no-guarantees constraint.

**How to apply:** if you add a new signal source to the engine, fold its
directional votes into the `alphaState` useMemo so the coordinator stays
fleet-wide. Remember to add `alphaState` to the trade effects' dep arrays.

## Robot emblem (IP)
`components/alpha-bot-emblem.tsx` is an ORIGINAL geometric mech-head SVG — NOT the
Transformers/Autobots trademark. The user asked for "the Transformers logo"; we
deliberately made a bespoke emblem instead and told them why. Do not swap in the
real trademarked mark.
