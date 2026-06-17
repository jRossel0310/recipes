# Calories Per 100 g Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional per-serving weight (`servingGrams`) to recipe nutrition and show a calories-per-100g line on the dinner nutrition page when it can be derived.

**Architecture:** One optional schema field (`nutrition.servingGrams`), an inline computed line on the nutrition page (`calories ÷ servingGrams × 100`), estimated serving weights backfilled onto the five sample-dinner recipes, and an authoring-prompt note. No new logic module, no tests (trivial inline calc, consistent with how nutrition already renders); verified by build + output assertions.

**Tech Stack:** Astro 4 (static), Zod via `astro:content`, existing nutrition page + scoped styles.

## Global Constraints

- **Per-100g is calories-only** and shown ONLY when both `calories` and `servingGrams` are present; otherwise the line is omitted for that dish (per-serving line still shows).
- `servingGrams` is `z.number().positive().optional()` — optional, so all existing recipes stay valid.
- The five backfilled serving weights are **estimates to verify**, marked with a YAML comment; no em dashes in any copy (use hyphen `-`).
- Only these files change: `src/content/config.ts`, `src/pages/dinners/[slug]/nutrition.astro`, the five recipe files, `README.md`. No scaling/units/island/cook-page changes.
- Do NOT touch `vitest.config.ts`, `.gitignore`, or unrelated files. Untracked `refrences/` is pre-existing - leave it.

---

### Task 1: servingGrams field, per-100g display, backfill, and authoring note

**Files:**
- Modify: `src/content/config.ts`
- Modify: `src/pages/dinners/[slug]/nutrition.astro`
- Modify: `src/content/recipes/tofu/buffalo-tofu.md`, `src/content/recipes/probation/honey-bbq-chicken-wings.md`, `src/content/recipes/probation/mac-n-cheese.md`, `src/content/recipes/dinners/beans.md`, `src/content/recipes/bread/dinner-rolls.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: the recipe `nutrition` object (now including optional `servingGrams: number`).
- Produces: a per-100g calorie line on the nutrition page. Final task.

- [ ] **Step 1: Add `servingGrams` to the schema**

In `src/content/config.ts`, the recipe `nutrition` object currently is:

```ts
    nutrition: z
      .object({
        calories: z.number().optional(),
        protein: z.number().optional(),
        carbs: z.number().optional(),
        fat: z.number().optional(),
      })
      .optional(),
```

Add a `servingGrams` line so it becomes:

```ts
    nutrition: z
      .object({
        calories: z.number().optional(),
        protein: z.number().optional(),
        carbs: z.number().optional(),
        fat: z.number().optional(),
        servingGrams: z.number().positive().optional(),
      })
      .optional(),
```

- [ ] **Step 2: Add the per-100g line to the nutrition page**

In `src/pages/dinners/[slug]/nutrition.astro`, insert a per-100g block immediately after the per-serving ternary closes (after the `)}` on the line with `</p>...)}` and before `</section>`). The dish `<section>` becomes:

```astro
    <section class="dish">
      <h2>{dish.name} <span class="servings">· {dish.servings} servings</span></h2>
      {dish.nutrition ? (
        <p class="macros">
          Per serving:
          {dish.nutrition.calories != null && <span> {dish.nutrition.calories} cal</span>}
          {dish.nutrition.protein != null && <span> · {dish.nutrition.protein} g protein</span>}
          {dish.nutrition.carbs != null && <span> · {dish.nutrition.carbs} g carbs</span>}
          {dish.nutrition.fat != null && <span> · {dish.nutrition.fat} g fat</span>}
        </p>
      ) : (
        <p class="macros">No nutrition data.</p>
      )}
      {dish.nutrition && dish.nutrition.calories != null && dish.nutrition.servingGrams && (
        <p class="macros per100">Per 100 g: ~{Math.round((dish.nutrition.calories / dish.nutrition.servingGrams) * 100)} cal</p>
      )}
    </section>
```

Then add a small style for the per-100g line. In the `<style>` block, change:

```css
  .macros { margin: 0; }
