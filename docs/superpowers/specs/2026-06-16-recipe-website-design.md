# Recipe Website — Design Spec

**Date:** 2026-06-16
**Status:** Approved (pending implementation plan)

## Goal

Turn a folder of markdown recipe files into a mobile-friendly website that:

1. Lets you browse and read recipes on any device.
2. Scales any recipe to a target number of servings, with every quantity updating correctly.
3. Keeps adding recipes easy and safe (validation catches mistakes before they ship).
4. Builds a consolidated shopping list across multiple selected recipes.

## Stack & hosting

- **Astro** static site, with **React** components for the interactive islands.
- **Vercel** free tier, auto-deploy on commit (matches the user's existing workflow). Fully static output — no server adapter needed.
- **Vitest** for unit tests on the pure scaling/merging logic.
- Node 24 / npm 11 already installed locally; Astro installs as a local project dependency. Nothing to install globally.

## Recipe file format

Each recipe is a single file at `src/content/recipes/<category>/<name>.md`. Metadata and
ingredients live in structured frontmatter; instructions and notes stay as markdown prose
below. Category is derived from the folder name.

### Example

```markdown
---
title: Easy & Low Calorie High Protein Chicken Alfredo Pasta
source: https://www.joshuaweissman.com/recipes/easy-low-calorie-52g-protein-alfredo-pasta
servings: 4
prepTime: 10 minutes
cookTime: 30 minutes
nutrition:            # per serving; optional
  calories: 470
  protein: 52
  carbs: 53
  fat: 6
tags: [high-protein, low-calorie, pasta, chicken, alfredo, meal-prep]
ingredients:
  - qty: 1
    unit: head
    item: cauliflower
    grams: 908
    note: cut into florets
  - item: Kosher salt and freshly ground black pepper
    note: to taste            # no qty → never scales, just displays
  - qty: 1.5
    unit: lb
    item: boneless, skinless chicken breasts
    grams: 680
    note: cut in half crosswise into thin cutlets
  - qty: 0.5
    unit: lb
    item: dried fettuccine pasta
    grams: 226
  - qty: 0.5
    unit: cup
    item: skim milk
    ml: 120
  - qty: 0.25
    unit: cup
    item: Parmigiano Reggiano, grated
    grams: 22
    note: plus more to taste
  - qty: 0.5
    unit: tsp
    item: chicken bouillon powder
    grams: 1
---

## Instructions

1. Bring a large pot ...

## Notes

* Feel free to season ...
```

### Schema (enforced at build time via Astro content collections + Zod)

Top-level frontmatter fields:

| Field       | Type                          | Required | Notes |
|-------------|-------------------------------|----------|-------|
| `title`     | string                        | yes      | Recipe display name. |
| `source`    | string                        | no       | URL or free text (e.g. "personal recipe"). |
| `servings`  | number                        | yes      | Base serving count the ingredient quantities are written for. |
| `prepTime`  | string                        | no       | Free text (e.g. "10 minutes"). |
| `cookTime`  | string                        | no       | Free text. |
| `nutrition` | object                        | no       | Per-serving. Keys: `calories`, `protein`, `carbs`, `fat` (all optional numbers). |
| `tags`      | string[]                      | no       | Used for future search/filter; displayed on the recipe page. |
| `ingredients` | Ingredient[]                | yes      | See below. |

Ingredient item fields:

| Field      | Type    | Required | Notes |
|------------|---------|----------|-------|
| `item`     | string  | yes      | The ingredient name as displayed. |
| `qty`      | number  | no        | Exact numeric quantity. Absent → ingredient does not scale (e.g. "to taste"). |
| `qtyMax`   | number  | no        | Upper bound of a range. Renders as `qty–qtyMax`; both ends scale. |
| `unit`     | string  | no        | Any string: `cup`, `tsp`, `tbsp`, `lb`, `oz`, `g`, `kg`, `ml`, `head`, `clove`, `can`, `pinch`, etc. Display + shopping-list matching only. |
| `grams`    | number  | no        | Metric weight annotation; scales linearly. |
| `ml`       | number  | no        | Metric volume annotation; scales linearly. |
| `note`     | string  | no        | Trailing descriptor (e.g. "cut into florets", "to taste", "plus more to taste"). |
| `group`    | string  | no        | Optional subsection label (e.g. "For the tzatziki"). Consecutive items with the same group render under a subheading. |
| `optional` | boolean | no        | Flags the ingredient as optional for display. |

A build fails with a file-and-field error if a recipe violates the schema (missing `item`,
typo'd field name, wrong type, etc.). This is the primary safety net for easy authoring.

## Site structure

```
src/
  content/
    config.ts              # Zod recipe schema
    recipes/<category>/*.md
  layouts/
    BaseLayout.astro       # shared shell: header, nav, mobile-first
    RecipeLayout.astro     # recipe page structure
  components/
    ServingStepper.tsx     # React island — target-servings control
    IngredientList.tsx     # React island — re-renders scaled quantities
    ShoppingListBuilder.tsx# React island — the builder
  lib/
    scale.ts               # scaling math + number/fraction formatting
    consolidate.ts         # merge ingredients across recipes
  pages/
    index.astro            # browse: recipes grouped by category
    recipes/[...slug].astro# one page per recipe
    shopping-list.astro    # the builder page
```

### Pages

1. **Home (`/`)** — recipes grouped by category, each a card/link. Mobile-first.
2. **Recipe page (`/recipes/<category>/<slug>`)** — title, meta, per-serving nutrition,
   servings stepper, scaling ingredient list (grouped where `group` is set), then
   instructions and notes rendered from markdown.
3. **Shopping list (`/shopping-list`)** — select recipes, set servings each, merged list.

Only the stepper, ingredient list, and shopping builder ship JavaScript; everything else is
static HTML.

## Scaling behavior

- `factor = targetServings / recipe.servings`; multiply each ingredient's `qty`, `qtyMax`,
  `grams`, `ml` by `factor`.
- **Number formatting (`scale.ts`):**
  - Volume/count units (`cup`, `tsp`, `tbsp`, `head`, `clove`, plain counts) → snap to nice
    kitchen fractions and render unicode: `0.75 cup` → `¾ cup`, `1.5` → `1½`,
    `0.333… cup` → `⅓ cup`. Round to nearest eighth, with thirds allowed.
  - Weights/metric (`g`, `kg`, `ml`, `lb`, `oz`) → grams/ml to whole numbers; kg/lb to one
    decimal.
  - Ranges → both ends scale: `6–8` at ×1.5 → `9–12`.
- A one-tap reset returns to the recipe's original servings.
- **Limitation (accepted):** the ingredient list is the source of truth and always scales.
  Instructions prose stays static (does not rewrite embedded quantities). Current servings is
  displayed prominently. Inline-token rewriting of instructions is explicitly out of scope for
  v1.

## Shopping list builder

- All recipe data is embedded client-side as JSON at build time.
- Select recipes via checkboxes (grouped by category); set servings per recipe (defaults to
  each recipe's own count).
- Merge ingredients with the same `item` + `unit` by summing `qty`; roll up `grams`/`ml`
  totals where present. Items with the same `item` but different units list separately.
- "To taste / as needed" items (no `qty`) collect into their own section.
- Output is copy-able as plain text.
- Reuses `scale.ts` and shared merging logic in `consolidate.ts`.

## Migration & authoring

- **Migrate** all 24 existing recipes into the new frontmatter format, done once by reading
  each file with judgment (handling ranges, groups, odd lines) rather than a runtime parser.
  Spot-check a sample with the user before the full batch.
- **Rewrite [README.md](../../../README.md)** (the LLM conversion prompt) to emit the new
  frontmatter format, so the "paste a recipe → get a file" workflow continues. Document the
  schema for hand-authoring.
- **Remove `shopping_list.py`** from the working tree (superseded by the site builder; only
  understood the old prose format). It remains in git history.

## Testing

- **Test-first (Vitest)** for the pure logic:
  - `scale.ts`: fraction formatting, ranges, weights, unit-specific rounding.
  - `consolidate.ts`: merging, unit conflicts, grams roll-up, to-taste handling.
- Astro pages and React islands: a passing build (which validates every recipe against the
  schema) plus manual verification in the dev server.

## Out of scope for v1

- Search and tag filtering (data is preserved; easy to add later).
- Scaled nutrition (nutrition stays per-serving display only).
- Rewriting quantities embedded in instruction prose.
- User accounts, favoriting, or any backend/database.
```

