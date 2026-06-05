---
name: Calendar cell selection
description: Gotchas when a month grid shows spillover (prev/next-month) cells and lets the user click/select days.
---

# Calendar cell selection

The market calendar renders a 7×6 grid that pads with trailing prev-month and
leading next-month days. Two bugs are easy to introduce here:

- **Selecting a spillover cell with the *viewed* month/year maps to the wrong date.**
  A padded cell shows e.g. day 31 of the previous month while the header is on the
  current month; selecting `{viewYear, viewMonth, day}` records the wrong (or an
  overflowing) date. Each `CalendarDay` must carry its own absolute `year`/`month`,
  and selection/highlight must use the cell's own fields, not the viewed ones.

- **Never freeze "today" in component state/useMemo at mount.** A memoized
  `new Date()` goes stale across midnight/month rollover, so "open to today" and the
  "Today" button jump to the old date. Compute `new Date()` fresh at click time.

**Why:** both produce silently-wrong dates that only surface at month boundaries or
after the app has been open across a day change — hard to catch in a quick test.

**How to apply:** any clickable month-grid cell must derive its date from the cell,
and any "jump to today" action must read the clock at invocation, not at mount.
