# Dinner Page Mobile UX — Design Spec

**Date:** 2026-06-17
**Status:** Approved (pending implementation plan)
**Branch:** mobile-ux (off main)

## Problem

On mobile, the dinner cook page's quick-jump dish nav (`.dinner .jump`) is
`position: sticky; top: 0`, so it stays pinned to the top while scrolling. On a narrow
screen the dish "bookmark" pills wrap to multiple lines and follow the reader down the page,
eating screen space and feeling like an intrusive sliding tab. The user wants that to stop, and
wants the page to be a good experience on mobile generally.

## Goal

Make the quick-jump nav scroll away with the page (non-sticky), and apply a tight set of
mobile-friendly polish to the dinner page and the shared styles it uses. CSS-only; no behavior,
data, or JS changes.

## Changes

1. **Non-sticky jump nav (the core fix).** Remove `position: sticky; top: 0` from
   `.dinner .jump` in `DinnerChecklist.css`. The dish links and reset button sit at the top of
   the page and scroll out of view as the reader moves through dishes. The chip row continues to
   wrap, but is no longer pinned.

2. **Bigger tap targets.** Increase the checklist checkbox size from `1.15rem` to `1.4rem` and
   add a little more vertical padding to `.checklist li`, so rows are comfortable to tap. The
   whole `<label>` is already the tap target.

3. **Header nav wraps.** Add `flex-wrap: wrap` (and a small row-gap) to `header.site .container`
   in `global.css` so the Recipes / Dinners / Shopping list links wrap gracefully on narrow
   screens instead of cramping.

4. **No horizontal overflow.** Ensure long ingredient lines and the jump-chip row never cause
   sideways scrolling: allow the chip row to wrap (already does once non-sticky), and let long
   words break if needed (`overflow-wrap: anywhere` on checklist text). Confirm nothing forces
   a width wider than the viewport.

5. **Small-screen tuning.** Add a `@media (max-width: 520px)` block that slightly reduces
   `.dish` padding and tightens section spacing so more content fits without feeling cramped,
   while keeping text legible (no font shrink below current sizes).

6. **Anchor breathing room.** Add `scroll-margin-top` to the dish sections (`#dish-N`) so
   tapping a jump link doesn't land the dish heading flush against the top edge.

## Scope

- **Files:** `src/components/DinnerChecklist.css`, `src/styles/global.css`. A class/markup tweak
  in `src/layouts/BaseLayout.astro` only if needed for the nav wrap (prefer doing it in CSS).
- CSS only — no JavaScript, no component logic, no content/schema changes.
- Shared-style changes (header nav, any global tweaks) also benefit the recipe and shopping-list
  pages; changes must not regress those pages.

## Out of scope

- Removing the jump nav on mobile, or adding a "back to top" button (considered and declined).
- Any redesign of colors/typography/branding beyond the spacing/tap-target tweaks above.
- Changes to scaling, checklist behavior, or page structure.

## Testing / verification

- `npm run build` stays green (28 pages).
- Manual check at a phone viewport (~375px wide) in the browser's responsive mode:
  - The jump nav scrolls away with the page (not pinned).
  - Checkboxes/rows are comfortable to tap.
  - No horizontal scrolling anywhere on the dinner page.
  - Header nav wraps cleanly; recipe and shopping-list pages still look correct.
  - Tapping a jump link scrolls to the dish with a little space above its heading.