```

to:

```css
  .macros { margin: 0; }
  .per100 { margin: 0.2rem 0 0; color: #897f6d; }
```

- [ ] **Step 3: Backfill estimated serving weights on the five sample-dinner recipes**

In each recipe file's frontmatter `nutrition:` block, add a `servingGrams:` line (estimate, to be verified) using these values. The comment marks them as estimates:

- `src/content/recipes/tofu/buffalo-tofu.md` → add under `nutrition:`:
  ```yaml
  servingGrams: 150  # estimate, verify/adjust
  ```
- `src/content/recipes/probation/honey-bbq-chicken-wings.md` →
  ```yaml
  servingGrams: 100  # estimate, verify/adjust
  ```
- `src/content/recipes/probation/mac-n-cheese.md` →
  ```yaml
  servingGrams: 280  # estimate, verify/adjust
  ```
- `src/content/recipes/dinners/beans.md` →
  ```yaml
  servingGrams: 150  # estimate, verify/adjust
  ```
- `src/content/recipes/bread/dinner-rolls.md` →
  ```yaml
  servingGrams: 30  # estimate, verify/adjust
  ```

Add the line inside the existing `nutrition:` mapping (same indentation as `calories:`), not at the top level. Do not change any other recipe field.

- [ ] **Step 4: Update the README authoring docs**

In `README.md`, update the recipe-format table row (currently):

```
| `nutrition` | no | Per serving: `calories`, `protein`, `carbs`, `fat` |
```

to:

```
| `nutrition` | no | Per serving: `calories`, `protein`, `carbs`, `fat`; optional `servingGrams` (one serving's weight in g, enables a per-100g calorie display) |
```

And update the LLM recipe-prompt nutrition line (currently):

```
- `nutrition` (per serving): `calories`, `protein`, `carbs`, `fat` - estimate if not given.
```

to:

```
- `nutrition` (per serving): `calories`, `protein`, `carbs`, `fat` - estimate if not given. Optionally `servingGrams` (estimated weight of one serving, in grams) to enable a calories-per-100g display.
```

- [ ] **Step 5: Build, validate the schema, and assert the per-100g line renders**

Run: `npm run build`
Expected: build succeeds.

Confirm the schema enforces the field: temporarily change one recipe's `servingGrams` to a non-number (e.g. `servingGrams: "heavy"`), run `npm run build`, and confirm it FAILS with a Zod error naming `servingGrams`. Then revert to the numeric value and rebuild clean.

Assert the per-100g line is rendered (Git Bash):
```bash
grep -oE "Per 100 g: ~[0-9]+ cal" dist/dinners/baked-night/nutrition/index.html
```
Expected: at least one match (e.g. `Per 100 g: ~219 cal` for buffalo tofu, `~232` for mac & cheese). The per-serving lines are still present (unchanged).

- [ ] **Step 6: Confirm tests and scope, then commit**

Run: `npm test`
Expected: 54 tests pass (no logic touched).

Run: `git status --short`
Expected: only the eight intended files modified (config, nutrition page, five recipes, README); untracked `refrences/` is fine.

Commit:
```bash
git add src/content/config.ts "src/pages/dinners/[slug]/nutrition.astro" src/content/recipes/tofu/buffalo-tofu.md src/content/recipes/probation/honey-bbq-chicken-wings.md src/content/recipes/probation/mac-n-cheese.md src/content/recipes/dinners/beans.md src/content/recipes/bread/dinner-rolls.md README.md
git commit -m "feat: add servingGrams and calories-per-100g on dinner nutrition page"
```

---

## Verification checklist (after the task)

- [ ] `npm run build` succeeds; a non-numeric `servingGrams` fails schema validation (then reverted).
- [ ] `dist/dinners/baked-night/nutrition/index.html` shows a "Per 100 g: ~N cal" line for the backfilled dishes, with per-serving lines still present.
- [ ] A recipe without `servingGrams` would show no per-100g line (conditional holds).
- [ ] `npm test` green (54).
- [ ] README documents `servingGrams` in both the format table and the LLM prompt.
- [ ] Manual check: per-100g reads cleanly under each dish on mobile.
