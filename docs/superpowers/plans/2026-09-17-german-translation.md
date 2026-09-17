# German Translation Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a footer toggle that switches the recipe, dinner and cloyne pages to German, backed by pre-translated files generated at build time.

**Architecture:** German content lives in parallel Astro content collections (`recipes-de`, `dinners-de`) mirroring the English paths. A `scripts/translate.mjs` script calls Claude to translate only whitelisted text fields and records a fingerprint of the English text it translated. German routes under `src/pages/de/**` render the German entry when it is fresh, and fall back to English with a banner when it is missing or stale.

**Tech Stack:** Astro 4.16 (static), React 18 islands, vitest 4, `@anthropic-ai/sdk`, `zod`, `gray-matter`.

**Spec:** `docs/superpowers/specs/2026-09-17-german-translation-design.md`

## Global Constraints

- **Never translate numbers or units.** `qty`, `qtyMax`, `unit`, `grams`, `ml`, `servings`, `nutrition`, `source`, `optional` and `tags` are copied byte-for-byte from the English file. Only `title`, `summary`, ingredient `item` / `note` / `group`, dish `notes` and the markdown body are ever sent to the model.
- **Model:** `claude-opus-5`. Do not substitute a cheaper model.
- **Banner copy, exact string:** `Maschinell übersetzt — Mengen auf Englisch prüfen`
- **Locales:** `en` (default, unprefixed URLs) and `de` (prefixed `/de/...`). English URLs must not change.
- **Test location:** vitest only collects `src/**/*.test.ts` (see `vitest.config.ts`). All tests go under `src/`.
- **ESM:** the repo is `"type": "module"`. `__dirname` is undefined in source files — derive paths from `import.meta.url`.
- **Fingerprint scope (refines the spec):** the stored hash covers only the translatable text, not the whole English file. Editing `servings` or `nutrition` must not invalidate a good translation.
- **Existing English behaviour must not change.** `npm run build` keeps producing every current route, and all 81 existing tests keep passing.

---

### Task 1: UI string table and locale-aware layout

**Files:**
- Create: `src/lib/ui-strings.ts`
- Create: `src/lib/ui-strings.test.ts`
- Modify: `src/layouts/BaseLayout.astro`

**Interfaces:**
- Consumes: nothing
- Produces: `type Locale = 'en' | 'de'`, `t(locale: Locale, key: UiKey): string`, `UI_STRINGS: Record<Locale, Record<UiKey, string>>`, and `BaseLayout` accepting an optional `lang?: Locale` prop defaulting to `'en'`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/ui-strings.test.ts
import { describe, it, expect } from 'vitest';
import { UI_STRINGS, t } from './ui-strings';

