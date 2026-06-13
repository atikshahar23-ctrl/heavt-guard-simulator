# Threat Model

## Project Overview

ARB_SCAN / Heavy Guard is a public-facing paper-trading dashboard with a React frontend and an Express API server. The production system is primarily a read-only market-data and signal aggregation service: it fetches public data from Binance, Polymarket, Yahoo Finance, CoinGecko, Google News, and similar sources, computes trading-style signals, and returns them to the browser. The deployed app is public on Replit autoscale. The mockup sandbox is a development-only artifact and is not treated as production-reachable unless proven otherwise.

## Assets

- **Service availability and upstream quota budget** — the main backend value is live aggregation of external market data. If public endpoints can be abused to trigger excessive fan-out, the app becomes unavailable or gets throttled upstream.
- **Integrity of computed signals and research data** — users rely on the API output to drive demo trades and dashboards. Malformed upstream data or unsafe browser embedding could mislead users or break the app.
- **Deployment secrets and infrastructure access** — database credentials and any future API secrets must remain server-only. Even though the current app is largely stateless, backend compromise would expose the deployment environment.
- **User browser trust** — the frontend embeds third-party widgets and links out to third-party sites. The browser must not execute attacker-controlled script in the app origin or silently abuse user sessions.

## Trust Boundaries

- **Browser → Express API** — all `/api/*` requests come from an untrusted client. Query parameters, request cadence, and origin are attacker-controlled.
- **Express API → third-party market/news APIs** — the server makes outbound requests to Binance, Polymarket, Yahoo Finance, CoinGecko, Google News, and similar services. Slow or abusive request patterns can turn the API into a fan-out amplifier.
- **Frontend → third-party embeds/links** — the browser loads TradingView widgets, Binance websockets, and Polymarket pages. Third-party content is outside app trust and must stay isolated from the app origin.
- **Production vs dev-only artifacts** — `artifacts/mockup-sandbox` is out of production scope unless code or config proves it is deployed. Findings there should usually be ignored.

## Scan Anchors

- Production backend entry: `artifacts/api-server/src/index.ts` and `artifacts/api-server/src/app.ts`
- Public API routes: `artifacts/api-server/src/routes/*.ts`
- Highest-risk server code: `artifacts/api-server/src/lib/{binance,polymarket,scanner,scalp,momentum,stocks,influencers,movers}.ts`
- Main production frontend: `artifacts/crypto-arb/src/**/*`
- Browser embed/search hotspots: `artifacts/crypto-arb/src/components/tradingview-advanced-chart.tsx`, `artifacts/crypto-arb/src/pages/{browse,research}.tsx`, `artifacts/crypto-arb/src/components/{stock-chart,candlestick-chart,universal-stock-search}.tsx`
- Usually ignore as dev-only: `artifacts/mockup-sandbox/**/*`

## Threat Categories

### Tampering

The client and third-party data sources are untrusted. The API must validate request parameters before using them in outbound requests and must parse external responses defensively before turning them into signals. The frontend must treat market slugs, symbols, and external links as untrusted strings and only build safe URLs from constrained values.

### Information Disclosure

The app is public, so public market data is not sensitive by itself. The real disclosure risk is accidental leakage of secrets, cookies, auth headers, stack traces, or internal error detail through logs and API responses. Production logs must continue to redact credentials, and server errors must not expose internals.

### Denial of Service

This is the most relevant threat category for the current architecture. Public unauthenticated endpoints trigger outbound fan-out and CPU work (for example scan, momentum, scalp, stock quote aggregation, and market/news aggregation). Production endpoints must bound work, coalesce duplicate requests where possible, apply reasonable timeouts to outbound calls, and enforce abuse controls such as rate limiting or equivalent admission control on expensive routes.

### Elevation of Privilege

There is little role separation today because the production API is intentionally public and read-only. The main elevation risks are code execution or browser-origin compromise through injection bugs, unsafe dynamic script/widget initialization, or server-side request construction that lets a caller escape intended destinations. All dynamic browser embedding must keep attacker-controlled data out of executable script contexts, and server fetches must stay pinned to intended upstream hosts.
