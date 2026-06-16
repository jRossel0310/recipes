# Recipe Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a folder of markdown recipes into a mobile-friendly Astro website that scales recipes to a target serving count and builds a consolidated shopping list across recipes.

**Architecture:** Astro static site with React islands for the two interactive pieces (the recipe scaler and the shopping-list builder). Recipes are an Astro content collection with a Zod-validated frontmatter schema, so malformed recipes fail the build. All scaling/merging logic lives in pure, unit-tested TypeScript modules (`scale.ts`, `consolidate.ts`) that both the recipe page and the shopping list reuse.

**Tech Stack:** Astro 4+, `@astrojs/react`, React 18, TypeScript (strict), Zod (bundled with Astro), Vitest. Deploys static output to Vercel (auto-detected, no adapter).

## Global Constraints

- **Node 24 / npm 11** — already installed; Astro and all deps install locally into the project.
- **Static output only** — no Astro server adapter; Vercel serves the built `dist/` directly.
- **Recipe files** live at `src/content/recipes/<category>/<name>.md`; category is the folder name.
- **`qty` is always a JS number** in frontmatter (`0.5`, never `½`). Humanized fractions are a *display* concern handled by `scale.ts`.
- **No qty ⇒ no scaling.** An ingredient without `qty` displays verbatim and is treated as "to taste" in the shopping list.
- **Ingredient type is shared** — defined once in `src/lib/types.ts` and imported everywhere. Do not redefine it per file.
- TDD for pure logic (`scale.ts`, `consolidate.ts`): test first, watch it fail, implement, watch it pass, commit.

---

### Task 1: Scaffold the Astro project

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore` (append if exists)
- Create: `src/env.d.ts`

**Interfaces:**
- Produces: working `npm run dev`, `npm run build`, `npm run test` scripts that later tasks rely on.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "recipes",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install astro@^4 @astrojs/react@^3 react@^18 react-dom@^18
npm install -D @types/react @types/react-dom vitest
```
Expected: installs complete, `node_modules/` and `package-lock.json` created.

- [ ] **Step 3: Create `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  integrations: [react()],
});
```

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  }
}
```

- [ ] **Step 5: Create `src/env.d.ts`**

```ts
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
```

- [ ] **Step 6: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 7: Append build artifacts to `.gitignore`**

Add these lines (create the file if it does not exist):
```
node_modules/
dist/
.astro/
```

- [ ] **Step 8: Verify the toolchain builds**

Run: `npm run build`
Expected: Astro builds with "0 page(s)" (no pages yet) and **no errors**. If it complains about no pages, that is acceptable for this task — the point is that the toolchain resolves.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json astro.config.mjs tsconfig.json vitest.config.ts src/env.d.ts .gitignore
git commit -m "chore: scaffold Astro + React + Vitest project"
```

---

### Task 2: Shared types and the recipe content schema

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/content/config.ts`
- Create: `src/content/recipes/dinners/alfredo.md` (first migrated recipe, used to validate the schema)

**Interfaces:**
- Produces: `Ingredient`, `Nutrition`, `RecipeData` TypeScript types in `src/lib/types.ts`.
- Produces: an Astro `recipes` collection whose entries' `data` matches `RecipeFrontmatter`.

- [ ] **Step 1: Create the shared types in `src/lib/types.ts`**

```ts
export interface Ingredient {
  item: string;
  qty?: number;
  qtyMax?: number;
  unit?: string;
  grams?: number;
  ml?: number;
  note?: string;
  group?: string;
  optional?: boolean;
}

export interface Nutrition {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export interface RecipeData {
  title: string;
  servings: number;
  ingredients: Ingredient[];
}
```

- [ ] **Step 2: Create the Zod schema in `src/content/config.ts`**

```ts
import { defineCollection, z } from 'astro:content';

const ingredient = z.object({
  item: z.string(),
  qty: z.number().optional(),
  qtyMax: z.number().optional(),
  unit: z.string().optional(),
  grams: z.number().optional(),
  ml: z.number().optional(),
  note: z.string().optional(),
  group: z.string().optional(),
  optional: z.boolean().optional(),
});

const recipes = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    source: z.string().optional(),
    servings: z.number().positive(),
    prepTime: z.string().optional(),
    cookTime: z.string().optional(),
    nutrition: z
      .object({
        calories: z.number().optional(),
        protein: z.number().optional(),
        carbs: z.number().optional(),
        fat: z.number().optional(),
      })
      .optional(),
    tags: z.array(z.string()).optional(),
    ingredients: z.array(ingredient).min(1),
  }),
});

export const collections = { recipes };
```

- [ ] **Step 3: Create the first migrated recipe `src/content/recipes/dinners/alfredo.md`**

```markdown
---
title: Easy & Low Calorie High Protein Chicken Alfredo Pasta
source: https://www.joshuaweissman.com/recipes/easy-low-calorie-52g-protein-alfredo-pasta
servings: 4
prepTime: 10 minutes
cookTime: 30 minutes
nutrition:
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
    note: to taste
  - qty: 1.5
    unit: lb
    item: boneless, skinless chicken breasts
    grams: 680
    note: cut in half crosswise into thin cutlets
  - qty: 0.5
    unit: lb
    item: dried fettuccine pasta
    grams: 226
  - item: Cooking spray
    note: for greasing
  - qty: 0.5
    unit: cup
    item: skim milk
    ml: 120
  - qty: 0.25
    unit: cup
    item: Parmigiano Reggiano, grated
    grams: 22
    note: plus more to taste
  - qty: 0.25
    unit: cup
    item: Pecorino Romano, grated
    grams: 22
  - qty: 3
    unit: cloves
    item: garlic
    note: whole
  - qty: 0.5
    unit: tsp
    item: chicken bouillon powder
    grams: 1
---

## Instructions

