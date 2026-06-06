---
name: Stale lib .d.ts after merges
description: Phantom "property does not exist" typecheck errors right after a task merge
---

After a task merge (or whenever a `lib/*` package's source changed but its built
declarations did not), a per-artifact typecheck can report phantom errors like
`Property 'X' does not exist on type 'Y'` even though the schema source clearly
has `X`. The artifact resolves the lib's stale emitted `.d.ts`, not the source.

**Why:** `lib/*` packages (e.g. `@workspace/api-client-react`) are composite and
emit declarations; consuming artifacts typecheck against those emitted `.d.ts`.
A merge can leave the source ahead of the build output.

**How to apply:** Run the full `pnpm run typecheck` (which does `typecheck:libs`
= `tsc --build` first) instead of `pnpm --filter @workspace/<artifact> run typecheck`.
Rebuilding the libs clears the phantom errors. Trust the root `typecheck` over the
per-artifact one when they disagree.
