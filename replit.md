# ARB_SCAN — Bitcoin Sentiment & Arbitrage Scanner

A real-time dashboard that cross-references Binance BTC futures data with Polymarket prediction markets to surface crowd sentiment gaps and arbitrage signals.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

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
