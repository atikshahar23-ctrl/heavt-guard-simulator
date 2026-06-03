---
name: Motion / polish system
description: Durable conventions for the app-wide animation + focus polish layer (easing, page transitions, skeletons, focus rings).
---

# Motion system (src/index.css)

App-wide "premium feel" lives in shared CSS, not per-page, so one change uplifts everything.

- Easing token: `--ease-out-quart: cubic-bezier(0.22, 1, 0.36, 1)` is the house curve; use it for entrances/transitions.
- `.page-enter` (opacity + translateY only) is replayed on navigation by putting `key={location}` on the page wrapper in `layout.tsx`.
  - **Why opacity+transform only:** an earlier version animated `filter: blur` + kept `will-change` on the full-page container — flagged as the main jank source on heavy pages (charts/tables). Keep page entrances cheap.
- `.stagger` = opt-in container that fades its direct children in sequence (nth-child delays). Use on hero/stat grids.
- `.shimmer` = gold sweep used by the Skeleton component instead of `animate-pulse`.

# Focus rings

Gold focus ring is **scoped** to interactive controls (`a, button, input, select, textarea, [role=button], [tabindex]`), NOT a global `:focus-visible`.
- **Why:** a global `*:focus-visible { outline:none }` flattens component/shadcn focus systems and breaks high-contrast users. Scope it, keep a forced-colors fallback (`@media (forced-colors: active)` → `outline: CanvasText`).

# Reduced motion

A `@media (prefers-reduced-motion: reduce)` block neutralizes animations/transitions globally — keep any new heavy animation compatible with it.
