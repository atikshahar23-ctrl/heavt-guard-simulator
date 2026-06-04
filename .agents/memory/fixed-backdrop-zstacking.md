---
name: Fixed ambient backdrop z-stacking
description: Why a fixed full-screen decorative layer disappears, and the correct stacking fix
---

When mounting a full-viewport decorative layer (animated globe, gradient wash) as a
`fixed inset-0` element, do NOT give it `-z-10`.

**Why:** The app root container paints a solid `bg-background`. A negative z-index
pushes the fixed layer *behind* that background, so it never shows. It also must not
sit at the same auto/0 level as real content without the content being lifted, or the
faint full-screen wash tints the sidebar/ticker.

**How to apply:** Give the backdrop `z-0` (it then paints above the root background
but is a positioned sibling), and explicitly raise the real UI above it — page content
wrapper and the desktop sidebar get `relative z-10`, top bars stay at their existing
higher z (e.g. z-20). Prefer `fixed` over `absolute` inside the scroll container so the
backdrop is decoupled from scroll repaint.