describe('ui-strings', () => {
  it('defines every key in both locales', () => {
    const en = Object.keys(UI_STRINGS.en).sort();
    const de = Object.keys(UI_STRINGS.de).sort();
    expect(de).toEqual(en);
  });

  it('returns the string for a locale', () => {
    expect(t('en', 'ingredients')).toBe('Ingredients');
    expect(t('de', 'ingredients')).toBe('Zutaten');
  });

  it('carries the exact machine-translation banner', () => {
    expect(t('de', 'bannerUnreviewed')).toBe('Maschinell übersetzt — Mengen auf Englisch prüfen');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ui-strings.test.ts`
Expected: FAIL with `Failed to resolve import "./ui-strings"`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/ui-strings.ts
export type Locale = 'en' | 'de';

export const UI_STRINGS = {
  en: {
    dinners: 'Dinners',
    recipes: 'Recipes',
    shopping: 'Shopping',
    cloyne: 'Cloyne',
    ingredients: 'Ingredients',
    instructions: 'Instructions',
    notes: 'Notes',
    servings: 'Servings',
    footer: 'Built for the nightly dinner routine.',
    backToCloyne: 'All Cloyne menus',
    backToDinners: 'All dinners',
    switchLanguage: 'Deutsch',
    bannerUnreviewed: 'Machine translated - check quantities against English',
    bannerStale: 'The German version is out of date; showing English.',
    bannerMissing: 'Not translated yet; showing English.',
  },
  de: {
    dinners: 'Abendessen',
    recipes: 'Rezepte',
    shopping: 'Einkauf',
    cloyne: 'Cloyne',
    ingredients: 'Zutaten',
    instructions: 'Zubereitung',
    notes: 'Hinweise',
    servings: 'Portionen',
    footer: 'Für die tägliche Abendessen-Routine gebaut.',
    backToCloyne: 'Alle Cloyne-Menüs',
    backToDinners: 'Alle Abendessen',
    switchLanguage: 'English',
    bannerUnreviewed: 'Maschinell übersetzt — Mengen auf Englisch prüfen',
    bannerStale: 'Die deutsche Fassung ist veraltet; es wird Englisch angezeigt.',
    bannerMissing: 'Noch nicht übersetzt; es wird Englisch angezeigt.',
  },
} as const;

export type UiKey = keyof typeof UI_STRINGS.en;

export function t(locale: Locale, key: UiKey): string {
  return UI_STRINGS[locale][key];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ui-strings.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Make BaseLayout locale-aware**

Replace the frontmatter and opening `<html>` tag of `src/layouts/BaseLayout.astro`:

```astro
---
import '../styles/global.css';
import { t, type Locale } from '../lib/ui-strings';
interface Props { title: string; lang?: Locale }
const { title, lang = 'en' } = Astro.props;
const prefix = lang === 'de' ? '/de' : '';
---
<!doctype html>
<html lang={lang}>
```

Replace the nav block:

```astro
        <nav aria-label="Primary navigation">
          <a href={`${prefix}/#dinners`}>{t(lang, 'dinners')}</a>
          <a href={`${prefix}/#recipes`}>{t(lang, 'recipes')}</a>
          <a href="/shopping-list">{t(lang, 'shopping')}</a>
          <a href={`${prefix}/cloyne`}>{t(lang, 'cloyne')}</a>
        </nav>
```

Replace the footer line:

```astro
    <footer class="container">{t(lang, 'footer')}</footer>
```

- [ ] **Step 6: Verify the English site is unchanged**

Run: `npm run build && npm test`
Expected: 93 pages built, 84 tests pass (81 existing + 3 new)

- [ ] **Step 7: Commit**

```bash
git add src/lib/ui-strings.ts src/lib/ui-strings.test.ts src/layouts/BaseLayout.astro
git commit -m "Add locale-aware UI strings and BaseLayout lang prop"
```

---

### Task 2: Translation fingerprint and fallback resolution

**Files:**
- Create: `src/lib/translation.ts`
- Create: `src/lib/translation.test.ts`

**Interfaces:**
- Consumes: `Ingredient` from `src/lib/types.ts`
- Produces:
  - `interface TranslatableSource { title: string; summary?: string; ingredients?: Ingredient[]; notes?: string[]; body: string }`
  - `type BannerKind = null | 'unreviewed' | 'stale' | 'missing'`
  - `translatableFields(input: TranslatableSource): Array<{ key: string; text: string }>`
  - `fingerprint(input: TranslatableSource): string` (sha256 hex)
  - `resolveTranslation(args: { english: TranslatableSource; german?: { sourceHash: string; reviewed: boolean } }): { useGerman: boolean; banner: BannerKind }`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/translation.test.ts
import { describe, it, expect } from 'vitest';
import { translatableFields, fingerprint, resolveTranslation } from './translation';

const english = {
  title: 'Chili-Lime Corn',
  body: '## Instructions\n\n1. Heat a large skillet.\n',
  ingredients: [
    { item: 'frozen corn kernels', qty: 1.5, unit: 'lb', grams: 680 },
    { item: 'butter', qty: 2, unit: 'tbsp', note: 'or vegan butter', group: 'Topping' },
  ],
};

describe('translatableFields', () => {
  it('extracts only text, never numbers or units', () => {
    const keys = translatableFields(english).map((f) => f.key);
    expect(keys).toContain('title');
    expect(keys).toContain('ingredients.0.item');
    expect(keys).toContain('ingredients.1.note');
    expect(keys).toContain('ingredients.1.group');
    expect(keys).toContain('body');
    expect(keys.some((k) => k.includes('qty'))).toBe(false);
    expect(keys.some((k) => k.includes('unit'))).toBe(false);
    expect(keys.some((k) => k.includes('grams'))).toBe(false);
  });
});

describe('fingerprint', () => {
  it('is stable for identical text', () => {
    expect(fingerprint(english)).toBe(fingerprint({ ...english }));
  });

  it('ignores changes to numeric fields', () => {
    const rescaled = {
      ...english,
      ingredients: [
        { item: 'frozen corn kernels', qty: 18, unit: 'lb', grams: 8165 },
        { item: 'butter', qty: 24, unit: 'tbsp', note: 'or vegan butter', group: 'Topping' },
      ],
    };
    expect(fingerprint(rescaled)).toBe(fingerprint(english));
  });

  it('changes when translatable text changes', () => {
    const edited = { ...english, title: 'Chili-Lime Corn with Cilantro' };
    expect(fingerprint(edited)).not.toBe(fingerprint(english));
  });
});

describe('resolveTranslation', () => {
  it('uses German with no banner when fresh and reviewed', () => {
    const german = { sourceHash: fingerprint(english), reviewed: true };
    expect(resolveTranslation({ english, german })).toEqual({ useGerman: true, banner: null });
  });

  it('uses German with a banner when fresh but unreviewed', () => {
    const german = { sourceHash: fingerprint(english), reviewed: false };
    expect(resolveTranslation({ english, german })).toEqual({ useGerman: true, banner: 'unreviewed' });
  });

  it('falls back to English when the hash no longer matches', () => {
    const german = { sourceHash: 'stale-hash', reviewed: true };
    expect(resolveTranslation({ english, german })).toEqual({ useGerman: false, banner: 'stale' });
  });

  it('falls back to English when there is no German file', () => {
    expect(resolveTranslation({ english })).toEqual({ useGerman: false, banner: 'missing' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/translation.test.ts`
Expected: FAIL with `Failed to resolve import "./translation"`

- [ ] **Step 3: Write minimal implementation**

The two separator characters below are deliberate: they cannot appear in recipe text, so they make the canonical string unambiguous.

```typescript
// src/lib/translation.ts
import { createHash } from 'node:crypto';
import type { Ingredient } from './types';

export type BannerKind = null | 'unreviewed' | 'stale' | 'missing';

export interface TranslatableSource {
  title: string;
  summary?: string;
  ingredients?: Ingredient[];
  notes?: string[];
  body: string;
}

export interface TranslatableField {
  key: string;
  text: string;
}

const FIELD_SEP = String.fromCharCode(0);
const RECORD_SEP = String.fromCharCode(1);

export function translatableFields(input: TranslatableSource): TranslatableField[] {
  const fields: TranslatableField[] = [{ key: 'title', text: input.title }];
  if (input.summary) fields.push({ key: 'summary', text: input.summary });
  (input.notes ?? []).forEach((note, i) => fields.push({ key: `notes.${i}`, text: note }));
  (input.ingredients ?? []).forEach((ing, i) => {
    fields.push({ key: `ingredients.${i}.item`, text: ing.item });
    if (ing.note) fields.push({ key: `ingredients.${i}.note`, text: ing.note });
    if (ing.group) fields.push({ key: `ingredients.${i}.group`, text: ing.group });
  });
  fields.push({ key: 'body', text: input.body });
  return fields;
}

export function fingerprint(input: TranslatableSource): string {
  const canonical = translatableFields(input)
    .map((f) => f.key + FIELD_SEP + f.text)
    .join(RECORD_SEP);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function resolveTranslation(args: {
  english: TranslatableSource;
  german?: { sourceHash: string; reviewed: boolean };
}): { useGerman: boolean; banner: BannerKind } {
  const { english, german } = args;
  if (!german) return { useGerman: false, banner: 'missing' };
  if (german.sourceHash !== fingerprint(english)) return { useGerman: false, banner: 'stale' };
  return { useGerman: true, banner: german.reviewed ? null : 'unreviewed' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/translation.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/translation.ts src/lib/translation.test.ts
git commit -m "Add translation fingerprint and fallback resolution"
```

---

### Task 3: Locale path mapping

**Files:**
- Create: `src/lib/locale-paths.ts`
- Create: `src/lib/locale-paths.test.ts`

**Interfaces:**
- Consumes: `Locale` from `src/lib/ui-strings.ts`
- Produces:
  - `localeOf(pathname: string): Locale`
  - `hasGermanRoute(pathname: string): boolean`
  - `counterpartPath(pathname: string): string | null` — `null` when the page has no German twin

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/locale-paths.test.ts
import { describe, it, expect } from 'vitest';
import { hasGermanRoute, localeOf, counterpartPath } from './locale-paths';

describe('localeOf', () => {
  it('detects the locale from the path', () => {
    expect(localeOf('/cloyne/bbq-night')).toBe('en');
    expect(localeOf('/de/cloyne/bbq-night')).toBe('de');
    expect(localeOf('/de')).toBe('de');
  });
});

describe('hasGermanRoute', () => {
  it('is true for translated sections', () => {
    expect(hasGermanRoute('/recipes/sides/chili-lime-corn')).toBe(true);
    expect(hasGermanRoute('/cloyne')).toBe(true);
    expect(hasGermanRoute('/cloyne/bbq-night')).toBe(true);
    expect(hasGermanRoute('/dinners/baked-night')).toBe(true);
  });

  it('is false for untranslated sections', () => {
    expect(hasGermanRoute('/')).toBe(false);
    expect(hasGermanRoute('/shopping-list')).toBe(false);
    expect(hasGermanRoute('/cloyne/bbq-night/nutrition')).toBe(false);
  });
});

describe('counterpartPath', () => {
  it('maps English to German', () => {
    expect(counterpartPath('/cloyne/bbq-night')).toBe('/de/cloyne/bbq-night');
    expect(counterpartPath('/recipes/sides/chili-lime-corn')).toBe('/de/recipes/sides/chili-lime-corn');
  });

  it('maps German back to English', () => {
    expect(counterpartPath('/de/cloyne/bbq-night')).toBe('/cloyne/bbq-night');
  });

  it('round-trips', () => {
    const en = '/dinners/baked-night';
    expect(counterpartPath(counterpartPath(en)!)).toBe(en);
  });

  it('tolerates a trailing slash', () => {
    expect(counterpartPath('/cloyne/bbq-night/')).toBe('/de/cloyne/bbq-night');
  });

  it('returns null where there is no German twin', () => {
    expect(counterpartPath('/shopping-list')).toBeNull();
    expect(counterpartPath('/')).toBeNull();
    expect(counterpartPath('/cloyne/bbq-night/nutrition')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/locale-paths.test.ts`
Expected: FAIL with `Failed to resolve import "./locale-paths"`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/locale-paths.ts
import type { Locale } from './ui-strings';

const TRANSLATED_SECTIONS = ['recipes', 'cloyne', 'dinners'];

function normalize(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

export function localeOf(pathname: string): Locale {
  const p = normalize(pathname);
  return p === '/de' || p.startsWith('/de/') ? 'de' : 'en';
}

function englishPath(pathname: string): string {
  const p = normalize(pathname);
  if (p === '/de') return '/';
  return p.startsWith('/de/') ? p.slice(3) : p;
}

export function hasGermanRoute(pathname: string): boolean {
  const segments = englishPath(pathname).split('/').filter(Boolean);
  if (segments.length === 0) return false;
  if (!TRANSLATED_SECTIONS.includes(segments[0])) return false;
  if (segments[segments.length - 1] === 'nutrition') return false;
  return true;
}

export function counterpartPath(pathname: string): string | null {
  if (!hasGermanRoute(pathname)) return null;
  const p = normalize(pathname);
  return localeOf(p) === 'de' ? englishPath(p) : `/de${p}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/locale-paths.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/locale-paths.ts src/lib/locale-paths.test.ts
git commit -m "Add locale path mapping"
```

---

### Task 4: German content collections

**Files:**
- Modify: `src/content/config.ts`
- Create: `src/content/recipes-de/sides/chili-lime-corn.md` (hand-written seed)
- Create: `src/content/dinners-de/.gitkeep`

**Interfaces:**
- Consumes: nothing
- Produces: collections `recipes-de` and `dinners-de`, both carrying `sourceHash: string` and `reviewed: boolean` (default `false`)

- [ ] **Step 1: Install the frontmatter parser**

```bash
npm install --save-dev gray-matter
```

- [ ] **Step 2: Add the collections**

In `src/content/config.ts`, after the existing `dinners` definition, add:

```typescript
const recipesDe = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    summary: z.string().optional(),
    ingredients: z.array(ingredient).min(1),
    sourceHash: z.string(),
    reviewed: z.boolean().default(false),
  }),
});

const dinnersDe = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    summary: z.string().optional(),
    notes: z.array(z.string()).optional(),
    sourceHash: z.string(),
    reviewed: z.boolean().default(false),
  }),
});
```

and replace the export:

```typescript
export const collections = {
  recipes,
  dinners,
  'recipes-de': recipesDe,
  'dinners-de': dinnersDe,
};
```

The German schemas deliberately omit `servings`, `nutrition`, `tags` and `dishes`. Those are always read from the English entry, so they cannot drift.

- [ ] **Step 3: Compute the seed fingerprint**

```bash
node --input-type=module -e "
import matter from 'gray-matter';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const F = String.fromCharCode(0), R = String.fromCharCode(1);
const f = matter(fs.readFileSync('src/content/recipes/sides/chili-lime-corn.md','utf8'));
const out = [['title', f.data.title]];
f.data.ingredients.forEach((ing, i) => {
  out.push(['ingredients.' + i + '.item', ing.item]);
  if (ing.note) out.push(['ingredients.' + i + '.note', ing.note]);
  if (ing.group) out.push(['ingredients.' + i + '.group', ing.group]);
});
out.push(['body', f.content]);
console.log(createHash('sha256').update(out.map(p => p[0] + F + p[1]).join(R), 'utf8').digest('hex'));
"
```

Copy the printed hash into the next step.

- [ ] **Step 4: Write the seed German recipe**

`src/content/recipes-de/sides/chili-lime-corn.md`:

```markdown
---
title: Chili-Limetten-Mais
sourceHash: PASTE_HASH_FROM_STEP_3
reviewed: false
ingredients:
  - item: gefrorene Maiskoerner
  - item: Butter
    note: oder vegane Butter
  - item: neutrales Oel
  - item: Limette
    note: abgerieben und ausgepresst
  - item: Chilipulver
  - item: geraeuchertes Paprikapulver
  - item: Knoblauchpulver
  - item: Salz
  - item: schwarzer Pfeffer
    note: nach Geschmack
  - item: gehackter Koriander
---

## Zubereitung

1. Eine grosse Pfanne sehr heiss werden lassen. Das neutrale Oel und den Mais hineingeben.
2. Den Mais stellenweise ruhig liegen lassen, damit er braeunt, statt ihn staendig zu ruehren. Garen, bis er durchgehend heiss und leicht angeroestet ist.
3. Die Hitze reduzieren und Butter, Chilipulver, geraeuchertes Paprikapulver, Knoblauchpulver, Salz, Pfeffer und den Limettenabrieb unterruehren.
4. Kurz vor dem Servieren den Limettensaft und den Koriander zugeben.

## Hinweise

* Fuer Koop-Mengen den Mais auf Blechen im Umluftofen roesten, statt grosse Mengen in der Pfanne zu braten - so braeunt er, ohne zu dampfen.
* Mit veganer Butter bleibt das Gericht vegan.
* Die Naehrwerte sind grobe Schaetzungen - bitte pruefen und anpassen.
```

Replace the `ae`/`oe`/`ue`/`ss` digraphs with proper umlauts and eszett when you paste this in — they are written this way here only to keep the plan file plain ASCII.

The ingredient list must have exactly the same number of entries, in the same order, as the English file. The German entry supplies text only; quantities come from English at render time.

- [ ] **Step 5: Verify the build accepts the new collections**

Run: `npm run build`
Expected: completes with no schema errors. Page count stays 93 — no German routes exist yet.

- [ ] **Step 6: Commit**

```bash
git add src/content/config.ts src/content/recipes-de src/content/dinners-de package.json package-lock.json
git commit -m "Add German content collections with a seed translation"
```

---

### Task 5: German routes and the fallback banner

**Files:**
- Modify: `astro.config.mjs`
- Modify: `src/styles/global.css`
- Create: `src/components/TranslationBanner.astro`
- Create: `src/pages/de/recipes/[...slug].astro`
- Create: `src/pages/de/cloyne/index.astro`
- Create: `src/pages/de/cloyne/[slug].astro`
- Create: `src/pages/de/dinners/index.astro`
- Create: `src/pages/de/dinners/[slug].astro`

**Interfaces:**
- Consumes: `resolveTranslation`, `BannerKind` (Task 2); `t`, `Locale` (Task 1); collections `recipes-de` / `dinners-de` (Task 4)
- Produces: the `/de/**` routes

- [ ] **Step 1: Enable i18n in the Astro config**

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  integrations: [react()],
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'de'],
    routing: { prefixDefaultLocale: false },
  },
});
```

English URLs stay unprefixed. The `/de/**` routes are explicit page files, not generated by this config.

- [ ] **Step 2: Write the banner component**

```astro
---
// src/components/TranslationBanner.astro
import { t, type Locale } from '../lib/ui-strings';
import type { BannerKind } from '../lib/translation';
interface Props { kind: BannerKind; lang: Locale }
const { kind, lang } = Astro.props;
const key = kind === 'unreviewed' ? 'bannerUnreviewed' : kind === 'stale' ? 'bannerStale' : 'bannerMissing';
---
{kind && <p class="translation-banner" role="note">{t(lang, key)}</p>}
```

Append to `src/styles/global.css`:

```css
.translation-banner { border: 1px solid #c8a45a; background: #fdf6e6; padding: 0.6rem 0.9rem; border-radius: 6px; font-size: 0.9rem; }
```

- [ ] **Step 3: Write the German recipe route**

```astro
---
// src/pages/de/recipes/[...slug].astro
import { getCollection } from 'astro:content';
import BaseLayout from '../../../layouts/BaseLayout.astro';
import RecipeScaler from '../../../components/RecipeScaler';
import TranslationBanner from '../../../components/TranslationBanner.astro';
import { resolveTranslation } from '../../../lib/translation';

export async function getStaticPaths() {
  const recipes = await getCollection('recipes');
  const german = await getCollection('recipes-de');
  const byId = new Map(german.map((g) => [g.id.replace(/\.md$/, ''), g]));
  return recipes.map((entry) => {
    const slug = entry.id.replace(/\.md$/, '');
    return { params: { slug }, props: { entry, germanEntry: byId.get(slug) } };
  });
}

const { entry, germanEntry } = Astro.props;
const english = { title: entry.data.title, ingredients: entry.data.ingredients, body: entry.body };
const { useGerman, banner } = resolveTranslation({
  english,
  german: germanEntry
    ? { sourceHash: germanEntry.data.sourceHash, reviewed: germanEntry.data.reviewed }
    : undefined,
});

const chosen = useGerman ? germanEntry! : entry;
const { Content } = await chosen.render();

// Quantities ALWAYS come from the English entry; German supplies text only.
const ingredients = entry.data.ingredients.map((ing, i) => ({
  ...ing,
  item: useGerman ? germanEntry!.data.ingredients[i].item : ing.item,
  note: useGerman ? germanEntry!.data.ingredients[i].note : ing.note,
  group: useGerman ? germanEntry!.data.ingredients[i].group : ing.group,
}));
---
<BaseLayout title={chosen.data.title} lang="de">
  <h1>{chosen.data.title}</h1>
  <TranslationBanner kind={banner} lang="de" />
  <RecipeScaler client:load baseServings={entry.data.servings} ingredients={ingredients} />
  <article><Content /></article>
</BaseLayout>
```

- [ ] **Step 4: Write the German cloyne route**

```astro
---
// src/pages/de/cloyne/[slug].astro
import { getCollection, getEntry } from 'astro:content';
import BaseLayout from '../../../layouts/BaseLayout.astro';
import DinnerChecklist from '../../../components/DinnerChecklist';
import TranslationBanner from '../../../components/TranslationBanner.astro';
import { buildChecklistDish, type DishView } from '../../../lib/dinner';
import { resolveTranslation } from '../../../lib/translation';
import { t } from '../../../lib/ui-strings';

export async function getStaticPaths() {
  const dinners = await getCollection('dinners', ({ data }) => data.kind === 'cloyne');
  const german = await getCollection('dinners-de');
  const bySlug = new Map(german.map((g) => [g.slug, g]));
  return dinners.map((entry) => ({
    params: { slug: entry.slug },
    props: { entry, germanEntry: bySlug.get(entry.slug) },
  }));
}

const { entry, germanEntry } = Astro.props;
const d = entry.data;

const { useGerman, banner } = resolveTranslation({
  english: { title: d.title, summary: d.summary, body: entry.body },
  german: germanEntry
    ? { sourceHash: germanEntry.data.sourceHash, reviewed: germanEntry.data.reviewed }
    : undefined,
});
const chosen = useGerman ? germanEntry! : entry;
const { Content } = await chosen.render();

const germanRecipes = await getCollection('recipes-de');
const germanBySlug = new Map(germanRecipes.map((g) => [g.id.replace(/\.md$/, ''), g]));

// The dish list ALWAYS comes from the English dinner file - single source of truth.
const dishes: DishView[] = [];
for (const dish of d.dishes) {
  const recipe = await getEntry(dish.recipe);
  const germanRecipe = germanBySlug.get(recipe.id.replace(/\.md$/, ''));
  const r = resolveTranslation({
    english: { title: recipe.data.title, ingredients: recipe.data.ingredients, body: recipe.body },
    german: germanRecipe
      ? { sourceHash: germanRecipe.data.sourceHash, reviewed: germanRecipe.data.reviewed }
      : undefined,
  });
  const source = r.useGerman
    ? {
        ...recipe.data,
        title: germanRecipe!.data.title,
        ingredients: recipe.data.ingredients.map((ing, i) => ({
          ...ing,
          item: germanRecipe!.data.ingredients[i].item,
          note: germanRecipe!.data.ingredients[i].note,
          group: germanRecipe!.data.ingredients[i].group,
        })),
      }
    : recipe.data;
  const body = r.useGerman ? germanRecipe!.body : recipe.body;
  dishes.push(buildChecklistDish(source, body, dish.servings, dish.notes ?? [], dish.optional ?? false));
}
---
<BaseLayout title={chosen.data.title} lang="de">
  <a class="back-link" href="/de/cloyne">{t('de', 'backToCloyne')}</a>
  <h1>{chosen.data.title}</h1>
  <TranslationBanner kind={banner} lang="de" />
  {chosen.data.summary && <p class="lede">{chosen.data.summary}</p>}
  <article><Content /></article>
  <DinnerChecklist client:load slug={`cloyne-de-${entry.slug}`} dishes={dishes} />
</BaseLayout>
```

The checklist `slug` is `cloyne-de-...` so German checkbox progress does not collide with the English page's stored state.

- [ ] **Step 5: Write the German index and dinner routes**

`src/pages/de/cloyne/index.astro` mirrors `src/pages/cloyne/index.astro` exactly, with two changes: pass `lang="de"` to `BaseLayout`, and link to `/de/cloyne/<slug>` instead of `/cloyne/<slug>`.

`src/pages/de/dinners/[slug].astro` mirrors the cloyne route above against non-cloyne dinners (`getCollection('dinners', ({ data }) => data.kind !== 'cloyne')`), using checklist slug `dinner-de-<slug>` and the `backToDinners` string with `href="/de/dinners"`.

`src/pages/de/dinners/index.astro` mirrors `src/pages/dinners/index.astro` with the same two changes.

- [ ] **Step 6: Verify the German routes build**

Run: `npm run build`
Expected: page count rises from 93 to roughly 175 (65 German recipes, German cloyne and dinner pages, 2 German indexes). The seed recipe renders in German; every other German recipe renders English with the "not translated yet" banner.

- [ ] **Step 7: Check the seed page by eye**

Run `npm run dev`, then open `http://localhost:4321/de/recipes/sides/chili-lime-corn`

Expected: German text, the unreviewed banner, and the ingredient quantities identical to `/recipes/sides/chili-lime-corn`.

- [ ] **Step 8: Commit**

```bash
git add astro.config.mjs src/components/TranslationBanner.astro src/pages/de src/styles/global.css
git commit -m "Add German routes with English fallback and translation banner"
```

---

### Task 6: Translation script

**Files:**
- Create: `scripts/translate.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `translatableFields`, `fingerprint` (Task 2)
- Produces: `npm run translate`, writing `src/content/recipes-de/**`

- [ ] **Step 1: Install dependencies**

```bash
npm install --save-dev @anthropic-ai/sdk zod
```

- [ ] **Step 2: Write the script**

```javascript
// scripts/translate.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { translatableFields, fingerprint } from '../src/lib/translation.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FORCE = process.argv.includes('--force');
const client = new Anthropic();

const TranslationSchema = z.object({
  translations: z.array(z.object({ key: z.string(), text: z.string() })),
});

const SYSTEM = [
  'You translate co-op kitchen recipes from English into German.',
  '',
  'Rules:',
  '- Translate ONLY the text you are given. Never add, remove, or reorder entries.',
  '- Never translate, convert, or restate numbers, quantities, or units. If a string',
  '  contains a number or a unit (cups, lb, oz, tbsp, tsp, F), keep it exactly as written.',
  '- Keep US units and US equipment names. The cooks work in a Berkeley kitchen with US',
  '  suppliers - do NOT convert to metric and do NOT substitute German ingredients.',
  '- Preserve markdown structure exactly: heading levels, numbered lists, bullets, bold.',
  '- Translate the heading "Instructions" to "Zubereitung" and "Notes" to "Hinweise".',
  '- Return exactly one entry per input key, reusing the same key.',
].join('\n');

async function translateFields(fields) {
  const response = await client.messages.parse({
    model: 'claude-opus-5',
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify({ fields }, null, 2) }],
    output_config: { format: zodOutputFormat(TranslationSchema) },
  });
  if (response.stop_reason === 'refusal') {
    throw new Error(`Refused: ${response.stop_details?.explanation ?? 'unknown'}`);
  }
  const parsed = response.parsed_output;
  if (!parsed) throw new Error('Model returned no parsable output');
  const byKey = new Map(parsed.translations.map((entry) => [entry.key, entry.text]));
  for (const f of fields) {
    if (!byKey.has(f.key)) throw new Error(`Missing translation for key ${f.key}`);
  }
  return byKey;
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : full.endsWith('.md') ? [full] : [];
  });
}

async function translateRecipe(absPath) {
  const rel = path.relative(path.join(ROOT, 'src/content/recipes'), absPath);
  const outPath = path.join(ROOT, 'src/content/recipes-de', rel);
  const parsed = matter(fs.readFileSync(absPath, 'utf8'));
  const english = {
    title: parsed.data.title,
    ingredients: parsed.data.ingredients,
    body: parsed.content,
  };
  const hash = fingerprint(english);

  if (!FORCE && fs.existsSync(outPath)) {
    const existing = matter(fs.readFileSync(outPath, 'utf8'));
    if (existing.data.sourceHash === hash) return 'skipped';
  }

  const byKey = await translateFields(translatableFields(english));

  const ingredients = parsed.data.ingredients.map((ing, i) => {
    const out = { item: byKey.get(`ingredients.${i}.item`) };
    if (ing.note) out.note = byKey.get(`ingredients.${i}.note`);
    if (ing.group) out.group = byKey.get(`ingredients.${i}.group`);
    return out;
  });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    matter.stringify(byKey.get('body'), {
      title: byKey.get('title'),
      sourceHash: hash,
      reviewed: false,
      ingredients,
    }),
  );
  return 'written';
}

const recipes = walk(path.join(ROOT, 'src/content/recipes'));
let written = 0;
let skipped = 0;
for (const file of recipes) {
  const result = await translateRecipe(file);
  if (result === 'written') {
    written += 1;
    console.log(`translated ${path.relative(ROOT, file)}`);
  } else {
    skipped += 1;
  }
}
console.log(`\n${written} translated, ${skipped} already current.`);
console.log('All new files are reviewed: false - set reviewed: true after a German speaker checks them.');
```

Add to the `scripts` block in `package.json`:

```json
"translate": "node --experimental-strip-types scripts/translate.mjs"
```

`--experimental-strip-types` lets the script import `src/lib/translation.ts` directly, so the script and the site compute byte-identical fingerprints. Check `node --version` is 22.6 or newer. If it is older, drop the flag and inline a JS copy of `translatableFields` / `fingerprint` in the script — but then add a test asserting the two implementations agree.

- [ ] **Step 3: Extend the script to dinner files**

Dinner prose needs translating too. Append to `scripts/translate.mjs`, before the recipe loop:

```javascript
async function translateDinner(absPath) {
  const rel = path.relative(path.join(ROOT, 'src/content/dinners'), absPath);
  const outPath = path.join(ROOT, 'src/content/dinners-de', rel);
  const parsed = matter(fs.readFileSync(absPath, 'utf8'));

  // Dish notes are per-dish; flatten them in file order so keys stay stable.
  const notes = (parsed.data.dishes ?? []).flatMap((dish) => dish.notes ?? []);
  const english = {
    title: parsed.data.title,
    summary: parsed.data.summary,
    notes,
    body: parsed.content,
  };
  const hash = fingerprint(english);

  if (!FORCE && fs.existsSync(outPath)) {
    const existing = matter(fs.readFileSync(outPath, 'utf8'));
    if (existing.data.sourceHash === hash) return 'skipped';
  }

  const byKey = await translateFields(translatableFields(english));

  const frontmatter = { title: byKey.get('title'), sourceHash: hash, reviewed: false };
  if (parsed.data.summary) frontmatter.summary = byKey.get('summary');
  if (notes.length) frontmatter.notes = notes.map((_, i) => byKey.get(`notes.${i}`));

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, matter.stringify(byKey.get('body'), frontmatter));
  return 'written';
}
```

and run it alongside the recipes, replacing the final loop:

```javascript
const targets = [
  ...walk(path.join(ROOT, 'src/content/recipes')).map((f) => ['recipe', f]),
  ...walk(path.join(ROOT, 'src/content/dinners')).map((f) => ['dinner', f]),
];
let written = 0;
let skipped = 0;
for (const [kind, file] of targets) {
  const result = kind === 'recipe' ? await translateRecipe(file) : await translateDinner(file);
  if (result === 'written') {
    written += 1;
    console.log(`translated ${path.relative(ROOT, file)}`);
  } else {
    skipped += 1;
  }
}
console.log(`\n${written} translated, ${skipped} already current.`);
console.log('All new files are reviewed: false - set reviewed: true after a German speaker checks them.');
```

Note the German dinner file carries **no `dishes` key**. The dish list and every serving count
stay in the English file, exactly as the spec requires, so the two languages can never disagree
about what is being cooked.

- [ ] **Step 4: Dry-run on a single recipe**

Temporarily change the loop to `for (const [kind, file] of targets.slice(0, 1))`, then:

```bash
export ANTHROPIC_API_KEY=...
npm run translate
```

Expected: one file written under `src/content/recipes-de/`, with `reviewed: false` and an ingredient count matching the English entry.

- [ ] **Step 5: Verify no quantities or dish lists leaked into German files**

```bash
grep -rE "qty|unit:|grams|ml:" src/content/recipes-de/ || echo "recipes clean"
grep -rE "dishes:|servings:" src/content/dinners-de/ || echo "dinners clean"
```

Expected: both `clean` lines. If anything matches, the whitelist is broken — stop and fix before continuing.

- [ ] **Step 6: Restore the full loop and commit**

```bash
git add scripts/translate.mjs package.json package-lock.json
git commit -m "Add German translation script"
```

---

### Task 7: Drift detection test

**Files:**
- Create: `src/lib/translation-freshness.test.ts`

**Interfaces:**
- Consumes: `fingerprint` (Task 2)

- [ ] **Step 1: Write the test**

```typescript
// src/lib/translation-freshness.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { fingerprint } from './translation';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const EN = path.join(ROOT, 'src/content/recipes');
const DE = path.join(ROOT, 'src/content/recipes-de');

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : full.endsWith('.md') ? [full] : [];
  });
}

const germanFiles = walk(DE);

describe('German translations are current', () => {
  it('has something to check or is legitimately empty', () => {
    expect(Array.isArray(germanFiles)).toBe(true);
  });

  for (const file of germanFiles) {
    const rel = path.relative(DE, file);

    it(`${rel} matches its English source`, () => {
      const englishPath = path.join(EN, rel);
      expect(fs.existsSync(englishPath), `orphaned German file: ${rel}`).toBe(true);

      const en = matter(fs.readFileSync(englishPath, 'utf8'));
      const de = matter(fs.readFileSync(file, 'utf8'));

      expect(
        de.data.sourceHash,
        `${rel} is stale - run \`npm run translate\` and re-review`,
      ).toBe(
        fingerprint({ title: en.data.title, ingredients: en.data.ingredients, body: en.content }),
      );

      expect(
        de.data.ingredients.length,
        `${rel} has a different ingredient count than English`,
      ).toBe(en.data.ingredients.length);
    });
  }
});
```

A missing German file is deliberately not a failure — that is the fallback path.

- [ ] **Step 2: Run the test against the seed file**

Run: `npx vitest run src/lib/translation-freshness.test.ts`
Expected: PASS

- [ ] **Step 3: Prove the test catches drift**

Change the seed's `sourceHash` to `deadbeef`, re-run, and confirm it FAILS with the "is stale" message. Then restore the correct hash and confirm it passes again.

- [ ] **Step 4: Commit**

```bash
git add src/lib/translation-freshness.test.ts
git commit -m "Fail the test suite when German translations drift"
```

---

### Task 8: The footer toggle

**Files:**
- Create: `src/components/LanguageToggle.tsx`
- Create: `src/components/LanguageToggle.css`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `counterpartPath`, `localeOf` (Task 3); `t` (Task 1)

- [ ] **Step 1: Write the component**

```tsx
// src/components/LanguageToggle.tsx
import { useEffect, useState } from 'react';
import { counterpartPath, localeOf } from '../lib/locale-paths';
import { t } from '../lib/ui-strings';
import './LanguageToggle.css';

export default function LanguageToggle() {
  const [pathname, setPathname] = useState<string | null>(null);
  useEffect(() => setPathname(window.location.pathname), []);
  if (pathname === null) return null;

  const lang = localeOf(pathname);
  const target = counterpartPath(pathname);
  const isGerman = lang === 'de';

  if (!target) {
    return (
      <span className="lang-toggle is-disabled" title="No German version of this page">
        <span className="lang-toggle-track" aria-hidden="true"><span className="lang-toggle-thumb" /></span>
        <span>Deutsch</span>
      </span>
    );
  }

  return (
    <a className={`lang-toggle${isGerman ? ' is-on' : ''}`} href={target} role="switch" aria-checked={isGerman}>
      <span className="lang-toggle-track" aria-hidden="true"><span className="lang-toggle-thumb" /></span>
      <span>{t(lang, 'switchLanguage')}</span>
    </a>
  );
}
```

Returning `null` until the effect runs keeps the static HTML identical across pages, so the toggle never flashes the wrong state before hydration.

- [ ] **Step 2: Write the styles**

```css
/* src/components/LanguageToggle.css */
.lang-toggle { display: inline-flex; align-items: center; gap: 0.5rem; text-decoration: none; color: inherit; font-size: 0.9rem; }
.lang-toggle-track { width: 34px; height: 18px; border-radius: 999px; background: #c9d3cc; position: relative; transition: background 0.15s ease; }
.lang-toggle-thumb { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform 0.15s ease; }
.lang-toggle.is-on .lang-toggle-track { background: #6f9480; }
.lang-toggle.is-on .lang-toggle-thumb { transform: translateX(16px); }
.lang-toggle.is-disabled { opacity: 0.45; cursor: not-allowed; }
```

- [ ] **Step 3: Mount it in the footer**

Add the import to `src/layouts/BaseLayout.astro`:

```astro
import LanguageToggle from '../components/LanguageToggle';
```

Replace the footer:

```astro
    <footer class="container footer-row">
      <span>{t(lang, 'footer')}</span>
      <LanguageToggle client:load />
    </footer>
```

Append to `src/styles/global.css`:

```css
.footer-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
```

- [ ] **Step 4: Verify behaviour in the browser**

Run `npm run dev`, then check:
- `/cloyne/bbq-night` — toggle reads "Deutsch", off; clicking goes to `/de/cloyne/bbq-night`
- `/de/cloyne/bbq-night` — toggle reads "English", on; clicking returns to the English page
- `/shopping-list` — toggle is greyed out and not clickable

- [ ] **Step 5: Commit**

```bash
git add src/components/LanguageToggle.tsx src/components/LanguageToggle.css src/layouts/BaseLayout.astro src/styles/global.css
git commit -m "Add German language toggle to the footer"
```

---

### Task 9: Translate everything, then document the workflow

**Files:**
- Create: `src/content/recipes-de/**` (generated)
- Modify: `README.md`

- [ ] **Step 1: Run the full translation**

```bash
export ANTHROPIC_API_KEY=...
npm run translate
```

Expected: 76 files written — 64 recipes (the seed is skipped as current) plus 12 dinners. Watch for refusals or missing-key errors; the script is idempotent, so re-running only retries what failed.

- [ ] **Step 2: Verify no quantities leaked**

```bash
grep -rE "qty|unit:|grams|ml:" src/content/recipes-de/ || echo "clean"
```

Expected: `clean`

- [ ] **Step 3: Verify the suite and the build**

Run: `npm test && npm run build`
Expected: all tests pass (the freshness test now covers 65 files); build completes with roughly 175 pages.

- [ ] **Step 4: Spot-check three recipes in the browser**

Open the German page for a recipe with ingredient groups (`sesame-cabbage-salad`), one with a range (`roasted-potatoes`, which uses `qtyMax`), and one with a "to taste" ingredient that has no `qty` (`garlic-lemon-roasted-broccoli`). Confirm the quantities match the English page exactly in all three.

- [ ] **Step 5: Document the workflow**

Add to `README.md` after the "Adding a recipe with an LLM" section:

    ## German translations

    German versions of the recipe, dinner and cloyne pages live under `/de/...`, reachable
    from the toggle in the footer. German content lives in `src/content/recipes-de/` and
    `src/content/dinners-de/`, mirroring the English paths.

    **Only text is translated.** Quantities, units and serving counts always come from the
    English file, so both languages show identical amounts.

    After adding or editing a recipe:

        export ANTHROPIC_API_KEY=...   # needed to run the translator, never to build
        npm run translate              # translates anything missing or out of date
        npm test                       # fails if a German file is stale

    New translations are written with `reviewed: false` and render with a banner warning
    that they are machine output. **Set `reviewed: true` by hand only after someone who
    reads German has checked the recipe**, paying particular attention to ingredient names.
    Editing an English recipe resets its German file to unreviewed.

    A missing or stale German file falls back to English with an explanatory banner, so an
    untranslated recipe never breaks the site.

- [ ] **Step 6: Commit**

```bash
git add src/content/recipes-de README.md
git commit -m "Translate all recipes into German and document the workflow"
```

---

## Review gate before this ships

Every German file is `reviewed: false` at the end of Task 9, so the entire German site
renders with the machine-translation banner. That is the intended end state for this plan.
Flipping `reviewed: true` requires a human pass over ingredient vocabulary and is deliberately
not part of it.

## Out of scope, by design

Per the spec: no metric or temperature conversion, no translated `tags`, no German versions of
the home page, search, shopping-list builder or nutrition pages, and no browser-language
auto-detection. `counterpartPath` returns `null` for those routes, so the footer toggle renders
disabled there rather than linking somewhere that does not exist.
