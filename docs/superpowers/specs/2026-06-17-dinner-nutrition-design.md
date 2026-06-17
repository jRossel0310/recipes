# Dinner Nutrition Page — Design Spec

**Date:** 2026-06-17
**Status:** Approved (pending implementation plan)
**Branch:** dinner-nutrition (off main)

## Context & goal

The head cook wants to share per-serving calorie/nutrition info for a dinner, but on a *separate*
linkable page rather than inline on the cook page — so announcing a dinner (sharing the cook-page
link) doesn't force calorie information on people who'd rather not see it. The cook can paste the
nutrition link only when/if they want.

All 24 recipes already carry per-serving `nutrition` (`calories`, `protein`, `carbs`, `fat`); the
recipe page already displays it. Nutrition is per serving and does NOT change with scaling, so this
feature combines dishes only — no scaling math, no aggregation total.

## Decisions (from brainstorming)

- **Per-dish only.** List each dish's per-serving nutrition. No combined "full plate" total
  (avoids the misleading sum when dishes are alternatives, e.g. tofu vs chicken).
- **Full macros per dish.** Show calories + protein + carbs + fat per serving, consistent with the
  recipe page.
- **Separate page** at its own static URL, shareable independently.
- **Cook page stays calorie-free**, with a small discreet opt-in link to the nutrition page.

## Pages & routing

- **New: `/dinners/<slug>/nutrition`** — the nutrition page. Lists each dish (in the dinner's dish
  order) with its name, target servings, and per-serving macros.
- **Cook page route rename:** the existing cook page is `src/pages/dinners/[...slug].astro` (a rest
  param). To cleanly add a nested `/<slug>/nutrition` route, rename it to
  `src/pages/dinners/[slug].astro` (a single-segment param). Dinner slugs are flat (e.g.
  `baked-night`), so `[slug]` matches exactly what the rest param matched; `getStaticPaths` already
  returns `params: { slug: entry.slug }`, unchanged. This avoids a rest-param / nested-route
  collision and removes an unused rest param.
- **New: `src/pages/dinners/[slug]/nutrition.astro`** — the nutrition page route, sibling directory
  to `[slug].astro`. Both use the `slug` param consistently.
- **Discreet link on the cook page:** add a small `<a href={`/dinners/${entry.slug}/nutrition`}>`
  ("Nutrition info →") near the header. It's a link, not the numbers, so it doesn't force calorie
  info on anyone — they choose to tap.

## Nutrition page content

For each dish (resolved via `getEntry(dish.recipe)`):
- Dish name and target servings (e.g. "Buffalo Baked Tofu · 84 servings").
- A per-serving line showing whichever macros are present, omitting any that are absent:
  `Per serving: 470 cal · 52 g protein · 53 g carbs · 6 g fat`
  (middot separators, matching the recipe page; no em dashes).
- If a dish's recipe has no `nutrition` block at all, show a brief "No nutrition data" note for that
  dish rather than an empty line.
- A short header explaining the numbers are estimated per-serving values.

Rendered with `BaseLayout` and existing styles for visual consistency. No new interactive island
(static content). Presentation is inline in the Astro page, mirroring how the recipe page renders
nutrition — no new library or unit tests needed.

## Scope

- **Files:** rename `src/pages/dinners/[...slug].astro` → `src/pages/dinners/[slug].astro` (+ add
  the discreet link); create `src/pages/dinners/[slug]/nutrition.astro`.
- No changes to the recipe/dinner schemas, the scaling/units logic, or the checklist island.
- No backend; static output; deploys on commit.

## Out of scope

- Inline calories on the cook page (deliberately excluded — that's the whole point).
- A combined full-plate total or any aggregation math.
- Scaling nutrition (it's per serving and constant).
- Editing or adding nutrition data to recipes (all referenced recipes already have it).

## Testing / verification

- `npm run build` succeeds; page count rises by one per dinner (the `/nutrition` page). The cook
  page still builds at its renamed route, and `/dinners` index links still resolve.
- Inspect `dist/dinners/baked-night/nutrition/index.html`: contains each dish name and per-serving
  macro values (e.g. a calorie number), confirming `getEntry` + nutrition rendering ran.
- Inspect `dist/dinners/baked-night/index.html`: contains the discreet "Nutrition info" link and
  NO inline calorie numbers.
- Existing 54 unit tests remain green (unaffected; no logic changes).
- Manual check: cook page shows the opt-in link and no calories; nutrition page lists per-dish
  macros and reads cleanly on mobile.
