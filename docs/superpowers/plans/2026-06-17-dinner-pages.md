# Head-Cook Dinner Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dinner-night pages to the recipe site: a head cook assembles existing recipes into a dinner, each scaled to a co-op serving count and shown in practical big-batch units, with shift notes and progress checkboxes for the cooking crew.

**Architecture:** A new `dinners` Astro content collection references existing recipes via `reference('recipes')` and a per-dish servings target. Pure modules turn a `recipe + servings` into display-ready data: `units.ts` rolls scaled quantities up to the largest practical unit + weight, and `dinner.ts` assembles each dish (scaled ingredient lines + extracted instruction steps + notes). A `/dinners/<slug>` page resolves the references at build time and hands plain data to a `DinnerChecklist` React island that renders the page and persists checkbox state in `localStorage`. Static output, deploys on commit like the rest of the site.

**Tech Stack:** Astro 4, `@astrojs/react`, React 18, Zod (via `astro:content`), Vitest. Reuses `src/lib/scale.ts`, `src/lib/types.ts`, `BaseLayout.astro`, `global.css`.

## Global Constraints

- **Reuse, don't duplicate:** a dinner references recipes by id/slug; recipe ingredient/instruction data is never copied into the dinner file.
- **`reference('recipes')`** is the dish→recipe link; a dish pointing at a non-existent recipe must fail the build.
- **Scaling reuses `scale.ts`** (`scaleFactor`, `scaleIngredient`, `formatNumber`) — no reimplemented multiply or fraction logic.
- **Big-batch volume rolls up to `cup` maximum** (tsp → tbsp → cup); quart/gallon are intentionally excluded as impractical for a co-op kitchen (the reference docs never exceed cups). This is a deliberate refinement of the spec's ladder.
- **`qty` stays a JS number; no `qty` ⇒ no scaling and an empty primary string** (consistent with the recipe site).
- **No em dashes in new code/UI copy** (the author dislikes them) — use a middot `·` for meta separators and a hyphen `-` for inline asides.
- **Static output only**, no backend; checkbox state lives in `localStorage` per browser.
- TDD for the pure modules (`units.ts`, `dinner.ts`): test first, fail, implement, pass, commit.

---

### Task 1: Big-batch unit roll-up (`units.ts`)

**Files:**
- Create: `src/lib/units.ts`
- Test: `src/lib/units.test.ts`

**Interfaces:**
- Consumes: `Ingredient` from `src/lib/types.ts`; `formatNumber` from `src/lib/scale.ts`.
- Produces:
  - `rollUp(value: number, unit?: string): { value: number; unit?: string }` — converts a single measure to the largest practical unit in its family (volume → cup max; mL → L; g → kg; oz → lb). Identity for count/descriptive/unitless units.
  - `formatBatchQuantity(ing: Ingredient): string` — range-aware primary measure string for an (already-scaled) ingredient, e.g. `"2⅓ cups"`, `"½ cup"`, `"27.2 kg"`, `"16 lemons"`, `"240–360 mL"`, or `""` when no `qty`.
  - `formatBatchMetric(ing: Ingredient): string` — parenthetical weight/volume from `grams`/`ml`, rolled up (`"≈4.3 kg"`, `"≈2 L"`), or `""`.

