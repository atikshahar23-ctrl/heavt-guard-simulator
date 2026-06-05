---
name: RTL bidi number/slash reordering
description: Why "buy / sell" style number pairs visually flip in RTL Hebrew pages
---

In RTL (`dir="rtl"`) Hebrew pages, a string like `${buyCount} / ${sellCount}` rendered
as a bare value (e.g. a stat tile showing "1 / 23") gets reordered by the Unicode
bidi algorithm and can appear visually as "23 / 1" — the slash-separated number pair
flips. This is purely a display artifact; the underlying values are correct.

**Why:** neutral characters (digits, `/`, spaces) between two numbers take direction
from the surrounding RTL context, so the pair renders right-to-left.

**How to apply:** when a number pair's order matters (buy/sell, adv/dec, win/loss),
prefer spelling each side out in words with its own label (e.g. "1 קניות מול 23 מכירות")
instead of a bare "A / B" string, OR wrap the numeric pair in an LTR span
(`dir="ltr"` / `<bdi>`). The stock-desk day-summary band uses the word-based form on
purpose; the older PulseStat "A / B" tiles still show the flipped artifact.