1. Bring a large pot filled two-thirds full of water to a boil, then season generously with salt. Add the cauliflower florets and cook until extremely soft and tender, about 10–12 minutes. You should be able to pierce through the cauliflower with a fork without any resistance.
2. While the cauliflower boils, season the chicken cutlets generously with salt and pepper, then pat completely dry with paper towels. If the cutlets are uneven in thickness, use a mallet or the palm of your hand to flatten them to a uniform shape so they cook evenly. Heat a large skillet over medium-high heat, grease lightly with cooking spray, then sear the chicken for 2–3 minutes. Flip and continue to cook until the internal temperature reaches 165°F (74°C), about 3–4 more minutes. Repeat with all of the chicken. Set aside to rest, then slice into thin strips just before serving.
3. Using a spider or strainer, transfer the cooked cauliflower to a blender. Add half of the skim milk, followed by the Parmigiano, Pecorino, garlic, salt to taste, and chicken bouillon powder. Blend on high speed until as smooth as possible. Adjust the consistency to match that of a classic Alfredo sauce using the remaining milk as needed.
4. Boil the pasta in heavily salted water according to package directions until al dente. Reserve about 1 cup of pasta water before draining, then transfer the pasta to a large skillet or sauté pan. Toss with the cauliflower Alfredo sauce, adding pasta water a tablespoon at a time to help emulsify, until the pasta is thoroughly coated and glossy. Season to taste with salt. Divide into four bowls, top each with a quarter of the sliced chicken, and optionally garnish with more grated Parmigiano. Serve immediately.

## Notes

* Feel free to season the chicken with spices beyond salt and pepper, but be mindful this may slightly alter the macro counts.
* If you don't have a blender, a food processor, immersion blender, or potato masher all work for pureeing the sauce — though a blender yields the smoothest result.
* Save that pasta water! Adding it gradually is key to getting a glossy, well-emulsified sauce.
* Store leftovers in an airtight container in the refrigerator for up to 3 days. Reheat gently on the stovetop with a splash of milk or water to loosen the sauce.
```

- [ ] **Step 4: Verify the schema validates the recipe**

Run: `npm run build`
Expected: build succeeds and reports 0 pages (no pages yet) but **the content collection loads without schema errors**. To confirm validation actually runs, temporarily change `servings: 4` to `servings: "four"` and rebuild — expect a Zod error naming `servings`. Revert the change afterward.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/content/config.ts src/content/recipes/dinners/alfredo.md
git commit -m "feat: add recipe content collection schema and first recipe"
```

---

### Task 3: Scaling and number-formatting logic (`scale.ts`)

**Files:**
- Create: `src/lib/scale.ts`
- Test: `src/lib/scale.test.ts`

**Interfaces:**
- Consumes: `Ingredient` from `src/lib/types.ts`.
- Produces:
  - `scaleFactor(base: number, target: number): number`
  - `scaleIngredient(ing: Ingredient, factor: number): Ingredient` — multiplies `qty`, `qtyMax`, `grams`, `ml`; leaves everything else untouched; ingredients without `qty` are returned unchanged.
  - `formatNumber(value: number, unit?: string): string` — humanizes one number; fractions for volume/count units, decimal rounding for weight/metric.
  - `formatQuantity(ing: Ingredient): string` — full quantity string for display, e.g. `"¾ cup"`, `"9–12"`, `"339 g"`, or `""` when there is no `qty`.

- [ ] **Step 1: Write the failing tests in `src/lib/scale.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { scaleFactor, scaleIngredient, formatNumber, formatQuantity } from './scale';
import type { Ingredient } from './types';

describe('scaleFactor', () => {
  it('computes target / base', () => {
    expect(scaleFactor(4, 6)).toBeCloseTo(1.5);
    expect(scaleFactor(8, 4)).toBeCloseTo(0.5);
  });
});

describe('scaleIngredient', () => {
  it('multiplies qty, qtyMax, grams, ml', () => {
    const ing: Ingredient = { item: 'pasta', qty: 0.5, qtyMax: 1, unit: 'lb', grams: 226, ml: 100 };
    const out = scaleIngredient(ing, 2);
    expect(out.qty).toBeCloseTo(1);
    expect(out.qtyMax).toBeCloseTo(2);
    expect(out.grams).toBeCloseTo(452);
    expect(out.ml).toBeCloseTo(200);
    expect(out.unit).toBe('lb');
  });

  it('leaves ingredients without qty unchanged', () => {
    const ing: Ingredient = { item: 'salt', note: 'to taste' };
    expect(scaleIngredient(ing, 3)).toEqual(ing);
  });
});

describe('formatNumber', () => {
  it('snaps volume/count units to unicode fractions', () => {
    expect(formatNumber(0.75, 'cup')).toBe('¾');
    expect(formatNumber(1.5, 'cup')).toBe('1½');
    expect(formatNumber(1 / 3, 'cup')).toBe('⅓');
    expect(formatNumber(2, 'cup')).toBe('2');
    expect(formatNumber(0.125, 'tsp')).toBe('⅛');
  });

  it('treats unitless counts as fractions', () => {
    expect(formatNumber(1.5)).toBe('1½');
    expect(formatNumber(3)).toBe('3');
  });

  it('rounds grams and ml to whole numbers', () => {
    expect(formatNumber(338.9, 'g')).toBe('339');
    expect(formatNumber(120.4, 'ml')).toBe('120');
  });

  it('rounds kg, lb, oz to one decimal', () => {
    expect(formatNumber(1.25, 'lb')).toBe('1.3');
    expect(formatNumber(2.0, 'kg')).toBe('2');
  });
});

describe('formatQuantity', () => {
  it('renders qty + unit', () => {
    expect(formatQuantity({ item: 'milk', qty: 0.75, unit: 'cup' })).toBe('¾ cup');
  });

  it('renders a range', () => {
    expect(formatQuantity({ item: 'chicken', qty: 6, qtyMax: 8 })).toBe('6–8');
  });

  it('renders a unitless count', () => {
    expect(formatQuantity({ item: 'eggs', qty: 2 })).toBe('2');
  });

  it('returns empty string when there is no qty', () => {
    expect(formatQuantity({ item: 'salt', note: 'to taste' })).toBe('');
  });

  it('renders grams with unit', () => {
    expect(formatQuantity({ item: 'flour', qty: 339, unit: 'g' })).toBe('339 g');
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm test`
Expected: FAIL — `scale.ts` does not exist / exports undefined.