- [ ] **Step 1: Write the failing tests in `src/lib/units.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { rollUp, formatBatchQuantity, formatBatchMetric } from './units';

describe('rollUp', () => {
  it('rolls tsp up to cups at the cup ceiling', () => {
    const r = rollUp(112, 'tsp'); // 112/48 = 2.333 cups
    expect(r.unit).toBe('cup');
    expect(r.value).toBeCloseTo(112 / 48);
  });
  it('keeps small volumes in their unit', () => {
    expect(rollUp(2, 'tsp')).toEqual({ value: 2, unit: 'tsp' });
  });
  it('does not roll past cup', () => {
    const r = rollUp(16, 'cup'); // would be 1 gallon, but cup is the ceiling
    expect(r.unit).toBe('cup');
    expect(r.value).toBeCloseTo(16);
  });
  it('rolls grams up to kg', () => {
    const r = rollUp(27200, 'g');
    expect(r.unit).toBe('kg');
    expect(r.value).toBeCloseTo(27.2);
  });
  it('rolls oz up to lb', () => {
    expect(rollUp(32, 'oz')).toEqual({ value: 2, unit: 'lb' });
  });
  it('leaves count/descriptive units unchanged', () => {
    expect(rollUp(16, 'lemons')).toEqual({ value: 16, unit: 'lemons' });
    expect(rollUp(5, undefined)).toEqual({ value: 5, unit: undefined });
  });
});

describe('formatBatchQuantity', () => {
  it('formats a rolled-up volume with pluralized cups', () => {
    expect(formatBatchQuantity({ item: 'salt', qty: 112, unit: 'tsp' })).toBe('2⅓ cups');
  });
  it('uses tbsp when the value is below one cup (largest unit >= 1)', () => {
    expect(formatBatchQuantity({ item: 'salt', qty: 24, unit: 'tsp' })).toBe('8 tbsp');
  });
  it('keeps a single cup singular', () => {
    expect(formatBatchQuantity({ item: 'milk', qty: 1, unit: 'cup' })).toBe('1 cup');
  });
  it('formats weight rolled to kg', () => {
    expect(formatBatchQuantity({ item: 'chicken', qty: 27200, unit: 'g' })).toBe('27.2 kg');
  });
  it('formats a count with its unit word', () => {
    expect(formatBatchQuantity({ item: 'lemons', qty: 16, unit: 'lemons' })).toBe('16 lemons');
  });
  it('formats a unitless count', () => {
    expect(formatBatchQuantity({ item: 'eggs', qty: 6 })).toBe('6');
  });
  it('formats a range in a single rolled-up unit', () => {
    expect(formatBatchQuantity({ item: 'vinegar', qty: 240, qtyMax: 360, unit: 'ml' })).toBe('240–360 mL');
  });
  it('returns empty string when there is no qty', () => {
    expect(formatBatchQuantity({ item: 'salt', note: 'to taste' })).toBe('');
  });
});

describe('formatBatchMetric', () => {
  it('rolls a grams annotation up to kg', () => {
    expect(formatBatchMetric({ item: 'sauce', qty: 16, unit: 'cup', grams: 4320 })).toBe('≈4.3 kg');
  });
  it('rolls an ml annotation up to L', () => {
    expect(formatBatchMetric({ item: 'oil', qty: 2, unit: 'cup', ml: 2000 })).toBe('≈2 L');
  });
  it('returns empty string when there is no metric annotation', () => {
    expect(formatBatchMetric({ item: 'eggs', qty: 6 })).toBe('');
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm test`
Expected: FAIL — `units.ts` does not exist.

- [ ] **Step 3: Implement `src/lib/units.ts`**

```ts
import type { Ingredient } from './types';
import { formatNumber } from './scale';

// Each ladder is ascending [unit, factor-in-base-unit]. Volume is capped at `cup`
// (quart/gallon intentionally excluded — impractical for a co-op kitchen).
const LADDERS: Array<Array<[string, number]>> = [
  [['tsp', 1], ['tbsp', 3], ['cup', 48]], // volume (base: tsp)
  [['ml', 1], ['l', 1000]], // metric volume (base: mL)
  [['g', 1], ['kg', 1000]], // metric weight (base: g)
  [['oz', 1], ['lb', 16]], // imperial weight (base: oz)
];

function findLadder(unit: string): Array<[string, number]> | undefined {
  return LADDERS.find((ladder) => ladder.some(([u]) => u === unit));
}

function factorOf(ladder: Array<[string, number]>, unit: string): number {
  return ladder.find(([u]) => u === unit)![1];
}

export function rollUp(value: number, unit?: string): { value: number; unit?: string } {
  if (!unit) return { value, unit };
  const u = unit.toLowerCase();
  const ladder = findLadder(u);
  if (!ladder) return { value, unit }; // count/descriptive unit — leave as-is
  const base = value * factorOf(ladder, u);
  // Largest unit at which the converted value is >= 1 (ladder is ascending).
  let chosen = ladder[0];
  for (const entry of ladder) {
    if (base / entry[1] >= 1) chosen = entry;
  }
  return { value: base / chosen[1], unit: chosen[0] };
}

// Display spelling for canonical lowercase units.
function prettyUnit(unit: string | undefined, value: number): string | undefined {
  if (!unit) return unit;
  if (unit === 'ml') return 'mL';
  if (unit === 'l') return 'L';
  if (unit === 'cup' && value > 1) return 'cups';
  return unit;
}

function convert(value: number, fromUnit: string | undefined, toUnit: string | undefined): number {
  if (!fromUnit || !toUnit || fromUnit === toUnit) return value;
  const ladder = findLadder(fromUnit.toLowerCase());
  if (!ladder || !ladder.some(([u]) => u === toUnit)) return value;
  return (value * factorOf(ladder, fromUnit.toLowerCase())) / factorOf(ladder, toUnit);
}

export function formatBatchQuantity(ing: Ingredient): string {
  if (ing.qty === undefined) return '';
  const r = rollUp(ing.qty, ing.unit);
  const unit = r.unit;
  const loVal = r.value;
  const hiVal = ing.qtyMax === undefined ? undefined : convert(ing.qtyMax, ing.unit, unit);
  const lo = formatNumber(loVal, unit);
  const num = hiVal === undefined ? lo : `${lo}–${formatNumber(hiVal, unit)}`;
  // Pluralize based on the upper bound when it's a range.
  const display = prettyUnit(unit, hiVal ?? loVal);
  return display ? `${num} ${display}` : num;
}

export function formatBatchMetric(ing: Ingredient): string {
  const parts: string[] = [];
  if (ing.grams !== undefined) {
    const r = rollUp(ing.grams, 'g');
    parts.push(`≈${formatNumber(r.value, r.unit)} ${prettyUnit(r.unit, r.value)}`);
  }
  if (ing.ml !== undefined) {
    const r = rollUp(ing.ml, 'ml');
    parts.push(`≈${formatNumber(r.value, r.unit)} ${prettyUnit(r.unit, r.value)}`);
  }
  return parts.join(', ');
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm test`
Expected: PASS — all `units.test.ts` cases green (existing `scale`/`consolidate` suites also still pass).

