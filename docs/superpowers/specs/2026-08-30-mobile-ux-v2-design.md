# Site-Wide Mobile UX Pass — Design Spec

**Date:** 2026-08-30
**Status:** Approved (pending implementation plan)

## History / relation to prior spec

`docs/superpowers/specs/2026-06-17-mobile-ux-design.md` addressed the same jump nav and
concluded the fix was to make it **non-sticky**; that was implemented in `502edd0`. A later,
unrelated commit (`f6c73fb`, "Reorganize recipes around everyday dinners") reintroduced
`position: sticky` on `.dinner .jump` as part of a broader visual restyle (glassmorphism nav,
new color tokens, optional-dish support), without revisiting the earlier decision. That commit
added a mobile `top: 60px` override for the sticky nav but never updated `.dish {
scroll-margin-top }` to account for the nav's own height — which is the direct cause of the bug
found below.

This spec **keeps the nav sticky** (it's load-bearing for the current visual design and the
user confirmed the sticky-based fix over reverting to non-sticky) and fixes the offset math at
its root instead of re-litigating stickiness.

## Problem

A mobile-viewport audit (390×844, real Chromium via Playwright, not emulated devtools) across
every page surfaced three concrete, measured problems, worst first:

1. **Jump-nav scroll target is broken.** `.dish { scroll-margin-top: 0.75rem }` only accounts
   for the site header, not the sticky jump nav stacked below it. Tapping a dish pill (e.g.
   "Vegan Enchiladas" on `/cloyne/enchilada-night`) scrolls the target heading **entirely
   behind both sticky bars** — measured 94.6px of the heading hidden above the visible
   viewport, landing the reader mid-ingredient-list with no visual anchor to the dish they just
   jumped to. This is the core "big coop meal" flow: 6+ dishes, jumping between them on a phone
   while cooking.
2. **Jump nav overflows with no affordance.** With 6 dishes only ~2 pills fit in 390px; the
   rest requires knowing to swipe sideways, with no fade/arrow hint that more exist.
3. **Shopping-list picker buries the output.** After loading a dinner via the "Load a dinner"
   accumulator (see prior session work), ~50 checkboxes across every recipe category still
   render above the consolidated list, forcing a long scroll past irrelevant checkboxes on a
   phone to reach the list you actually asked for.