- [ ] **Step 3: Implement `src/lib/scale.ts`**

```ts
import type { Ingredient } from './types';

export function scaleFactor(base: number, target: number): number {
  return base > 0 ? target / base : 1;
}

export function scaleIngredient(ing: Ingredient, factor: number): Ingredient {
  if (ing.qty === undefined) return ing;
  return {
    ...ing,
    qty: ing.qty * factor,
    qtyMax: ing.qtyMax === undefined ? undefined : ing.qtyMax * factor,
    grams: ing.grams === undefined ? undefined : ing.grams * factor,
    ml: ing.ml === undefined ? undefined : ing.ml * factor,
  };
}

// Units rendered with decimal rounding rather than kitchen fractions.
const WHOLE_UNITS = new Set(['g', 'ml', 'mg']);
const DECIMAL_UNITS = new Set(['kg', 'l', 'lb', 'oz']);

// Fraction value → unicode glyph. Includes eighths plus thirds.
const FRACTIONS: Array<[number, string]> = [
  [0, ''],
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [3 / 8, '⅜'],
  [1 / 2, '½'],
  [5 / 8, '⅝'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [7 / 8, '⅞'],
  [1, ''], // carries into the whole part
];

function trimDecimal(n: number): string {
  // One decimal place, trailing zeros removed: 2.0 -> "2", 1.25 -> "1.3".
  return parseFloat(n.toFixed(1)).toString();
}

function humanizeFraction(value: number): string {
  const whole = Math.floor(value);
  const frac = value - whole;
  let best = FRACTIONS[0];
  let bestDist = Infinity;
  for (const entry of FRACTIONS) {
    const dist = Math.abs(frac - entry[0]);
    if (dist < bestDist) {
      bestDist = dist;
      best = entry;
    }
  }
  let wholePart = whole;
  let glyph = best[1];
  if (best[0] === 1) {
    // Rounded up to the next whole number.
    wholePart += 1;
    glyph = '';
  }
  if (glyph === '') return String(wholePart);
  return wholePart === 0 ? glyph : `${wholePart}${glyph}`;
}

export function formatNumber(value: number, unit?: string): string {
  const u = unit?.toLowerCase();
  if (u && WHOLE_UNITS.has(u)) return String(Math.round(value));
  if (u && DECIMAL_UNITS.has(u)) return trimDecimal(value);
  return humanizeFraction(value);
}

export function formatQuantity(ing: Ingredient): string {
  if (ing.qty === undefined) return '';
  const lo = formatNumber(ing.qty, ing.unit);
  const num = ing.qtyMax === undefined ? lo : `${lo}–${formatNumber(ing.qtyMax, ing.unit)}`;
  return ing.unit ? `${num} ${ing.unit}` : num;
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm test`
Expected: PASS — all `scale.test.ts` cases green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scale.ts src/lib/scale.test.ts
git commit -m "feat: add recipe scaling and number formatting"
```

---

### Task 4: Shopping-list consolidation logic (`consolidate.ts`)

**Files:**
- Create: `src/lib/consolidate.ts`
- Test: `src/lib/consolidate.test.ts`

**Interfaces:**
- Consumes: `Ingredient`, `RecipeData` from `src/lib/types.ts`; `scaleFactor`, `scaleIngredient` from `src/lib/scale.ts`.
- Produces:
  - `interface RecipeSelection { recipe: RecipeData; targetServings: number }`
  - `interface ShoppingItem { item: string; unit?: string; qty?: number; grams?: number; ml?: number; sources: string[]; notes: string[] }`
  - `interface ShoppingList { items: ShoppingItem[]; toTaste: ShoppingItem[] }`
  - `consolidate(selections: RecipeSelection[]): ShoppingList` — scales each recipe to its target servings, then merges ingredients across all recipes. Items sharing a normalized `item`+`unit` sum their `qty`/`grams`/`ml`. Ingredients with no `qty` go to `toTaste`. `sources` lists distinct recipe titles; `notes` lists distinct non-empty notes.

- [ ] **Step 1: Write the failing tests in `src/lib/consolidate.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { consolidate } from './consolidate';
import type { RecipeData } from './types';

const rice: RecipeData = {
  title: 'Mexican Rice',
  servings: 4,
  ingredients: [
    { item: 'garlic', qty: 2, unit: 'cloves' },
    { item: 'long-grain rice', qty: 1, unit: 'cup', grams: 185 },
    { item: 'salt', note: 'to taste' },
  ],
};

const beans: RecipeData = {
  title: 'Beans',
  servings: 4,
  ingredients: [
    { item: 'garlic', qty: 3, unit: 'cloves' },
    { item: 'salt', note: 'to taste' },
  ],
};