- [ ] **Step 5: Commit**

```bash
git add src/lib/units.ts src/lib/units.test.ts
git commit -m "feat: add big-batch unit roll-up and formatting"
```

---

### Task 2: Dish assembly + instruction extraction (`dinner.ts`)

**Files:**
- Create: `src/lib/dinner.ts`
- Test: `src/lib/dinner.test.ts`

**Interfaces:**
- Consumes: `Ingredient`, `RecipeData` from `src/lib/types.ts`; `scaleFactor`, `scaleIngredient` from `src/lib/scale.ts`; `formatBatchQuantity`, `formatBatchMetric` from `src/lib/units.ts`.
- Produces:
  - `extractInstructions(body: string): string[]` — pulls the numbered steps out of a recipe markdown body's `## Instructions` section (text only, prefix stripped).
  - `interface DishIngredient { primary: string; metric: string; item: string; note?: string; group?: string; optional?: boolean }`
  - `interface DishView { name: string; servings: number; ingredients: DishIngredient[]; steps: string[]; notes: string[] }`
  - `buildChecklistDish(recipe: RecipeData, body: string, targetServings: number, notes?: string[]): DishView` — scales the recipe to `targetServings` and returns display-ready dish data.

- [ ] **Step 1: Write the failing tests in `src/lib/dinner.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { extractInstructions, buildChecklistDish } from './dinner';
import type { RecipeData } from './types';

const BODY = `## Instructions

1. Preheat the oven to 425°F.
2. Press and cube the tofu.
3. Bake 25 minutes, then flip.

## Notes

* Some note that should be ignored.
`;

describe('extractInstructions', () => {
  it('extracts numbered steps, stripping the prefix', () => {
    expect(extractInstructions(BODY)).toEqual([
      'Preheat the oven to 425°F.',
      'Press and cube the tofu.',
      'Bake 25 minutes, then flip.',
    ]);
  });
  it('returns an empty array when there is no Instructions section', () => {
    expect(extractInstructions('## Notes\n\n* just a note')).toEqual([]);
  });
});

describe('buildChecklistDish', () => {
  const recipe: RecipeData = {
    title: 'Buffalo Tofu',
    servings: 6,
    ingredients: [
      { item: 'tofu', qty: 454, unit: 'g' },
      { item: 'salt', note: 'to taste' },
    ],
  };

  it('scales ingredients to the target servings and formats them', () => {
    const dish = buildChecklistDish(recipe, BODY, 84, ['Use 8–10 sheet pans']);
    expect(dish.name).toBe('Buffalo Tofu');
    expect(dish.servings).toBe(84);
    // 454 g * (84/6) = 6356 g -> 6.4 kg
    expect(dish.ingredients[0].primary).toBe('6.4 kg');
    expect(dish.ingredients[0].item).toBe('tofu');
    // no-qty ingredient keeps an empty primary string
    expect(dish.ingredients[1].primary).toBe('');
    expect(dish.ingredients[1].note).toBe('to taste');
    expect(dish.steps).toHaveLength(3);
    expect(dish.notes).toEqual(['Use 8–10 sheet pans']);
  });

  it('defaults notes to an empty array', () => {
    const dish = buildChecklistDish(recipe, BODY, 6);
    expect(dish.notes).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm test`
