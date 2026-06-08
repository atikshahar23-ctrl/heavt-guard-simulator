---
name: App theme — Carbon Noir / Obsidian + layered gold accent
description: Active theme is platinum/steel + champagne on onyx (Carbon Noir), with gold re-introduced as a layered accent (user reversed the earlier no-gold rule).
---

## Current theme: Carbon Noir / Obsidian + gold accent

Base aesthetic is "Carbon Noir / Obsidian" (platinum/steel + champagne on onyx).
Token values live in `artifacts/crypto-arb/src/index.css` (source of truth) — read it
rather than trusting any palette numbers here.

- Primary / steel accent: `207 30% 70%`
- Champagne accent (sparingly): `39 28% 72%`; champagne hairline/glow CSS vars warmed toward gold
- Background: onyx near-black with a cool cast (`216 14% 5%` range)
- Gold accent (added per user request): `--gold: 43 64% 54%`, `--gold-soft`. Applied to
  the sidebar top shimmer, `.text-primary` glow, global focus-ring box-shadow, scrollbar
  thumb hover, and a `.gold-gleam` animated wordmark utility (uses existing `gleam` keyframes).
- Fonts unchanged: Inter + Playfair Display + Space Mono

## Why gold is back
**Why:** The earlier hard "NO gold" rule was the user's preference at the time; the user
LATER explicitly asked to "add gold into the app's general design," reversing it. Gold is
now a *layered accent over* Carbon Noir, not a full re-theme — base steel/champagne tokens
stay intact; gold only touches accents/glows/wordmark.

## Gotcha: hardcoded color literals beyond tokens
Many pages/components hardcode brand HSLs inline (not just via tokens). When re-theming,
sweep for the literals, not only flip tokens. Keep these as INTENTIONAL (do not flip):
amber/orange `38 95% 60%` = paused/caution state; `yellow-500` = BNB coin brand badge.

## Hard constraint
Never recolor the brand logo IMAGE (`public/brand-logo.png`,
`src/assets/logo-heavy-guard.png`) — only its CSS aura/halo glow may change (now gold-tinted).
