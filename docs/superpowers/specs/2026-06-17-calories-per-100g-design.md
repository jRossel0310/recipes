# Calories Per 100 g — Design Spec

**Date:** 2026-06-17
**Status:** Approved (pending implementation plan)
**Branch:** calories-per-100g (off main)

## Context & goal

The dinner nutrition page (`/dinners/<slug>/nutrition`) shows per-serving macros. The head cook
also wants **calories per 100 g** listed, a familiar nutrition-label format. Computing per-100g
requires the weight of one serving, which recipes do not currently store (they store calories per
serving and a serving count). Deriving serving weight by summing ingredient grams is unreliable —
gram coverage is partial and uneven (e.g. beans has grams on only 3 of 11 ingredients), and raw
ingredient weight differs from cooked/served weight. So we add an explicit, authoritative
serving-weight field.

## Decisions (from brainstorming)

- **Add a `servingGrams` field** (weight of one serving in grams) to a recipe's nutrition. This is
  the authoritative serving weight, not an auto-estimate.
- **Per-100g is calories-only** (not all macros), as requested.
- **Show per-100g only when derivable** — both `calories` and `servingGrams` present; otherwise omit
  the per-100g line for that dish (per-serving line still shows).
- **Backfill the 5 sample-dinner dishes** with estimated serving weights, clearly flagged as
  estimates for the user to verify/correct.

## Schema change

In `src/content/config.ts`, add to the recipe `nutrition` object:
- `servingGrams: z.number().positive().optional()` — weight of one serving in grams.

No other schema changes. The field is optional, so all existing recipes remain valid.

## Display (nutrition page)

In `src/pages/dinners/[slug]/nutrition.astro`, for each dish, after the existing per-serving line,
add a per-100g line **only when** `nutrition.calories != null` AND `nutrition.servingGrams` is set:

```
Per 100 g: ~180 cal
```

Computed as `Math.round(calories / servingGrams * 100)`. Calories only. Rendered inline in the
Astro page (consistent with how per-serving nutrition is rendered), reusing the existing scoped
styling. When `servingGrams` is absent, no per-100g line appears for that dish.

## Backfill (sample dinner dishes — estimates to verify)

Add `servingGrams` to the five recipes referenced by `baked-night`, using these **rough estimates
the user will correct** (a code comment / note marks them as estimates):

| Recipe | servings | cal/serving | est. servingGrams | → cal/100g |
|--------|----------|-------------|-------------------|------------|
| `tofu/buffalo-tofu` | 6 | 329 | 150 | ~219 |
| `probation/honey-bbq-chicken-wings` | 30 | 149 | 100 | ~149 |
| `probation/mac-n-cheese` | 8 | 650 | 280 | ~232 |
| `dinners/beans` | 2 | 160 | 150 | ~107 |
| `bread/dinner-rolls` | 24 | 74 | 30 | ~247 |

These are plausible per-serving plate weights, not precise measurements; the user adjusts them as
needed. Only these five recipes get the field in this change.

## Authoring

Update the recipe authoring guidance in `README.md` (the LLM recipe prompt) so new recipes include
an optional `servingGrams` under `nutrition` (estimated weight of one serving), enabling the
per-100g line automatically.

## Scope

- **Files:** `src/content/config.ts` (schema), `src/pages/dinners/[slug]/nutrition.astro` (display),
  the five recipe files above (backfill), `README.md` (authoring prompt).
- No changes to scaling/units logic, the checklist island, or the cook page.
- No new library or unit tests — the per-100g calc is a trivial inline expression in the page,
  consistent with how nutrition is already rendered; verified by build + output assertion.

## Out of scope

- Auto-estimating serving weight from ingredient grams (rejected as unreliable).
- Per-100g for protein/carbs/fat (calories-only by request).
- Backfilling `servingGrams` for recipes beyond the five sample-dinner dishes.
- Showing per-100g on the cook page or recipe pages.

## Testing / verification

- `npm run build` succeeds; a deliberately bad `servingGrams` (e.g. a string) fails schema
  validation — confirming the field is enforced — then reverted.
- Inspect `dist/dinners/baked-night/nutrition/index.html`: contains a "Per 100 g" line with a
  calorie value for the backfilled dishes (e.g. `~219 cal`), and still shows per-serving lines.
- A dish whose recipe lacks `servingGrams` shows no per-100g line (no dish in baked-night after
  backfill, but the conditional must hold).
- Existing 54 unit tests remain green (unaffected; no logic changes).
- Manual check: per-100g reads cleanly under each dish on mobile.