Expected: FAIL — `dinner.ts` does not exist.

- [ ] **Step 3: Implement `src/lib/dinner.ts`**

```ts
import type { RecipeData } from './types';
import { scaleFactor, scaleIngredient } from './scale';
import { formatBatchQuantity, formatBatchMetric } from './units';

export function extractInstructions(body: string): string[] {
  const start = body.search(/^##\s+Instructions\s*$/m);
  if (start === -1) return [];
  let rest = body.slice(start).replace(/^##\s+Instructions\s*$/m, '');
  const next = rest.search(/^##\s/m);
  if (next !== -1) rest = rest.slice(0, next);
  const steps: string[] = [];
  for (const line of rest.split('\n')) {
    const m = line.match(/^\s*\d+\.\s+(.*\S)\s*$/);
    if (m) steps.push(m[1]);
  }
  return steps;
}

export interface DishIngredient {
  primary: string;
  metric: string;
  item: string;
  note?: string;
  group?: string;
  optional?: boolean;
}

export interface DishView {
  name: string;
  servings: number;
  ingredients: DishIngredient[];
  steps: string[];
  notes: string[];
}

export function buildChecklistDish(
  recipe: RecipeData,
  body: string,
  targetServings: number,
  notes: string[] = [],
): DishView {
  const factor = scaleFactor(recipe.servings, targetServings);
  const ingredients: DishIngredient[] = recipe.ingredients.map((ing) => {
    const s = scaleIngredient(ing, factor);
    return {
      primary: formatBatchQuantity(s),
      metric: formatBatchMetric(s),
      item: s.item,
      note: s.note,
      group: s.group,
      optional: s.optional,
    };
  });
  return { name: recipe.title, servings: targetServings, ingredients, steps: extractInstructions(body), notes };
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm test`
Expected: PASS — all `dinner.test.ts` cases green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dinner.ts src/lib/dinner.test.ts
git commit -m "feat: add dinner dish assembly and instruction extraction"
```

---

### Task 3: `dinners` content collection + sample dinner

**Files:**
- Modify: `src/content/config.ts`
- Create: `src/content/dinners/baked-night.md`

**Interfaces:**
- Consumes: the existing `recipes` collection (via `reference('recipes')`).
- Produces: a `dinners` collection whose `data` is `{ title: string; date?: Date; dishes: { recipe: Reference; servings: number; notes?: string[] }[] }`.

- [ ] **Step 1: Add the `dinners` collection to `src/content/config.ts`**

Change the import line and add the collection. The file becomes:

```ts
import { defineCollection, reference, z } from 'astro:content';

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

const dinners = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date().optional(),
    dishes: z
      .array(
        z.object({
          recipe: reference('recipes'),
          servings: z.number().positive(),
          notes: z.array(z.string()).optional(),
        }),
      )
      .min(1),
  }),
});

export const collections = { recipes, dinners };
```

- [ ] **Step 2: Create the sample dinner `src/content/dinners/baked-night.md`**

(References only recipes that already exist. `recipe` values are recipe slugs — the path under `src/content/recipes/` without `.md`.)

```markdown
---
title: Baked Night
date: 2026-06-20
dishes:
  - recipe: tofu/buffalo-tofu
    servings: 84
    notes:
      - 8-10 large rimmed sheet pans
      - Set up multiple breading stations, one dry hand / one wet
  - recipe: probation/honey-bbq-chicken-wings
    servings: 120
    notes:
      - Wash step first; pat dry before seasoning
  - recipe: probation/mac-n-cheese
    servings: 120
    notes:
      - 5-6 full 9x13 pans (or 3 hotel pans)
  - recipe: dinners/beans
    servings: 120
  - recipe: bread/dinner-rolls
    servings: 144
---