describe('consolidate', () => {
  it('merges same item + unit across recipes', () => {
    const list = consolidate([
      { recipe: rice, targetServings: 4 },
      { recipe: beans, targetServings: 4 },
    ]);
    const garlic = list.items.find((i) => i.item.toLowerCase() === 'garlic');
    expect(garlic?.qty).toBe(5);
    expect(garlic?.unit).toBe('cloves');
    expect(garlic?.sources.sort()).toEqual(['Beans', 'Mexican Rice']);
  });

  it('scales quantities to target servings before merging', () => {
    const list = consolidate([{ recipe: rice, targetServings: 8 }]);
    const r = list.items.find((i) => i.item.toLowerCase() === 'long-grain rice');
    expect(r?.qty).toBeCloseTo(2);
    expect(r?.grams).toBeCloseTo(370);
  });

  it('collects no-qty ingredients into toTaste, deduped', () => {
    const list = consolidate([
      { recipe: rice, targetServings: 4 },
      { recipe: beans, targetServings: 4 },
    ]);
    const salt = list.toTaste.find((i) => i.item.toLowerCase() === 'salt');
    expect(salt).toBeTruthy();
    expect(list.items.find((i) => i.item.toLowerCase() === 'salt')).toBeUndefined();
  });

  it('keeps same item with different units separate', () => {
    const a: RecipeData = {
      title: 'A',
      servings: 1,
      ingredients: [{ item: 'milk', qty: 1, unit: 'cup' }],
    };
    const b: RecipeData = {
      title: 'B',
      servings: 1,
      ingredients: [{ item: 'milk', qty: 200, unit: 'ml' }],
    };
    const list = consolidate([
      { recipe: a, targetServings: 1 },
      { recipe: b, targetServings: 1 },
    ]);
    const milks = list.items.filter((i) => i.item.toLowerCase() === 'milk');
    expect(milks).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm test`
Expected: FAIL — `consolidate.ts` does not exist.

- [ ] **Step 3: Implement `src/lib/consolidate.ts`**

```ts
import type { Ingredient, RecipeData } from './types';
import { scaleFactor, scaleIngredient } from './scale';

export interface RecipeSelection {
  recipe: RecipeData;
  targetServings: number;
}

export interface ShoppingItem {
  item: string;
  unit?: string;
  qty?: number;
  grams?: number;
  ml?: number;
  sources: string[];
  notes: string[];
}

export interface ShoppingList {
  items: ShoppingItem[];
  toTaste: ShoppingItem[];
}

function normalize(item: string): string {
  return item.toLowerCase().trim();
}

function addSource(target: ShoppingItem, source: string, note?: string): void {
  if (!target.sources.includes(source)) target.sources.push(source);
  if (note && !target.notes.includes(note)) target.notes.push(note);
}

export function consolidate(selections: RecipeSelection[]): ShoppingList {
  const quantified = new Map<string, ShoppingItem>();
  const toTaste = new Map<string, ShoppingItem>();

  for (const { recipe, targetServings } of selections) {
    const factor = scaleFactor(recipe.servings, targetServings);
    for (const raw of recipe.ingredients) {
      const ing: Ingredient = scaleIngredient(raw, factor);

      if (ing.qty === undefined) {
        const key = normalize(ing.item);
        let entry = toTaste.get(key);
        if (!entry) {
          entry = { item: ing.item, sources: [], notes: [] };
          toTaste.set(key, entry);
        }
        addSource(entry, recipe.title, ing.note);
        continue;
      }

      const key = `${normalize(ing.item)}|${ing.unit ?? ''}`;
      let entry = quantified.get(key);
      if (!entry) {
        entry = { item: ing.item, unit: ing.unit, qty: 0, sources: [], notes: [] };
        quantified.set(key, entry);
      }
      entry.qty = (entry.qty ?? 0) + ing.qty;
      if (ing.grams !== undefined) entry.grams = (entry.grams ?? 0) + ing.grams;
      if (ing.ml !== undefined) entry.ml = (entry.ml ?? 0) + ing.ml;
      addSource(entry, recipe.title, ing.note);
    }
  }

  const byName = (a: ShoppingItem, b: ShoppingItem) => a.item.localeCompare(b.item);
  return {
    items: [...quantified.values()].sort(byName),
    toTaste: [...toTaste.values()].sort(byName),
  };
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm test`
Expected: PASS — all `consolidate.test.ts` cases green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/consolidate.ts src/lib/consolidate.test.ts
git commit -m "feat: add shopping-list consolidation logic"
```

---

### Task 5: Migrate all remaining recipes

**Files:**
- Create: `src/content/recipes/<category>/<name>.md` for all 23 remaining recipes.
- Delete (after migration): the original root-level recipe folders (`bread/`, `breakfasts/`, `desserts/`, `dinners/`, `probation/`, `Tofu/`).

**Interfaces:**
- Produces: a complete `recipes` collection. Every file conforms to the schema from Task 2.

This task is mechanical-with-judgment: read each original markdown file and rewrite it in the
new frontmatter format. There is no unit test; the **build is the test** — the Zod schema
rejects malformed files. Do the recipes in small batches and build after each batch.

**Conversion rules (apply per ingredient line):**
- Leading number → `qty` (convert fractions/unicode to decimals: `½`→`0.5`, `1½`→`1.5`, `3/4`→`0.75`).
- Ranges like `6 to 8` or `2–3` → `qty` (low) + `qtyMax` (high).
- The measurement word (`cup`, `tbsp`, `lb`, `clove`, `head`, `can`, `pinch`…) → `unit`. If there is no measurement word (e.g. "2 lemons"), omit `unit`.
- `(≈226 g)` → `grams: 226`; `(≈120 mL)` → `ml: 120`. Use the low end of a gram range.
- Prep/qualifier tail after a comma ("cut into florets", "to taste", "plus more to taste") → `note`.
- Bolded section labels like `**For the tzatziki sauce:**` → set `group: "For the tzatziki sauce"` on each following ingredient until the next label.
- Lines with no number ("Cooking spray, for greasing", "Salt and pepper, to taste") → `item` + `note`, no `qty`.
- `*OR*` / `**OR**` alternatives and "optional" items → keep as one `item` with the alternative described in `note`; add `optional: true` where the original says optional.
- Keep `## Instructions` and `## Notes` sections as markdown prose, unchanged. Drop the old
  `**Source:** / **Servings:** / ...` header block and the `## Tags` text block — those move
  into frontmatter (`source`, `servings`, `prepTime`, `cookTime`, `tags`).

**Recipes to migrate** (original path → new path):
- `bread/Dinner Rolls.md` → `src/content/recipes/bread/dinner-rolls.md`
- `bread/english-muffins.md` → `src/content/recipes/bread/english-muffins.md`
- `breakfasts/waffles.md` → `src/content/recipes/breakfasts/waffles.md`
- `desserts/conchas.md` → `src/content/recipes/desserts/conchas.md`
- `desserts/vanilla-icream.md` → `src/content/recipes/desserts/vanilla-icream.md`
- `dinners/beans.md` → `src/content/recipes/dinners/beans.md`
- `dinners/chicken-shawarma.md` → `src/content/recipes/dinners/chicken-shawarma.md`
- `dinners/chicken-taco-seasoning.md` → `src/content/recipes/dinners/chicken-taco-seasoning.md`
- `dinners/chimichurri-sauce.md` → `src/content/recipes/dinners/chimichurri-sauce.md`
- `dinners/cilantro-lime-rice.md` → `src/content/recipes/dinners/cilantro-lime-rice.md`
- `dinners/fajitas.md` → `src/content/recipes/dinners/fajitas.md`
- `dinners/herb-salmon.md` → `src/content/recipes/dinners/herb-salmon.md`
- `dinners/mexican-rice.md` → `src/content/recipes/dinners/mexican-rice.md`
- `dinners/mexican-street-corn.md` → `src/content/recipes/dinners/mexican-street-corn.md`
- `dinners/poke-bowl.md` → `src/content/recipes/dinners/poke-bowl.md`
- `dinners/Ravioli.md` → `src/content/recipes/dinners/ravioli.md`
- `dinners/teriyaki-chicken.md` → `src/content/recipes/dinners/teriyaki-chicken.md`
- `dinners/turkey-chili.md` → `src/content/recipes/dinners/turkey-chili.md`
- `probation/honey-BBQ-chicken-wings.md` → `src/content/recipes/probation/honey-bbq-chicken-wings.md`
- `probation/mac-n-cheese.md` → `src/content/recipes/probation/mac-n-cheese.md`
- `probation/ravioli-beef-filling.md` → `src/content/recipes/probation/ravioli-beef-filling.md`
- `Tofu/buffalo-tofu.md` → `src/content/recipes/tofu/buffalo-tofu.md`
- `Tofu/taco-crumbles.md` → `src/content/recipes/tofu/taco-crumbles.md`

- [ ] **Step 1: Migrate recipes in batches**

For each recipe: read the original file, rewrite it at the new path using the conversion rules
above and the Task 2 alfredo file as the reference pattern. Work in batches of ~5.

- [ ] **Step 2: Build after each batch**

Run: `npm run build`
Expected: succeeds with no schema errors. If a file fails, the error names the file and field — fix and rebuild.

- [ ] **Step 3: Delete the original root recipe folders**

Run:
```bash
git rm -r bread breakfasts desserts dinners probation Tofu
```
Expected: all original recipe files staged for deletion. (The migrated copies live under `src/content/recipes/`.)

- [ ] **Step 4: Final validation build**

Run: `npm run build`
Expected: builds clean; all 24 recipes load.

- [ ] **Step 5: Commit**

```bash
git add src/content/recipes
git commit -m "feat: migrate all recipes to structured frontmatter"
```

---

### Task 6: Base layout and home page

**Files:**
- Create: `src/layouts/BaseLayout.astro`
- Create: `src/styles/global.css`
- Create: `src/pages/index.astro`

**Interfaces:**
- Consumes: the `recipes` content collection.
- Produces: the site shell (`BaseLayout`) and the browse-by-category home page. Recipe URLs follow `/recipes/<category>/<slug>` where `slug = entry.id without ".md"`.

- [ ] **Step 1: Create `src/styles/global.css`**

```css
:root {
  --bg: #fbf7f0;
  --fg: #2b2620;
  --accent: #b5481f;
  --card: #ffffff;
  --border: #e6ddcd;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); line-height: 1.5; }
a { color: var(--accent); }
.container { max-width: 760px; margin: 0 auto; padding: 1rem; }
header.site { border-bottom: 1px solid var(--border); }
header.site .container { display: flex; gap: 1rem; align-items: baseline; }
header.site a { text-decoration: none; font-weight: 600; }
.card {
  display: block; background: var(--card); border: 1px solid var(--border);
  border-radius: 12px; padding: 0.85rem 1rem; text-decoration: none; color: inherit;
}
.card:hover { border-color: var(--accent); }
.grid { display: grid; gap: 0.6rem; grid-template-columns: 1fr; }
@media (min-width: 520px) { .grid { grid-template-columns: 1fr 1fr; } }
h2.category { margin: 1.5rem 0 0.5rem; text-transform: capitalize; }
```

- [ ] **Step 2: Create `src/layouts/BaseLayout.astro`**

```astro
---
import '../styles/global.css';
interface Props { title: string }
const { title } = Astro.props;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
  </head>
  <body>
    <header class="site">
      <div class="container">
        <a href="/">🍳 Recipes</a>
        <a href="/shopping-list">Shopping list</a>
      </div>
    </header>
    <main class="container">
      <slot />
    </main>
  </body>
</html>
```

- [ ] **Step 3: Create `src/pages/index.astro`**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../layouts/BaseLayout.astro';

const recipes = await getCollection('recipes');
const byCategory = new Map<string, typeof recipes>();
for (const r of recipes) {
  const category = r.id.split('/')[0];
  if (!byCategory.has(category)) byCategory.set(category, []);
  byCategory.get(category)!.push(r);
}
const categories = [...byCategory.keys()].sort();
---
<BaseLayout title="Recipes">
  <h1>Recipes</h1>
  {categories.map((category) => (
    <section>
      <h2 class="category">{category}</h2>
      <div class="grid">
        {byCategory.get(category)!
          .sort((a, b) => a.data.title.localeCompare(b.data.title))
          .map((r) => (
            <a class="card" href={`/recipes/${r.id.replace(/\.md$/, '')}`}>
              {r.data.title}
            </a>
          ))}
      </div>
    </section>
  ))}
</BaseLayout>
```

- [ ] **Step 4: Verify the home page renders**

Run: `npm run dev`, open `http://localhost:4321/`
Expected: categories (bread, breakfasts, desserts, dinners, probation, tofu) each list their recipes as cards. Stop the dev server when done.

- [ ] **Step 5: Commit**

```bash
git add src/styles/global.css src/layouts/BaseLayout.astro src/pages/index.astro
git commit -m "feat: add base layout and browse-by-category home page"
```

---

### Task 7: Recipe page with the scaler island

**Files:**
- Create: `src/components/RecipeScaler.tsx`
- Create: `src/components/RecipeScaler.css`
- Create: `src/pages/recipes/[...slug].astro`

**Interfaces:**
- Consumes: `Ingredient` from `src/lib/types.ts`; `scaleIngredient`, `scaleFactor`, `formatQuantity` from `src/lib/scale.ts`; the `recipes` collection.
- Produces: a React island `RecipeScaler` that holds target-servings state and renders the scaled, grouped ingredient list. The Astro page renders metadata, nutrition, the island, then the markdown body (instructions + notes).

- [ ] **Step 1: Create `src/components/RecipeScaler.css`**

```css
.scaler { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 1rem; margin: 1rem 0; }
.stepper { display: flex; align-items: center; gap: 0.75rem; }
.stepper button { font-size: 1.25rem; width: 2.5rem; height: 2.5rem; border-radius: 8px; border: 1px solid var(--border); background: #fff; cursor: pointer; }
.stepper .count { font-size: 1.25rem; font-weight: 600; min-width: 2ch; text-align: center; }
.stepper .reset { width: auto; padding: 0 0.6rem; font-size: 0.85rem; }
.ingredients { list-style: none; padding: 0; margin: 1rem 0 0; }
.ingredients li { padding: 0.35rem 0; border-bottom: 1px solid var(--border); }
.ingredients .qty { font-weight: 600; }
.ingredients .note { color: #897f6d; }
.ingredients h3 { margin: 1rem 0 0.25rem; font-size: 0.95rem; }
.ingredients .optional::after { content: ' (optional)'; color: #897f6d; font-style: italic; }
```

- [ ] **Step 2: Create `src/components/RecipeScaler.tsx`**

```tsx
import { useState } from 'react';
import type { Ingredient } from '../lib/types';
import { scaleFactor, scaleIngredient, formatQuantity } from '../lib/scale';
import './RecipeScaler.css';

interface Props {
  baseServings: number;
  ingredients: Ingredient[];
}

export default function RecipeScaler({ baseServings, ingredients }: Props) {
  const [servings, setServings] = useState(baseServings);
  const factor = scaleFactor(baseServings, servings);
  const scaled = ingredients.map((ing) => scaleIngredient(ing, factor));

  // Render in original order, inserting a subheading whenever `group` changes.
  let lastGroup: string | undefined;
  const rows = scaled.map((ing, i) => {
    const showGroup = ing.group && ing.group !== lastGroup;
    lastGroup = ing.group;
    const qty = formatQuantity(ing);
    return (
      <li key={i} className={ing.optional ? 'optional' : undefined}>
        {showGroup && <h3>{ing.group}</h3>}
        {qty && <span className="qty">{qty}</span>} {ing.item}
        {ing.note && <span className="note"> — {ing.note}</span>}
      </li>
    );
  });

  return (
    <div className="scaler">
      <div className="stepper">
        <button aria-label="Fewer servings" onClick={() => setServings((s) => Math.max(1, s - 1))}>−</button>
        <span className="count">{servings}</span>
        <button aria-label="More servings" onClick={() => setServings((s) => s + 1)}>+</button>
        <span>servings</span>
        {servings !== baseServings && (
          <button className="reset" onClick={() => setServings(baseServings)}>reset</button>
        )}
      </div>
      <ul className="ingredients">{rows}</ul>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/pages/recipes/[...slug].astro`**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import RecipeScaler from '../../components/RecipeScaler';

export async function getStaticPaths() {
  const recipes = await getCollection('recipes');
  return recipes.map((entry) => ({
    params: { slug: entry.id.replace(/\.md$/, '') },
    props: { entry },
  }));
}

const { entry } = Astro.props;
const { Content } = await entry.render();
const d = entry.data;
---
<BaseLayout title={d.title}>
  <h1>{d.title}</h1>
  <p>
    {d.source && (d.source.startsWith('http')
      ? <a href={d.source}>Source</a>
      : <span>{d.source}</span>)}
    {d.prepTime && <span> · Prep {d.prepTime}</span>}
    {d.cookTime && <span> · Cook {d.cookTime}</span>}
  </p>
  {d.nutrition && (
    <p>
      Per serving:
      {d.nutrition.calories && <span> {d.nutrition.calories} cal</span>}
      {d.nutrition.protein && <span> · {d.nutrition.protein} g protein</span>}
      {d.nutrition.carbs && <span> · {d.nutrition.carbs} g carbs</span>}
      {d.nutrition.fat && <span> · {d.nutrition.fat} g fat</span>}
    </p>
  )}

  <RecipeScaler client:load baseServings={d.servings} ingredients={d.ingredients} />

  <article>
    <Content />
  </article>
</BaseLayout>
```

- [ ] **Step 4: Verify scaling works in the browser**

Run: `npm run dev`, open a recipe (e.g. `http://localhost:4321/recipes/dinners/alfredo`).
Expected: ingredient list shows with quantities; tapping **+**/**−** rescales every quantity (e.g. at 6 servings the cauliflower reads `1½ head`, pasta `¾ lb (339 g)`); a grouped recipe (chicken-shawarma) shows subheadings; instructions/notes render below and do **not** change. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/components/RecipeScaler.tsx src/components/RecipeScaler.css "src/pages/recipes/[...slug].astro"
git commit -m "feat: add recipe page with interactive serving scaler"
```

---

### Task 8: Shopping list page with the builder island

**Files:**
- Create: `src/components/ShoppingListBuilder.tsx`
- Create: `src/components/ShoppingListBuilder.css`
- Create: `src/pages/shopping-list.astro`

**Interfaces:**
- Consumes: `RecipeData` from `src/lib/types.ts`; `consolidate`, `ShoppingItem` from `src/lib/consolidate.ts`; `formatQuantity`/`formatNumber` from `src/lib/scale.ts`; the `recipes` collection.
- Produces: a React island that takes a `recipes: Array<{ slug, title, category, data: RecipeData }>` prop, lets the user select recipes and set per-recipe servings, and renders the merged list with a copy-to-clipboard button.

- [ ] **Step 1: Create `src/components/ShoppingListBuilder.css`**

```css
.slb { display: grid; gap: 1rem; }
.slb .pick { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 1rem; }
.slb .row { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; }
.slb .row label { flex: 1; }
.slb .row input[type='number'] { width: 4rem; }
.slb .out { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 1rem; }
.slb .out ul { list-style: none; padding: 0; margin: 0.5rem 0; }
.slb .out li { padding: 0.25rem 0; border-bottom: 1px solid var(--border); }
.slb .src { color: #897f6d; font-size: 0.85rem; }
.slb h3.cat { text-transform: capitalize; margin: 0.75rem 0 0.25rem; }
```

- [ ] **Step 2: Create `src/components/ShoppingListBuilder.tsx`**

```tsx
import { useMemo, useState } from 'react';
import type { RecipeData } from '../lib/types';
import { consolidate, type ShoppingItem } from '../lib/consolidate';
import { formatNumber } from '../lib/scale';
import './ShoppingListBuilder.css';

export interface RecipeChoice {
  slug: string;
  title: string;
  category: string;
  data: RecipeData;
}

interface Props { recipes: RecipeChoice[] }

interface Selected { servings: number }

function itemLine(item: ShoppingItem): string {
  const parts: string[] = [];
  if (item.qty !== undefined) {
    parts.push(item.unit ? `${formatNumber(item.qty, item.unit)} ${item.unit}` : formatNumber(item.qty));
  }
  let line = `${parts.join(' ')} ${item.item}`.trim();
  if (item.grams !== undefined && item.unit !== 'g') line += ` (~${Math.round(item.grams)} g)`;
  return line;
}

export default function ShoppingListBuilder({ recipes }: Props) {
  const [selected, setSelected] = useState<Record<string, Selected>>({});

  const byCategory = useMemo(() => {
    const m = new Map<string, RecipeChoice[]>();
    for (const r of recipes) {
      if (!m.has(r.category)) m.set(r.category, []);
      m.get(r.category)!.push(r);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [recipes]);

  const list = useMemo(() => {
    const sel = recipes
      .filter((r) => selected[r.slug])
      .map((r) => ({ recipe: r.data, targetServings: selected[r.slug].servings }));
    return consolidate(sel);
  }, [recipes, selected]);

  function toggle(r: RecipeChoice) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[r.slug]) delete next[r.slug];
      else next[r.slug] = { servings: r.data.servings };
      return next;
    });
  }

  function setServings(slug: string, servings: number) {
    setSelected((prev) => ({ ...prev, [slug]: { servings: Math.max(1, servings) } }));
  }

  const text = useMemo(() => {
    const lines = list.items.map((i) => `- ${itemLine(i)}`);
    if (list.toTaste.length) {
      lines.push('', 'To taste / as needed:');
      lines.push(...list.toTaste.map((i) => `- ${i.item}`));
    }
    return lines.join('\n');
  }, [list]);

  const anySelected = Object.keys(selected).length > 0;

  return (
    <div className="slb">
      <div className="pick">
        <h2>Pick recipes</h2>
        {byCategory.map(([cat, rs]) => (
          <div key={cat}>
            <h3 className="cat">{cat}</h3>
            {rs.map((r) => (
              <div className="row" key={r.slug}>
                <input
                  type="checkbox"
                  id={r.slug}
                  checked={!!selected[r.slug]}
                  onChange={() => toggle(r)}
                />
                <label htmlFor={r.slug}>{r.title}</label>
                {selected[r.slug] && (
                  <input
                    type="number"
                    min={1}
                    value={selected[r.slug].servings}
                    onChange={(e) => setServings(r.slug, Number(e.target.value))}
                    aria-label={`${r.title} servings`}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {anySelected && (
        <div className="out">
          <h2>Shopping list</h2>
          <button onClick={() => navigator.clipboard.writeText(text)}>Copy as text</button>
          <ul>
            {list.items.map((i, idx) => (
              <li key={idx}>
                {itemLine(i)}
                {i.sources.length > 1 && <span className="src"> — {i.sources.join(', ')}</span>}
              </li>
            ))}
          </ul>
          {list.toTaste.length > 0 && (
            <>
              <h3>To taste / as needed</h3>
              <ul>
                {list.toTaste.map((i, idx) => <li key={idx}>{i.item}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/pages/shopping-list.astro`**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../layouts/BaseLayout.astro';
import ShoppingListBuilder, { type RecipeChoice } from '../components/ShoppingListBuilder';

const entries = await getCollection('recipes');
const recipes: RecipeChoice[] = entries.map((e) => ({
  slug: e.id.replace(/\.md$/, ''),
  title: e.data.title,
  category: e.id.split('/')[0],
  data: { title: e.data.title, servings: e.data.servings, ingredients: e.data.ingredients },
}));
---
<BaseLayout title="Shopping list">
  <h1>Shopping list builder</h1>
  <ShoppingListBuilder client:load recipes={recipes} />
</BaseLayout>
```

- [ ] **Step 4: Verify the builder in the browser**

Run: `npm run dev`, open `http://localhost:4321/shopping-list`.
Expected: recipes listed by category with checkboxes; selecting two recipes that share an ingredient (e.g. mexican-rice + beans, both with garlic) merges it into one line with summed quantity and both sources; changing a per-recipe servings number updates quantities; "to taste" items appear in their own section; "Copy as text" copies the list. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/components/ShoppingListBuilder.tsx src/components/ShoppingListBuilder.css src/pages/shopping-list.astro
git commit -m "feat: add shopping list builder page"
```

---

### Task 9: Update authoring docs and remove the Python script

**Files:**
- Modify: `README.md` (replace the old LLM prompt with the new frontmatter prompt + schema docs)
- Delete: `shopping_list.py`

**Interfaces:**
- Produces: an updated authoring workflow that emits the new frontmatter format. No code consumes this.

- [ ] **Step 1: Rewrite `README.md`**

Replace the entire file with the content below.

````markdown
# Recipes

A scalable recipe website built with Astro. Recipes live in
`src/content/recipes/<category>/<name>.md` as markdown with structured frontmatter.

## Local development

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # production build (also validates every recipe)
npm test         # unit tests for scaling + shopping-list logic
```

Deploys automatically to Vercel on every commit.

## Recipe file format

Frontmatter holds the metadata and ingredients; the markdown body holds instructions and notes.

| Field | Required | Notes |
|-------|----------|-------|
| `title` | yes | Display name |
| `source` | no | URL or free text |
| `servings` | yes | Base serving count the quantities are written for |
| `prepTime` / `cookTime` | no | Free text |
| `nutrition` | no | Per serving: `calories`, `protein`, `carbs`, `fat` |
| `tags` | no | String list |
| `ingredients` | yes | List of ingredient objects (below) |

Ingredient fields: `item` (required), `qty`, `qtyMax` (range upper bound), `unit`, `grams`,
`ml`, `note`, `group` (subsection label), `optional`. **Omit `qty` for "to taste" items** —
they display verbatim and never scale. Always write `qty` as a plain number (`0.5`, not `½`).

## Adding a recipe with an LLM

Paste the prompt below into an LLM along with a recipe (text or link). It produces a ready-to-save file.

---

Convert the following recipe into a Markdown file for my Astro recipe site.

OUTPUT RULES
- Output only the file contents, nothing else.
- Suggest a kebab-case filename on the first line as a comment: `<!-- fajitas.md -->`.

FRONTMATTER (YAML)
- `title`, `source` (URL or "personal recipe"), `servings` (number), `prepTime`, `cookTime`.
- `nutrition` (per serving): `calories`, `protein`, `carbs`, `fat` — estimate if not given.
- `tags`: 3–6 short tags.
- `ingredients`: a YAML list. Each item:
  - `item` (required, the ingredient name)
  - `qty` (number; convert fractions to decimals: ½ → 0.5, 1½ → 1.5, 3/4 → 0.75)
  - `qtyMax` (only for ranges like "6 to 8" → qty: 6, qtyMax: 8)
  - `unit` (cup, tbsp, tsp, lb, oz, g, kg, ml, clove, head, can, pinch… or omit for plain counts)
  - `grams` / `ml` (metric conversion when applicable; use the low end of a range)
  - `note` (prep or qualifier, e.g. "cut into florets", "to taste", "plus more to taste")
  - `group` (only if the recipe has sections, e.g. "For the tzatziki sauce")
  - `optional: true` (only for optional ingredients)
  - For "to taste"/"for greasing" items with no amount, omit `qty` and put the phrase in `note`.

BODY (markdown, after the frontmatter)
- `## Instructions` as a numbered list.
- `## Notes` as bullets (tips, storage, scaling).

If you cannot read the recipe from a link, reply only: "I cannot access the recipe from this link. Please provide the recipe text."

Here is the recipe to convert:

[PASTE RECIPE TEXT OR LINK HERE]
````

- [ ] **Step 2: Remove the superseded Python script**

Run:
```bash
git rm shopping_list.py
```
Expected: `shopping_list.py` staged for deletion (it only understood the old prose format; the site's shopping-list builder replaces it).

- [ ] **Step 3: Final full build + tests**

Run: `npm run build && npm test`
Expected: build succeeds (all recipes validate), all unit tests pass.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: update authoring workflow for frontmatter format; remove shopping_list.py"
```

---

## Verification checklist (after all tasks)

- [ ] `npm run build` succeeds with all 24 recipes validated.
- [ ] `npm test` passes (`scale.test.ts`, `consolidate.test.ts`).
- [ ] Home page lists every recipe grouped by category.
- [ ] A recipe page rescales all quantities via the stepper; instructions stay static; grouped recipes show subheadings; ranges scale both ends.
- [ ] The shopping list builder merges shared ingredients, sums quantities, scales per-recipe servings, separates to-taste items, and copies as text.
- [ ] `shopping_list.py` and the old root recipe folders are gone; `README.md` documents the new format.
- [ ] Push to the Vercel-connected repo and confirm the deployment builds.
```

