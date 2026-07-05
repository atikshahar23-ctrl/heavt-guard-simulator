// ============================================================
// STEP 1 of 2 — file: artifacts/api-server/src/app.ts
// ============================================================
//
// Open that file in the heavt-guard-simulator repo.
// Find this existing line:
//
//     app.use("/api", router);
//
// Paste the block below IMMEDIATELY AFTER it, and BEFORE the
// existing "Serve the built crypto-arb frontend" block.
// (existsSync and path are already imported at the top of this
// file for that crypto-arb block, so nothing new to import.)
// ============================================================

// Serve the built Alpha-new personal assistant (combined single-origin
// deployment). Mounted at /alpha so it never collides with crypto-arb's
// routes or its own catch-all SPA fallback below. Built separately (see
// the buildCommand in render.yaml) and copied into
// artifacts/alpha-web/dist-combined before this server starts.
const alphaDist = path.resolve(import.meta.dirname, "../../alpha-web/dist-combined");
if (existsSync(alphaDist)) {
  app.use("/alpha", express.static(alphaDist));
}
