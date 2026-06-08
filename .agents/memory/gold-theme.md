---
name: App theme — Carbon Noir / Obsidian (was gold)
description: Active theme is platinum/steel + champagne on onyx (Carbon Noir). The earlier gold theme was fully migrated away.
---

## Current theme: Carbon Noir / Obsidian (platinum, NO gold)

The app was migrated from a gold+black luxury theme to a "Carbon Noir / Obsidian"
billionaire/members-only aesthetic. **There is no gold anymore.** Token values live
in `artifacts/crypto-arb/src/index.css` (source of truth) — read it rather than
trusting any palette numbers here.

- Primary / steel accent: `207 30% 70%` (replaced old copper `32 84% 55%` and gold `43 74% 52%`)
- Champagne accent (sparingly): `39 28% 72%` (replaced old cyan `190 80% 52%`)
- Background: onyx near-black with a cool cast (`216 14% 5%` range)
- Fonts unchanged: Inter + Playfair Display + Space Mono
- Carbon utilities appended to index.css: `.uhnw-panel`, `.uhnw-mono`, `.uhnw-heading`, `.gleam-text`, `.jewel-dot`, `.uhnw-divider`, `.entrance-marble-bg/-vignette/-spotlight`, body carbon-fiber weave.

## Gotcha: hardcoded color literals beyond tokens

Many pages/components hardcode brand HSLs inline (not just via tokens). When
re-theming, you MUST sweep for the literals, not only flip tokens. Old brand hues
seen historically: copper `32 84% …`, cyan `190 80% …`, gold `43 74% …` and
`43 90% …`, plus stray `38 74%`. Keep these as INTENTIONAL warnings (do not flip):
amber/orange `38 95% 60%` = paused/caution state; `yellow-500` = BNB coin brand badge.

## Why
**Why:** User explicitly wanted a platinum/steel "Dubai/Monaco" obsidian tier look,
explicitly NO gold. Hard constraint: never recolor the brand logo IMAGE
(`public/brand-logo.png`, `src/assets/logo-heavy-guard.png`) — only its CSS aura/halo glow may change.
