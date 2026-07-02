---
name: alpha-new-bridge
description: How the Alpha-new assistant/agents repo connects to and controls this simulator
---

# Alpha-new <-> heavt-guard-simulator Bridge

## What this is

The `Alpha-new` repo (agents Command Center + personal assistant) now has a typed
HTTP client that can call every REST endpoint exposed by this simulator.

Two files were added to Alpha-new:

| File | Purpose |
|------|---------|
| `src/modules/simulatorBridge.ts` | Typed HTTP client wrapping the simulator's OpenAPI. Exports `sim.*` functions and `AGENT_TOOLS` / `handleAgentToolCall` for LLM tool use. |
| `agents/SimulatorPanel.jsx` | React panel that renders live prices, scalp signals, and open paper positions inside the Agents Command Center. |

## How communication works

```
Alpha-new (agents/App.jsx)
  └─ import { sim, AGENT_TOOLS } from "../src/modules/simulatorBridge"
         │
                │  HTTP REST  (fetch to <simUrl>/api/...)
                       ▼
                       heavt-guard-simulator  (Express + OpenAPI)
                         /api/crypto/binance/multi    ← live prices
                           /api/crypto/scalp            ← scalp signals
                             /api/crypto/overview         ← Fear & Greed, movers
                               /api/binance/futures/positions ← open paper positions
                                 /api/binance/futures/order   ← place / close paper order
                                   /api/user/state              ← read / write user settings
                                   ```

                                   ## Configuration (localStorage in Alpha-new)

                                   | Key | Value |
                                   |-----|-------|
                                   | `alpha:sim:url` | Base URL of deployed simulator, e.g. `https://heavt-guard-simulator.onrender.com` |
                                   | `alpha:sim:apiKey` | Optional Bearer token (leave blank if server has no auth) |

                                   Set via the SimulatorPanel's built-in setup form, or directly in DevTools.

                                   ## Agent tool use

                                   Any agent in agents/App.jsx can call the simulator as an LLM tool:

                                   ```js
                                   import { AGENT_TOOLS, handleAgentToolCall } from "../src/modules/simulatorBridge";

                                   // In the agent's askAI / askClaude call, add:
                                   tools: [...existingTools, ...AGENT_TOOLS]

                                   // In the tool-call handler:
                                   const result = await handleAgentToolCall(toolName, toolInput);
                                   ```

                                   ### Available agent tools

                                   | Tool name | What it does |
                                   |-----------|-------------|
                                   | `sim_market_context` | Returns a one-paragraph market snapshot string for injection into AI prompts |
                                   | `sim_get_positions` | Lists open paper positions |
                                   | `sim_place_order` | Places a paper futures order (BUY/SELL, MARKET/LIMIT) |
                                   | `sim_close_position` | Closes one position by symbol |
                                   | `sim_close_all` | Emergency close of all positions |

                                   ## Safety constraints

                                   - **Paper trading only** — the simulator enforces this server-side; the bridge never
                                     sends credentials for real Binance accounts.
                                     - **Binance read-only keys** (if any) stored in the simulator are never exposed to
                                       Alpha-new; the bridge only receives aggregated data, not raw credentials.
                                       - The `SimulatorPanel` renders a `"Paper trading only — no real funds involved"` footer
                                         and uses `window.confirm` before any destructive action (close-all).

                                         ## When to add new simulator endpoints to the bridge

                                         1. Add the endpoint to `openapi.yaml` in `lib/api-spec/` (this repo).
                                         2. Run `pnpm orval` to regenerate `lib/api-client-react/` and `lib/api-zod/`.
                                         3. In Alpha-new, add a matching method to the `sim` object in `simulatorBridge.ts`.
                                         4. Optionally expose it as an `AGENT_TOOLS` entry + `handleAgentToolCall` case.

                                         ## Related memory files (this repo)

                                         - `alpha-coordinator.md` — the Alpha Convergence Coordinator agent (fleet brain)
                                         - `jarvis-bilingual.md` — JARVIS assistant Hebrew/English toggle
                                         - `demo-trading-engine.md` — paper trading engine architecture
                                         - `trade-mode-and-emergency-stop.md` — emergency stop logic
