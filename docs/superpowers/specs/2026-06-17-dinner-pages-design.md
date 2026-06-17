# Head-Cook Dinner Pages — Design Spec

**Date:** 2026-06-17
**Status:** Approved (pending implementation plan)
**Branch:** dinner-pages (off main)

## Context & goal

The author is a head cook in the Berkeley Student Cooperative, responsible for serving dinner
one night a week with a crew of five other cooks. Today they distribute a Google document
(see `refrences/*.pdf`) listing each dish for the night, scaled to co-op volume (60–120+
servings) with batch/pan notes. They want a cleaner, reusable webpage alternative built on the
existing Astro recipe site.

Goal: a **dinner-night page** that assembles existing recipes, scales each to a co-op serving
count automatically, displays the quantities in practical big-batch units, carries the head
cook's shift-specific notes, and lets cooks tick off progress — intuitive to author and clean
to cook from.

This builds directly on the existing recipe site (structured recipes + scaling engine) and
reuses its static Astro + React + Vercel architecture.

## Scope

**In scope (v1):**
- A `dinners` content collection + Zod schema (validates referenced recipes exist).
- `units.ts` — big-batch unit roll-up + display logic, unit-tested.
- `/dinners` index page and `/dinners/<slug>` cook page, with progress checkboxes.
- One **sample dinner** seeded from recipes that already exist in the site.
- README authoring guide + LLM prompt for creating dinner files.

**Out of scope (v1, easy to add later):**
- Migrating the actual reference docs / adding new co-op recipes (enchiladas, coleslaw,
  bone-in honey-BBQ chicken). The reference PDFs remain references only for now.
- Live shared checklists across cooks (needs a backend).
- Cook-by-name assignments, printable/PDF export, timing/schedule planner.

## Data model: the `dinners` collection

Each dinner is a file at `src/content/dinners/<slug>.md`. It references recipes by their path
within the recipes collection and sets a per-dish target serving count, plus optional
head-cook notes. The markdown body holds overall shift notes.

### Example

```markdown
---
title: Baked Night
date: 2026-06-20            # optional ISO date
dishes:
  - recipe: tofu/buffalo-tofu
    servings: 84
    notes:
      - 8–10 large rimmed sheet pans
      - Set up multiple breading stations, one dry hand / one wet
  - recipe: probation/honey-bbq-chicken-wings
    servings: 120
    notes:
      - Wash step first; pat dry before seasoning
  - recipe: probation/mac-n-cheese
    servings: 120
    notes:
      - 5–6 full 9×13 pans (or 3 hotel pans)
  - recipe: dinners/beans
    servings: 120
  - recipe: bread/dinner-rolls
    servings: 144
---

Start the beans first — they simmer ~3 hours. Rolls need two 30-minute rises, so mix dough
early. Tofu and chicken go in the oven last so they're hot at service.
```

### Schema (Zod, validated at build)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `title` | string | yes | Dinner display name. |
| `date` | date | no | Service date (Astro `z.date()`). |
| `dishes` | Dish[] | yes (min 1) | Ordered; display order follows file order. |

Dish:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `recipe` | `reference('recipes')` | yes | Reference to an entry in the recipes collection by its id/slug (e.g. `tofu/buffalo-tofu`). |
| `servings` | number (positive) | yes | Target co-op servings for this dish. |
| `notes` | string[] | no | Head-cook shift notes (pan counts, batching, reminders). |

**Recipe-existence validation:** the `recipe` field uses Astro's built-in
`reference('recipes')` helper (imported from `astro:content`). Astro validates referenced
entries during the content build, so a `recipe` id that doesn't match a real recipe fails the
build. The cook page resolves each reference with `getEntry(dish.recipe)` to load the recipe's
data and body. A typo'd path fails the build, not renders a broken dish.

## Big-batch quantity display (`units.ts`)

The scaling math is unchanged (`scaleIngredient` multiplies `qty`/`qtyMax`/`grams`/`ml` by
`target / recipe.servings`). `units.ts` adds a display-time roll-up that converts a scaled
ingredient into the largest practical unit plus a weight annotation.

### Conversion families

- **Volume:** tsp → tbsp → cup (cup is the ceiling); and mL → L.
  - Factors: 1 tbsp = 3 tsp; 1 cup = 16 tbsp (= 48 tsp); 1 L = 1000 mL.
  - Roll up to the largest unit at which the value is ≥ 1, then humanize the fraction using the
    existing `formatNumber`. E.g. 112 tsp ÷ 48 tsp/cup = 2.33 cups → "≈2⅓ cups"; 24 tsp → "8 tbsp"
    (0.5 cup is below the 1-cup threshold, so it stops at tbsp). Volume rolls up to **cup
    maximum** — quart/gallon are excluded as impractical for a co-op kitchen (the reference docs
    never exceed cups).
- **Weight:** g → kg (≥ 1000 g); oz → lb (≥ 16 oz).
  - kg/lb shown to one decimal; g/oz to whole numbers.
- **Count / descriptive units** (head, clove, can, lemon, bunch, sheet pan, etc.): no
  conversion — show the scaled number and the unit word as-is.
- **Unitless counts:** show the scaled number.

### Output per ingredient

