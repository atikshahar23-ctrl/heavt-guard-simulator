# ARB_SCAN — Bitcoin Sentiment & Arbitrage Scanner

A real-time dashboard that cross-references Binance BTC futures data with Polymarket prediction markets to surface crowd sentiment gaps and arbitrage signals.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — key for encrypting stored Binance credentials
- Optional env: `ADMIN_USER_ID` — Clerk user id of the software-manager account (preferred over the username-based admin fallback), `ALLOWED_ORIGINS` — comma-separated extra CORS origins (`https://host` only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server` — Express API (port 5000). Routes in `src/routes/*`, upstream integrations (Binance, Polymarket, Hyperliquid, stocks, etc.) in `src/lib/*`. CORS/auth/rate-limit wiring in `src/app.ts`.
- `artifacts/crypto-arb` — main React frontend ("ARB_SCAN"). Pages in `src/pages`, bot/portfolio state in `src/contexts` (`portfolio-context.tsx` = wallets/positions/cash, `autotrader-context.tsx` = bot settings, risk guards, adaptive stats), headless bot loops in `src/components/*-engine.tsx`.
- `lib/db` — Drizzle ORM schema + Postgres access (source of truth for `userState`, `appUser` tables).
- `lib/api-zod` — generated Zod schemas/types from the OpenAPI spec (`lib/api-spec`) via Orval; regenerate with `pnpm --filter @workspace/api-spec run codegen`.
- `lib/api-client-react` — generated React Query hooks over the API.
- `render.yaml` — Render deployment config (env vars are set in the Render dashboard, not in the repo).

## Architecture decisions

- **Per-user encrypted Binance credentials**: API keys/secrets are AES-256-GCM encrypted (`artifacts/api-server/src/lib/crypto.ts`, key derived from `SESSION_SECRET`) and stored in the `userState` table under dedicated slots (`binance_credentials`, `binance_futures`) that are *not* part of the generic `/api/user-state/:slot` enum — the generic state endpoint can never read/write encrypted credential blobs.
- **Admin gating**: a single "software manager" account gets admin tooling (`artifacts/api-server/src/routes/admin.ts`). Resolved via `ADMIN_USER_ID` (Clerk user id, preferred — set as an env var) or, if unset, a fallback Clerk-username check. Client-side admin UI gating is cosmetic only; the server enforces it.
- **Risk Manager / auto-pause**: `evaluateRiskGuard` (in `autotrader-context.tsx`) pauses a bot on 3 consecutive losses, <25% win-rate after 5 trades, a daily loss cap, or a 25% drawdown. It runs for the 4 "extra" bots (Dip Buyer, Breakout Hunter, Blue-Chip DCA, Order Flow Bot) *and* for the Scalp Squad / Momentum bot via `autotrader-engine.tsx`'s own 30s risk-evaluation effect.
- **Cash floor**: `cashReserveFloor()` always returns at least `MIN_CASH_FLOOR_USD` ($3,000); every position-opening path (`openBinancePosition`/`openPolyPosition`/`openStockPosition` in `portfolio-context.tsx`) checks `cash - (stake/margin + open fee) < floor` at the point of debit — this is the authoritative check, independent of any per-tick pre-checks in the bot engines.
- **Rate limiting**: in-memory fixed-window limiter (`artifacts/api-server/src/lib/rateLimiter.ts`), layered as a global per-IP budget plus per-user limiters on write/order/credential routes and on read routes that fan out to Binance.

## Product

Hebrew-language paper-trading simulator (educational only — no real money, no win-rate/return promises):
- Market Scanner dashboard (Binance futures × Polymarket crowd sentiment), scalp/momentum signals, stocks, smart-money headlines.
- Simulator with multi-wallet portfolios and equity curve.
- Bot Command Center (`/bots`): paper-trading bots (incl. Dip Buyer, Breakout Hunter, Blue-Chip DCA) with a master arm/disarm and an adaptive manager that nudges each bot's selectivity from its own rolling win-rate.
- Scalp Squad: 5 coordinated scalp bots (each a distinct specialist) that split scalp signals, load-balance entries so two members don't crowd the same coin, and surface a live Hebrew "comms" feed of entries/exits/hand-offs. One-tap "Max Performance" (מצב מקסימום) pushes the whole fleet to top leverage/cadence/open-caps while honoring fixed-vs-dynamic sizing and keeping the $3,000 cash floor + losing-bot auto-pause safety nets.
- Research Desk (`/research`): free symbol/company lookup (stocks + crypto) with live prices and keyless external research links (TradingView, Yahoo, StockAnalysis, Google News, SEC, CoinGecko).
- Jarvis assistant: free rule-based brain (NO paid AI), bilingual he/en, silent on open.

## Constraints

- EVERYTHING must stay 100% free — no paid AI integrations. Jarvis is rule-based only.
- Paper/demo trading only; never promise win-rates, returns, or give financial advice.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **Node.js full ICU data required for timezone tests** — `timezone.test.ts` calls `Intl.DateTimeFormat` with `timeZone: 'Asia/Jerusalem'`. Node 24 ships with full ICU by default, so this works out of the box. If the Node runtime is ever swapped or the ICU bundle is trimmed (e.g. `--with-intl=small-icu`), the formatter silently falls back to UTC and all 19 timezone tests produce wrong results without an obvious failure signal. A `beforeAll` guard in the test file catches this immediately. If you see the guard fire, set `NODE_ICU_DATA` to point to a full ICU dataset or switch back to a full-ICU Node build.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
