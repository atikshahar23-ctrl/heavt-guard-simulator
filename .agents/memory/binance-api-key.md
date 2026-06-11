---
name: Binance API key read-only integration
description: Why users' Binance keys are stored encrypted, validated up front, and never used to trade.
---

# Binance API key (read-only)

Users can save a personal Binance API key/secret (Settings) to show their real
exchange balance in the simulator header.

## Durable constraints

- **Read-only forever.** The stored credentials are only ever used for read calls
  (balance, open orders). They must NEVER place/cancel/execute trades — the whole
  app is paper-trading only (see `replit.md` constraints). Adding any order-placing
  call against user keys would break that promise.
- **Encrypted at rest.** Secrets are stored server-side encrypted (AES-256-GCM)
  and request signing is HMAC-SHA256. Never log, return, or expose the raw secret;
  it lives in its own `user_state` slot that the admin state endpoint must not
  surface.
- **Validate before persisting.** Test the credentials with a live read call to
  Binance before saving, so a bad key is rejected at entry rather than failing
  silently later.

**Why:** these are the invariants a future change could quietly violate (e.g.
"just add a quick order endpoint", or widening an admin/debug response to include
the secret). The route layout and crypto details are derivable from the code —
grep the user/binance routes — so they are intentionally not duplicated here.