Confirmed non-problems (verified, not assumed, so this spec doesn't touch them):

- Checklist checkbox tap targets: the `<label>` wraps the full ~90px-tall row, so the whole row
  is tappable, not just the 22px visual checkbox. No fix needed.
- `/recipes/[slug]` (`RecipeScaler`) is already in good shape on mobile.
- Card grids (`dinner-grid`, `recipe-grid`) already collapse to one column under 640px.
- No stray fixed-position elements exist in the DOM; a floating overlay seen in some
  screenshots during the audit was confirmed (via `getComputedStyle` sweep) to be a
  Playwright/Chromium mobile-emulation artifact, not part of the rendered page.

## Goals

- Fix the jump-nav scroll-target bug at its root (shared sticky-height source of truth), not
  with another magic-number patch.
- Make the jump nav itself usable on a phone: clear that it scrolls, and aware of which dish
  you're currently viewing.
- Stop the shopping-list picker from burying the accumulator's output on mobile.
- Apply the same sticky-offset fix to the homepage's category nav for consistency.
- CSS + small, targeted component-state changes only. No new dependencies, no new shared
  component abstractions (see "Approach" below).

## Decisions made during brainstorming

- **Checklist layout stays one long scroll** (not a one-dish-at-a-time accordion/stepper).
  Lower risk, keeps the whole meal visible/searchable on one page.
- **Scope is the whole site in one pass**, not just the checklist pages — checklist pages are
  priority, but the shopping-list picker and homepage nav are addressed in this same design
  since they share the same root cause and CSS.
- **Shopping-list picker collapses automatically** once a dinner is loaded, rather than
  reordering the DOM to put the list above the picker.
- **Approach: targeted fixes in existing files/components** (Approach A), not a new reusable
  `CollapsiblePanel`/`StickyProgress` component system (Approach B). This codebase has ~6 page
  templates and 3 interactive components total; building shared abstractions for this size of
  site is premature. The one exception is introducing CSS custom properties for sticky-header
  height, which directly fixes the root cause and is cheap enough to not count as "new
  infrastructure."

## Design

### 1. Shared sticky-offset CSS variables (root-cause fix)

In `src/styles/global.css`, add to `:root`:

```css
--header-h: 68px;
```

with a mobile override alongside the existing `@media (max-width: 640px)` block:

```css
--header-h: 60px;
```

(matching the existing, already-correct `nav-shell` min-height values at each breakpoint).

In `src/components/DinnerChecklist.css`, add:

```css
--jump-h: 61px; /* measured rendered height of .dinner .jump; fixed because it never wraps
                    (flex-wrap: nowrap + overflow-x: auto) */
```

Then:

- `.dinner .jump { top: var(--header-h); }` (replaces the hardcoded `top: 68px`, and the mobile
  media query's `top: 60px` override becomes unnecessary once `--header-h` already resolves to
  60px there).
- `.dish { scroll-margin-top: calc(var(--header-h) + var(--jump-h) + 0.75rem); }` (replaces the
  bare `0.75rem`).

This fixes both the desktop/mobile top-offset drift and the scroll-target overlap with one
change, and gives future edits to header/nav height a single place to update instead of two
files silently drifting apart again.

### 2. Jump-nav mobile usability

- **Overflow affordance:** always-on subtle right-edge fade on `.dinner .jump` via CSS
  `mask-image: linear-gradient(to right, black calc(100% - 28px), transparent)` (with a
  `-webkit-mask-image` fallback). CSS-only, no JS needed to detect actual overflow — harmless
  when there's nothing to hide.
- **Current-dish awareness:** `DinnerChecklist.tsx` gains an `IntersectionObserver` watching
  each `.dish` section (one observer, threshold tuned so a dish counts "active" once its
  heading crosses just below the sticky bars). The corresponding jump-nav pill gets an
  `active` class (bold text + filled background, distinct from the existing `optional` dashed
  style) and is scrolled into view within the horizontally-scrolling nav via
  `scrollIntoView({ inline: 'nearest', block: 'nearest' })`. No separate progress bar element —
  keeps the scarce vertical space on a phone, and answers "where am I" via the nav that's
  already sticky and visible.

### 3. Shopping-list picker collapses after loading a dinner

In `ShoppingListBuilder.tsx`:

- New state: `pickerOpen` (boolean, default `true`).
- `loadDinner()` sets `pickerOpen = false` after populating selections.
- The `.pick` panel header becomes a clickable toggle ("Pick recipes ▾" / "Pick recipes ▸").
  When collapsed, render a one-line summary instead of the full checkbox tree, e.g. "6 recipes
  selected — tap to edit", built from `Object.keys(selected).length`.
- Manually toggling a checkbox does not auto-collapse; only loading a dinner does. Clicking
  "Clear" also resets `pickerOpen` to `true` (nothing loaded, so show the full picker again).

### 4. Site-wide polish

- `src/pages/index.astro`'s `.category-nav` becomes `position: sticky; top: var(--header-h);`
  on mobile only (`@media (max-width: 640px)`), matching the dish jump-nav pattern, so users
  can jump between recipe categories without scrolling back to the top of a long page.
- Audit tap targets (nav links, the `RecipeScaler` +/- servings stepper, "Copy as text" button)
  for ≥44px on mobile; adjust padding where they fall short. (Prior spec already fixed the
  checklist checkbox/row size; this just extends the same bar to the remaining interactive
  elements.)
- Explicitly **not** touched: card grids, `RecipeScaler` layout/structure, color palette or
  dark mode — already adequate or out of scope for this pass.

## Scope

**Files:**
- `src/styles/global.css` — sticky-offset CSS variables, category-nav sticky rule, tap-target
  audit fixes.
- `src/components/DinnerChecklist.css` — `--jump-h`, updated `.jump`/`.dish` rules, fade mask,
  `.active` pill style.
- `src/components/DinnerChecklist.tsx` — `IntersectionObserver` + active-dish state.
- `src/components/ShoppingListBuilder.tsx` — `pickerOpen` state + collapse/toggle behavior.
- `src/components/ShoppingListBuilder.css` — collapsed-summary and toggle styling.
- `src/pages/index.astro` — sticky category-nav (styling only; no data/logic change).

No content, schema, or routing changes. No new npm dependencies.

## Out of scope

- Reverting to a non-sticky jump nav (considered, explicitly declined — see History above).
- One-dish-at-a-time / accordion checklist layout (considered, declined during brainstorming).
- Reordering the shopping-list page so output renders above the picker (declined in favor of
  collapse).
- Per-dish ingredient-checked progress counts (e.g. "12/18 checked") — only current-dish
  awareness is in scope; a checked-count indicator is a plausible future addition, not this one.
- Offline/PWA support for spotty kitchen wifi — not raised as a requirement, out of scope.
- Any new shared component abstractions (`CollapsiblePanel`, `StickyProgress`, design tokens
  beyond the two CSS variables above) — see Approach A decision.

## Testing / verification

- Re-run the same Playwright mobile-viewport (390×844) audit used to find these bugs:
  - Click a jump-nav pill on `/cloyne/enchilada-night` and re-measure the heading/jump-nav
    overlap; expect ~0px hidden (down from the measured 94.6px).
  - Re-screenshot `/`, `/dinners`, `/dinners/[slug]`, `/cloyne`, `/cloyne/[slug]`,
    `/recipes/[slug]`, `/shopping-list` (with a dinner loaded) at 390px width.
  - Confirm zero console errors across all of the above.
- `npm test` stays green (60 tests — none of these changes touch `src/lib`, so no new test
  cases are expected, but confirm no regressions).
- `npm run build` stays green (75 pages).
- Manual pass: confirm the jump nav's active-pill highlight tracks scroll position, the
  shopping-list picker collapses after loading a dinner and expands on tap, and the homepage
  category nav stays reachable while scrolled through the recipe library on a phone.