Start the beans first - they simmer a long time. Rolls need two 30-minute rises, so mix the dough early. Tofu and chicken go in the oven last so they're hot at service.
```

- [ ] **Step 3: Verify the collection builds and validates references**

Run: `npm run build`
Expected: build succeeds; the `dinners` collection loads. To confirm reference validation works, temporarily change one `recipe:` value to `tofu/does-not-exist` and rebuild — expect a build error naming the bad reference. Revert afterward and rebuild clean.

- [ ] **Step 4: Commit**

```bash
git add src/content/config.ts src/content/dinners/baked-night.md
git commit -m "feat: add dinners content collection and sample dinner"
```

---

### Task 4: `DinnerChecklist` React island

**Files:**
- Create: `src/components/DinnerChecklist.tsx`
- Create: `src/components/DinnerChecklist.css`

**Interfaces:**
- Consumes: the `DishView` shape from Task 2 (re-declared locally as the island's prop type — it receives plain serialized data, not the lib import, to keep the island self-contained).
- Produces: a default-exported React component `DinnerChecklist` with props `{ slug: string; dishes: DishView[] }`.

- [ ] **Step 1: Create `src/components/DinnerChecklist.css`**

```css
.dinner { display: grid; gap: 1.5rem; }
.dinner .jump { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; position: sticky; top: 0; background: var(--bg); padding: 0.5rem 0; border-bottom: 1px solid var(--border); }
.dinner .jump a { font-size: 0.95rem; text-decoration: none; padding: 0.25rem 0.6rem; border: 1px solid var(--border); border-radius: 999px; }
.dinner .jump .reset { margin-left: auto; font-size: 0.85rem; padding: 0.3rem 0.7rem; border: 1px solid var(--border); border-radius: 8px; background: #fff; cursor: pointer; }
.dish { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 1rem 1.1rem; }
.dish > h2 { margin: 0 0 0.75rem; }
.dish h2 .servings { color: #897f6d; font-weight: 400; font-size: 1rem; }
.dish h3 { margin: 1rem 0 0.4rem; }
.dish h4.group { margin: 0.75rem 0 0.25rem; font-size: 0.95rem; }
.checklist { list-style: none; padding: 0; margin: 0; }
.checklist.steps { counter-reset: step; }
.checklist li { padding: 0.4rem 0; border-bottom: 1px solid var(--border); font-size: 1.05rem; }
.checklist label { display: flex; gap: 0.6rem; align-items: baseline; cursor: pointer; }
.checklist input { width: 1.15rem; height: 1.15rem; flex: none; }
.checklist label.done { color: #b3a994; text-decoration: line-through; }
.checklist .qty { font-weight: 600; }
.checklist .metric, .checklist .note { color: #897f6d; font-weight: 400; }
.checklist li.optional .qty::after { content: ' (optional)'; color: #897f6d; font-style: italic; font-weight: 400; }
.cook-notes { margin: 0.75rem 0; padding: 0.6rem 0.8rem; background: #fff6e8; border: 1px solid #f0d9b5; border-radius: 8px; }
.cook-notes strong { display: block; margin-bottom: 0.25rem; }
.cook-notes ul { margin: 0; padding-left: 1.1rem; }
```

- [ ] **Step 2: Create `src/components/DinnerChecklist.tsx`**

```tsx
import { useEffect, useState } from 'react';
import './DinnerChecklist.css';

interface DishIngredient {
  primary: string;
  metric: string;
  item: string;
  note?: string;
  group?: string;
  optional?: boolean;
}
interface DishView {
  name: string;
  servings: number;
  ingredients: DishIngredient[];
  steps: string[];
  notes: string[];
}
interface Props {
  slug: string;
  dishes: DishView[];
}

export default function DinnerChecklist({ slug, dishes }: Props) {
  const storageKey = `dinner-checklist:${slug}`;
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // Load persisted state after mount (keeps SSR markup and first client render identical).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setChecked(JSON.parse(raw));
    } catch {
      /* ignore unreadable storage */
    }
  }, [storageKey]);

  function toggle(key: string) {
    setChecked((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function reset() {
    setChecked({});
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="dinner">
      <nav className="jump">
        {dishes.map((dish, di) => (
          <a key={di} href={`#dish-${di}`}>
            {dish.name}
          </a>
        ))}
        <button className="reset" onClick={reset}>
          Reset checklist
        </button>
      </nav>

      {dishes.map((dish, di) => {
        let lastGroup: string | undefined;
        return (
          <section key={di} id={`dish-${di}`} className="dish">
            <h2>
              {dish.name} <span className="servings">· {dish.servings} servings</span>
            </h2>

            <h3>Ingredients</h3>
            <ul className="checklist">
              {dish.ingredients.map((ing, ii) => {
                const key = `d${di}-i${ii}`;
                const showGroup = ing.group && ing.group !== lastGroup;
                if (ing.group) lastGroup = ing.group;
                return (
                  <li key={ii} className={ing.optional ? 'optional' : undefined}>
                    {showGroup && <h4 className="group">{ing.group}</h4>}
                    <label className={checked[key] ? 'done' : undefined}>
                      <input type="checkbox" checked={!!checked[key]} onChange={() => toggle(key)} />
                      <span>
                        {ing.primary && <span className="qty">{ing.primary}</span>} {ing.item}
                        {ing.metric && <span className="metric"> ({ing.metric})</span>}
                        {ing.note && <span className="note"> - {ing.note}</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>

            {dish.notes.length > 0 && (
              <div className="cook-notes">
                <strong>Head-cook notes</strong>
                <ul>
                  {dish.notes.map((n, ni) => (
                    <li key={ni}>{n}</li>
                  ))}
                </ul>
              </div>
            )}

            {dish.steps.length > 0 && (
              <>
                <h3>Instructions</h3>
                <ol className="checklist steps">
                  {dish.steps.map((step, si) => {
                    const key = `d${di}-s${si}`;
                    return (
                      <li key={si}>
                        <label className={checked[key] ? 'done' : undefined}>
                          <input type="checkbox" checked={!!checked[key]} onChange={() => toggle(key)} />
                          <span>{step}</span>
                        </label>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Verify it type-checks via a build**

This component is exercised by the page in Task 5; there is nothing to render yet. Just confirm the project still builds.
Run: `npm run build`
Expected: build succeeds (no new pages yet; the component is unused until Task 5).

- [ ] **Step 4: Commit**

```bash
git add src/components/DinnerChecklist.tsx src/components/DinnerChecklist.css
git commit -m "feat: add DinnerChecklist island with localStorage progress"
```

---

### Task 5: Dinner pages + nav link

**Files:**
- Create: `src/pages/dinners/index.astro`
- Create: `src/pages/dinners/[...slug].astro`
- Modify: `src/layouts/BaseLayout.astro` (add a "Dinners" nav link)

**Interfaces:**
- Consumes: `getCollection`/`getEntry` from `astro:content`; `buildChecklistDish` from `src/lib/dinner.ts`; the `DinnerChecklist` island; the `dinners` collection.
- Produces: `/dinners` index and `/dinners/<slug>` cook pages.

- [ ] **Step 1: Add the "Dinners" nav link in `src/layouts/BaseLayout.astro`**

Change the header nav block to:

```astro
    <header class="site">
      <div class="container">
        <a href="/">🍳 Recipes</a>
        <a href="/dinners">Dinners</a>
        <a href="/shopping-list">Shopping list</a>
      </div>
    </header>
```

- [ ] **Step 2: Create the index `src/pages/dinners/index.astro`**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';

const dinners = await getCollection('dinners');
dinners.sort((a, b) => {
  const da = a.data.date ? a.data.date.getTime() : 0;
  const db = b.data.date ? b.data.date.getTime() : 0;
  if (da !== db) return db - da; // newest first
  return a.data.title.localeCompare(b.data.title);
});
---
<BaseLayout title="Dinners">
  <h1>Dinner nights</h1>
  <div class="grid">
    {dinners.map((d) => (
      <a class="card" href={`/dinners/${d.slug}`}>
        {d.data.title}
        {d.data.date && <span> · {d.data.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
      </a>
    ))}
  </div>
</BaseLayout>
```

- [ ] **Step 3: Create the cook page `src/pages/dinners/[...slug].astro`**

```astro
---
import { getCollection, getEntry } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import DinnerChecklist from '../../components/DinnerChecklist';
import { buildChecklistDish, type DishView } from '../../lib/dinner';

export async function getStaticPaths() {
  const dinners = await getCollection('dinners');
  return dinners.map((entry) => ({ params: { slug: entry.slug }, props: { entry } }));
}

const { entry } = Astro.props;
const { Content } = await entry.render();
const d = entry.data;

const dishes: DishView[] = [];
for (const dish of d.dishes) {
  const recipe = await getEntry(dish.recipe);
  dishes.push(buildChecklistDish(recipe.data, recipe.body, dish.servings, dish.notes ?? []));
}
---
<BaseLayout title={d.title}>
  <h1>{d.title}</h1>
  {d.date && (
    <p>{d.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</p>
  )}
  <article>
    <Content />
  </article>
  <DinnerChecklist client:load slug={entry.slug} dishes={dishes} />
</BaseLayout>
```

- [ ] **Step 4: Verify the pages build and render**

Run: `npm run build`
Expected: build succeeds; page count increases (the `/dinners` index + one `/dinners/baked-night` page). Confirm in the output that `dist/dinners/baked-night/index.html` exists and contains: the dish names, scaled big-batch quantities (e.g. buffalo tofu's tofu in kg, not the home-size grams), the head-cook notes callout text ("8-10 large rimmed sheet pans"), and the `astro-island` script for `DinnerChecklist`. Then run `npm run dev`, open `/dinners` and `/dinners/baked-night`, and confirm: dishes render, checkboxes toggle and survive a refresh, "Reset checklist" clears them, quick-jump links scroll to dishes. Stop the dev server when done.

- [ ] **Step 5: Commit**

```bash
git add src/pages/dinners/index.astro "src/pages/dinners/[...slug].astro" src/layouts/BaseLayout.astro
git commit -m "feat: add dinner index and cook pages with nav link"
```

---

### Task 6: Dinner authoring docs

**Files:**
- Modify: `README.md` (add a "Dinner nights" section with the format + an LLM prompt)

**Interfaces:**
- Produces: authoring documentation. No code consumes this.

- [ ] **Step 1: Append a "Dinner nights" section to `README.md`**

Add the following at the end of `README.md`:

````markdown
## Dinner nights (head-cook pages)

A **dinner** assembles existing recipes into one cook-along page, each dish scaled to a co-op
serving count and shown in big-batch units, with your shift notes and progress checkboxes.
Dinners live in `src/content/dinners/<slug>.md` and reference recipes by their slug (the path
under `src/content/recipes/` without `.md`).

```markdown
---
title: Baked Night
date: 2026-06-20            # optional
dishes:
  - recipe: tofu/buffalo-tofu      # must be an existing recipe slug
    servings: 84
    notes:
      - 8-10 large rimmed sheet pans
  - recipe: probation/mac-n-cheese
    servings: 120
---

Overall shift notes go here (start order, timing, reminders).
```

- Each dish needs a `recipe` (existing recipe slug), a `servings` target, and optional `notes`.
- The build fails if a `recipe` slug doesn't exist, so typos are caught before deploy.
- Quantities scale automatically from the recipe's base servings - no hand math.
- View at `/dinners/<slug>`; reuse next week by copying the file and adjusting servings/notes.
- If a dish isn't a recipe yet, add it to `src/content/recipes/` first (see the recipe format above), then reference it.

### Adding a dinner with an LLM

Paste the prompt below into an LLM along with your menu (dish names + how many servings each).

---

Create an Astro dinner file for my recipe site. Output only the file contents.

- Frontmatter: `title`, optional `date` (YYYY-MM-DD), and `dishes`.
- Each dish: `recipe` (a recipe slug like `tofu/buffalo-tofu` - ask me if unsure which slug), `servings` (a number), and optional `notes` (a YAML list of short head-cook reminders: pan counts, batching, timing).
- After the frontmatter, write the overall shift notes as a short markdown paragraph.
- Do not invent recipe slugs; use only ones I provide.

Here is the menu:

[PASTE MENU HERE]
````

- [ ] **Step 2: Final build + tests**

Run: `npm run build && npm test`
Expected: build succeeds (all recipes + dinners validate), all unit tests pass.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document dinner-night authoring and LLM prompt"
```

---

## Verification checklist (after all tasks)

- [ ] `npm test` passes (`units.test.ts`, `dinner.test.ts`, plus existing suites).
- [ ] `npm run build` succeeds with the `dinners` collection validated (a bad recipe reference fails the build).
- [ ] `/dinners` lists the sample dinner; `/dinners/baked-night` shows each dish with big-batch quantities, head-cook notes callouts, and instruction steps.
- [ ] Checkboxes toggle, persist across refresh (localStorage), and "Reset checklist" clears them.
- [ ] Big-batch display matches expectations: weights roll g→kg, volumes roll up to cups (not quarts/gallons), counts/lemons stay as-is, ranges stay ranges.
- [ ] No em dashes introduced in new UI copy.
- [ ] "Dinners" link appears in the site nav.
```

