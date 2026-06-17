# Dinner Nutrition Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate, shareable per-dinner nutrition page (`/dinners/<slug>/nutrition`) showing each dish's per-serving macros, with a discreet opt-in link from the calorie-free cook page.

**Architecture:** Two Astro page changes only. Rename the cook page from a rest-param route (`[...slug].astro`) to a single-segment route (`[slug].astro`) so a nested `[slug]/nutrition.astro` route slots in without collision. The nutrition page resolves each dish's recipe via `getEntry` and renders the per-serving `nutrition` already stored on the recipe. No new logic, no library, no island, no unit tests (presentational Astro, verified by build + output assertions).

**Tech Stack:** Astro 4 (static), existing `BaseLayout`, `global.css`, Astro scoped `<style>`.

## Global Constraints

- **Per-dish only**, full macros per serving (calories + protein + carbs + fat); no combined total, no scaling (nutrition is per serving and constant).
- **Cook page stays calorie-free** — only a discreet opt-in link to the nutrition page, never the numbers inline.
- **No em dashes** in UI copy — use middot `·` for separators and `→`/`←` arrows for links.
- Show only macros that are present; if a recipe has no `nutrition` block, show a short "No nutrition data" note for that dish.
- CSS/markup only — no schema, scaling, units, or checklist-island changes.
- Do NOT touch `vitest.config.ts`, `.gitignore`, or unrelated files. The untracked `refrences/` folder is pre-existing — leave it.

---

### Task 1: Nutrition page + cook-page route rename and link

**Files:**
- Rename: `src/pages/dinners/[...slug].astro` → `src/pages/dinners/[slug].astro` (then add a link)
- Create: `src/pages/dinners/[slug]/nutrition.astro`

**Interfaces:**
- Consumes: the `dinners` collection; each dish's `recipe` reference resolved with `getEntry`, whose `.data.nutrition` is `{ calories?, protein?, carbs?, fat? }` (all optional numbers) and `.data.title`. `BaseLayout` takes a `title` prop.
- Produces: the `/dinners/<slug>` cook page (renamed route, unchanged behavior + one new link) and the `/dinners/<slug>/nutrition` page. Final task.

- [ ] **Step 1: Rename the cook-page route file**

Run (Git Bash; brackets quoted):
```bash
git mv "src/pages/dinners/[...slug].astro" "src/pages/dinners/[slug].astro"
```
Expected: the file is renamed; `git status` shows a rename. No content change yet. (Dinner slugs are flat single segments, so `[slug]` matches exactly what `[...slug]` matched; `getStaticPaths` already returns `params: { slug: entry.slug }`.)

- [ ] **Step 2: Add the discreet nutrition link to the cook page**

In `src/pages/dinners/[slug].astro`, insert a nutrition link between the date block and the `<article>`. The body becomes exactly:

```astro
<BaseLayout title={d.title}>
  <h1>{d.title}</h1>
  {d.date && (
    <p>{d.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</p>
  )}
  <p class="nutrition-link"><a href={`/dinners/${entry.slug}/nutrition`}>Nutrition info →</a></p>
  <article>
    <Content />
  </article>
  <DinnerChecklist client:load slug={entry.slug} dishes={dishes} />
</BaseLayout>
```

Leave the frontmatter (imports, `getStaticPaths`, dish building) unchanged. Do NOT add any nutrition numbers here.

- [ ] **Step 3: Create the nutrition page `src/pages/dinners/[slug]/nutrition.astro`**

```astro
---
import { getCollection, getEntry } from 'astro:content';
import BaseLayout from '../../../layouts/BaseLayout.astro';

export async function getStaticPaths() {
  const dinners = await getCollection('dinners');
  return dinners.map((entry) => ({ params: { slug: entry.slug }, props: { entry } }));
}

const { entry } = Astro.props;
const d = entry.data;

const dishes = [];
for (const dish of d.dishes) {
  const recipe = await getEntry(dish.recipe);
  dishes.push({ name: recipe.data.title, servings: dish.servings, nutrition: recipe.data.nutrition });
}
---
<BaseLayout title={`${d.title} - Nutrition`}>
  <h1>{d.title} - Nutrition</h1>
  <p>Estimated values, per serving.</p>

  {dishes.map((dish) => (
    <section class="dish">
      <h2>{dish.name} <span class="servings">· {dish.servings} servings</span></h2>
      {dish.nutrition ? (
        <p class="macros">
          Per serving:
          {dish.nutrition.calories && <span> {dish.nutrition.calories} cal</span>}
          {dish.nutrition.protein && <span> · {dish.nutrition.protein} g protein</span>}
          {dish.nutrition.carbs && <span> · {dish.nutrition.carbs} g carbs</span>}
          {dish.nutrition.fat && <span> · {dish.nutrition.fat} g fat</span>}
        </p>
      ) : (
        <p class="macros">No nutrition data.</p>
      )}
    </section>
  ))}

  <p><a href={`/dinners/${entry.slug}`}>← Back to {d.title}</a></p>
</BaseLayout>

<style>
  .dish { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 1rem 1.1rem; margin-bottom: 1rem; }
  .dish h2 { margin: 0 0 0.4rem; }
  .dish .servings { color: #897f6d; font-weight: 400; font-size: 1rem; }
  .macros { margin: 0; }
</style>
```

- [ ] **Step 4: Build and assert**

Run: `npm run build`
Expected: build succeeds. Page count increases by one per dinner (the `/nutrition` page); the cook page still builds at `/dinners/<slug>`.

Then assert the output (Git Bash):
```bash
grep -o "Nutrition info" dist/dinners/baked-night/index.html | head -1
grep -oE "[0-9]+ cal" dist/dinners/baked-night/nutrition/index.html | head -1
grep -cE "[0-9]+ cal" dist/dinners/baked-night/index.html
```
Expected: the cook page contains "Nutrition info" (the link); the nutrition page contains a "<number> cal" value (per-serving calories rendered); and the last grep prints `0` — the cook page has NO rendered calorie value inline (the `[0-9]+ cal` pattern matches the actual nutrition format, avoiding false positives from unrelated words). (If non-zero, find and remove nutrition leakage on the cook page.)

- [ ] **Step 5: Confirm existing tests still pass and scope is clean**

Run: `npm test`
Expected: 54 tests pass (this change touches no logic).

Run: `git status --short`
Expected: a rename of the cook-page file plus the new `[slug]/nutrition.astro`; nothing else changed (untracked `refrences/` is fine).

- [ ] **Step 6: Commit**

```bash
git add "src/pages/dinners/[slug].astro" "src/pages/dinners/[slug]/nutrition.astro"
git commit -m "feat: add per-dinner nutrition page with discreet cook-page link"
```

---

## Verification checklist (after the task)

- [ ] `npm run build` succeeds; `/dinners/<slug>` and `/dinners/<slug>/nutrition` both build.
- [ ] Cook page (`dist/dinners/baked-night/index.html`) contains the "Nutrition info" link and zero inline calorie text.
- [ ] Nutrition page (`dist/dinners/baked-night/nutrition/index.html`) lists each dish with per-serving macros (a calorie number present), and a back link.
- [ ] `npm test` still green (54).
- [ ] Manual check: cook page shows the opt-in link and no calories; nutrition page reads cleanly on mobile and the back link returns to the dinner.
