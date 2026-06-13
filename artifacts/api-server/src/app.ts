import { existsSync } from "node:fs";
import path from "node:path";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import { globalRateLimit } from "./lib/rateLimiter";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

// CORS allowlist pinned to this deployment's own Replit domains. The previous
// reflective config (origin: true + credentials: true) let ANY site make
// credentialed requests and read the response — a CSRF / data-disclosure hole
// now that cookie-authed write routes exist. The frontend is same-origin with
// the API (path-routed through the Replit proxy), so same-origin requests carry
// no Origin header and are always allowed; only cross-origin reads from unknown
// sites are blocked.
const corsAllowlist = new Set<string>();
for (const domain of (process.env.REPLIT_DOMAINS ?? "").split(",")) {
  const host = domain.trim();
  if (host) corsAllowlist.add(`https://${host}`);
}
const devDomain = process.env.REPLIT_DEV_DOMAIN?.trim();
if (devDomain) corsAllowlist.add(`https://${devDomain}`);

// Add allowed origins from environment variable (comma-separated). Each entry
// must be a bare "https://host" origin (no path, no wildcard) — anything else
// can never match a browser's Origin header and would silently no-op, so warn
// loudly at startup to surface deploy misconfiguration.
for (const origin of (process.env.ALLOWED_ORIGINS ?? "").split(",")) {
  const o = origin.trim();
  if (!o) continue;
  if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(o)) {
    logger.warn({ origin: o }, "ALLOWED_ORIGINS entry is not a valid https origin and will never match — ignoring");
    continue;
  }
  corsAllowlist.add(o);
}

// Trust exactly one reverse-proxy hop (the Replit edge proxy). This lets
// Express correctly derive req.ip from X-Forwarded-For while refusing to trust
// any additional hops that an attacker could inject.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Clerk proxy must be BEFORE body parsers (it streams raw bytes).
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      // No Origin header → same-origin request, curl, or server-to-server. The
      // browser only sends Origin on cross-origin (and non-GET) requests.
      if (!origin || corsAllowlist.has(origin)) {
        callback(null, true);
        return;
      }
      // Unknown cross-origin: deny CORS (no ACAO header) so the browser blocks
      // the caller from reading the response. Don't throw — that 500s the route.
      callback(null, false);
    },
  }),
);

// Body parsing. The authed /api/user-state routes carry larger client-owned
// snapshots, so they opt OUT of the global 100kb JSON cap and use a route-scoped
// 2mb parser instead (see routes/userState.ts). Every other route keeps the
// small default cap to bound DoS surface.
app.use((req, res, next) => {
  // /api/user-state carries larger snapshots; /api/social uses its own scoped
  // parser for clean 400/413 JSON. Both opt out of the global parser.
  if (
    req.path.startsWith("/api/user-state") ||
    req.path.startsWith("/api/social")
  ) {
    next();
    return;
  }
  express.json()(req, res, next);
});
app.use(express.urlencoded({ extended: true }));

// Clerk auth middleware — resolves the publishable key from the incoming
// request host so the same server can serve multiple custom domains.
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

// Global admission control: 120 requests/minute per IP across all /api routes.
// /api/user-state is exempted: it is authed, cheap (a single indexed per-user
// read/write), and already carries its own stricter per-user limiters. Keeping
// it out of the shared per-IP budget stops a page-load burst against the
// expensive fan-out routes from starving hydration. NOTE: req.path is relative
// to the "/api" mount here, so it reads "/user-state", not "/api/user-state".
app.use("/api", (req, res, next) => {
  if (req.path.startsWith("/user-state")) {
    next();
    return;
  }
  globalRateLimit(req, res, next);
});

app.use("/api", router);

// Serve the built crypto-arb frontend (single Render web service). Vite
// builds it into dist/public next to this server's own dist. In local dev
// that directory doesn't exist — the frontend runs on its own Vite dev
// server instead — so this block is skipped entirely and unmatched routes
// fall through to a normal 404.
const frontendDist = path.resolve(import.meta.dirname, "../../crypto-arb/dist/public");
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // SPA fallback: any non-API GET that didn't match a static file resolves
  // to index.html so client-side routing (wouter) can take over.
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

export default app;