The rolled-up primary measure, plus the metric weight in parens when the recipe carries a
`grams`/`ml` annotation (also rolled up: g→kg, mL→L). Examples:

- `8 tbsp salt (≈145 g)`
- `16 cups BBQ sauce (≈4.3 kg)`
- `27.2 kg bone-in chicken thighs` (weight-primary item; `unit: kg` after roll-up from g)
- `16 lemons` (count, no conversion)

### Rules

- **Ranges** stay ranges through roll-up: both bounds convert in the same family/unit
  (`1–1½ cups` scales and rolls up together).
- **Rounding:** cups/tbsp/tsp → kitchen fractions (nearest eighth, thirds allowed, via the
  existing formatter); kg/lb/L → one decimal; g/mL/oz → whole numbers.
- The chosen display unit is the same for both range bounds.

### Interfaces produced

- `rollUp(value: number, unit?: string): { value: number; unit?: string }` — converts a single
  measure to its largest practical unit within its family (identity for count/descriptive/unitless).
- `formatBatchQuantity(ing: Ingredient): string` — full primary-measure string for a scaled
  ingredient (range-aware), e.g. `"≈⅔ cup"`, `"16 cups"`, `"27.2 kg"`, `"16 lemons"`, or `""`
  when there is no `qty`.
- `formatBatchMetric(ing: Ingredient): string` — the parenthetical weight/volume annotation
  from `grams`/`ml` (rolled up), e.g. `"≈4.3 kg"`, or `""` when none.

These mirror the recipe page's `formatQuantity`/`formatMetric` but apply the batch roll-up.

## Pages

### `/dinners` (index)

Lists all dinner nights (title + date), newest/first by file order or date, each linking to its
cook page. A "Dinners" link is added to the site nav in `BaseLayout.astro`.

### `/dinners/<slug>` (cook page)

Mobile/tablet-first (a cook has a phone or propped tablet in the kitchen): large readable text,
generous spacing, clean. Built via `getStaticPaths` over the `dinners` collection.

Layout top to bottom:
- **Header:** title, date, and the dish list as quick-jump anchor links.
- **Overall shift notes:** the dinner file's markdown body, rendered.
- **One section per dish** (file order). Each dish:
  - Name + target servings ("Buffalo Baked Tofu — 84 servings").
  - **Ingredients:** big-batch display (`formatBatchQuantity` + `formatBatchMetric`), each row
    with a progress checkbox. Ingredient groups render subheadings (reusing the recipe's
    `group` field), same as the recipe page.
  - **Instructions:** the recipe's numbered steps (rendered from the recipe markdown body /
    instructions), each with a checkbox to mark done.
  - **Head-cook notes:** the dish's `notes`, in a visually distinct callout so they stand apart
    from the recipe's own text.

The dish's ingredient/instruction data comes from the referenced recipe, scaled to the dish's
`servings`. The recipe body (instructions/notes prose) is rendered as-is; like the recipe page,
embedded quantities in instruction prose are not rewritten (accepted limitation).

### Progress checkboxes

A React island. Checkbox state is stored in `localStorage`, keyed by dinner slug (and a stable
per-item key: dish index + ingredient/step index), so a cook can refresh or lock their phone
mid-shift without losing progress. State is per-browser, not shared live between cooks. A small
"Reset checklist" control clears this dinner's saved state for reuse next week.

## Authoring workflow

1. Create `src/content/dinners/<name>.md` with `title`, `dishes` (recipe path + servings +
   notes), and overall notes.
2. `npm run build` validates the file and that every referenced recipe exists; commit and push;
   Vercel deploys; share the `/dinners/<name>` URL with the cooks.
3. README gains a dinner authoring guide + an LLM prompt (mirroring the recipe prompt) so a
   rough menu can be turned into a dinner file. Reusing next week = copy the file, adjust
   servings/notes.
4. A dish that isn't a recipe yet is added to the `recipes` collection first (existing format),
   then referenced.

## Sample dinner (seed)

One sample dinner file referencing only existing recipes, e.g. **Baked Night**: `tofu/buffalo-tofu`,
`probation/honey-bbq-chicken-wings`, `probation/mac-n-cheese`, `dinners/beans`,
`bread/dinner-rolls`, with realistic co-op serving targets and a few head-cook notes. This
validates the feature end to end and serves as a worked example.

## Testing

- **TDD (Vitest)** for `units.ts`: family conversions, roll-up thresholds, fraction roll-up,
  ranges, weight g→kg / oz→lb, count/descriptive pass-through, no-qty → empty string.
- Schema validation (including missing-recipe rejection) covered by the build; add a focused
  check that a bad recipe reference fails.
- Pages + checkbox island: passing build + manual verification in the dev server, consistent
  with the recipe site.

## Architecture notes

- Reuses `Ingredient`/`RecipeData` types, `scale.ts` (`scaleFactor`, `scaleIngredient`,
  `formatNumber`), `BaseLayout.astro`, and `global.css`.
- New files are focused and small: `src/content/dinners/` (+ config schema addition),
  `src/lib/units.ts` (+ test), `src/pages/dinners/index.astro`,
  `src/pages/dinners/[...slug].astro`, a `DinnerChecklist.tsx` island (+ CSS), and the sample
  dinner file.
- Static output only; no backend; deploys on commit like the rest of the site.
