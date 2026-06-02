---
name: Vite HMR + Orval codegen conflict
description: When running orval codegen with clean:true while Vite dev server is running, Vite caches 404s for deleted files
---

## The problem
Orval's `clean: true` deletes the entire `generated/` output folder before regenerating. If the Vite dev server is running during codegen, it serves a request for the deleted file, gets a 404/missing, and caches that negative result. Subsequent HMR updates fail with "Failed to load url /@fs/...api.ts" even after the file is recreated.

## Fix
After running `pnpm --filter @workspace/api-spec run codegen`, always restart the `artifacts/crypto-arb: web` workflow to clear Vite's module graph cache.

**Why:** This is a Vite dev server caching behavior, not a code bug. The generated files ARE recreated correctly by codegen.
