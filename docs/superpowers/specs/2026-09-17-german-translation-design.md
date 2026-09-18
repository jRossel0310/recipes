# German Translation Toggle — Design Spec

**Date:** 2026-09-17
**Status:** Approved (pending implementation plan)
**Branch:** german-translation (off main)

## Context & goal

The site serves a Berkeley Student Cooperative kitchen. Some cooks working shifts read German
more comfortably than English, and today every page — recipes, dinner checklists, cloyne
menus — is English only. There is no i18n of any kind in the repo: no locales, no Astro i18n
config, and `<html lang="en">` is hardcoded in `BaseLayout.astro`.

Goal: a **German version of the pages cooks actually read on shift**, reachable from a toggle
switch in the footer, that is trustworthy enough to cook from.

The audience is explicitly **German-speaking cooks in the Berkeley kitchen** — not German
readers generally. They use the co-op's US equipment, US suppliers and US ingredient names.
This is a language translation, not a recipe adaptation.

## The safety constraint driving this design

Quantities are the one thing that must never differ between the two versions. A cook reading
the German page and a cook reading the English page are working the same dish on the same
shift, and a mistranslated or re-converted amount is a real cost and safety problem that
nobody catches mid-shift.

Two rules follow, and everything else in this spec serves them:

1. **The translator only touches whitelisted text fields.** Numbers, units, `qty`, `qtyMax`,
   `grams` and `ml` are copied byte-for-byte and never sent for translation.
2. **Machine output is visibly marked as such** until a human who reads German has reviewed it.

## Scope

**In scope (v1):**
- Parallel `recipes-de` content collection, mirroring English paths.
- `npm run translate` script with hash-based staleness detection.
- Astro i18n routing: `/de/…` mirrors for recipe, dinner and cloyne pages plus their indexes.
- Footer `LanguageToggle` island.
- `ui-strings.ts` dictionary (~30 keys) for nav, footer, section headings, checklist labels.
- Per-page fallback and the unreviewed-translation banner.
- Unit tests for staleness, URL mapping, fallback selection and string-table completeness.

**Out of scope (v1):**
- Metric/°C conversion. US units stay as-is in both languages.
- Translating `tags` (keeps the search index single-language).
- German versions of the home page, search, shopping-list builder and nutrition pages.
- Browser-language auto-detection or auto-redirect.
- Any judgement on translation *quality* — that is the human review gate, not a test.

## Data model

German recipes live at `src/content/recipes-de/<category>/<name>.md`, mirroring the English
path exactly. The German twin of a recipe is the same slug in the other collection — no
mapping table.

The schema is the English recipe schema plus:

| Field | Purpose |
|-------|---------|
| `sourceHash` | SHA-256 of the English file's *translatable text only*; drives staleness detection. Scoping it to text means rescaling a recipe or correcting its nutrition does not invalidate a good translation |
| `reviewed` | Boolean, defaults `false`. Set by hand after a German-reading human checks it |

Translated fields: `title`, `summary`, and each ingredient's `item`, `note` and `group`, plus
the markdown body (`## Instructions`, `## Notes`).

Copied verbatim, never translated: `qty`, `qtyMax`, `unit`, `grams`, `ml`, `servings`,
`nutrition`, `tags`, `source`, `optional`.

Because the numeric fields are identical, German pages run through the existing `scale.ts` and
`units.ts` untouched and produce identical quantities.

### Dinner and cloyne files

German dinner files live at `src/content/dinners-de/<slug>.md` and carry **only translated
prose**: `title`, `summary`, any dish `notes`, and the markdown body of shift notes. They
carry `sourceHash` and `reviewed` like recipes do.

They deliberately **do not contain a `dishes` list.** The dish list — which recipes are being
cooked and at what serving count — is always read from the English file in `dinners/`. A
German dinner file that duplicated it could drift, and two cooks on the same shift could end
up reading different dishes or different serving counts off the same menu. Keeping one source
of truth for the dish list makes that failure impossible rather than merely unlikely.

A German dinner page therefore composes the English `dishes` array with German prose and
German recipe content, falling back per-recipe as described below.

## Translation script

`scripts/translate.mjs`, run as `npm run translate`.

1. Walk `src/content/recipes/**/*.md` and the in-scope dinner files.
2. SHA-256 each file's translatable text (not the whole file).
3. If the German twin exists and its `sourceHash` matches, skip it.
4. Otherwise extract the whitelisted strings, send them to Claude, and receive them back as
   structured JSON keyed by field path.
5. Write the German file with the new `sourceHash` and `reviewed: false`.

A changed English source resets `reviewed` to `false` by design — an edited recipe has not
been re-reviewed. `--force` re-translates everything.

The API key is read from the local environment. **The Vercel build never calls a translation
API**; it only builds committed files, so deploys stay hermetic and a provider outage cannot
break a deploy.

*Implementation note: load the `claude-api` skill before writing this script, for current
model IDs and SDK usage.*

## Drift detection

A vitest case recomputes every `sourceHash` and fails when a German file is stale. Drift
surfaces in `npm test` and CI rather than sitting unnoticed.

A **missing** German file is not a test failure — that is the fallback path below.

## Routing and fallback

Astro i18n with `defaultLocale: 'en'` and `prefixDefaultLocale: false`, so existing English
URLs are unchanged and German mirrors under `/de/…`:

- `/de/recipes/<category>/<name>`
- `/de/dinners/<slug>` and `/de/dinners`
- `/de/cloyne/<slug>` and `/de/cloyne`

German routes reuse the existing components; only the content source differs. `<html lang>`
becomes a `BaseLayout` prop.

Per-page resolution:

| German state | Renders |
|---|---|
| Present, `reviewed: true` | German, no banner |
| Present, `reviewed: false` | German **with banner**: `Maschinell übersetzt — Mengen auf Englisch prüfen` |
| Stale (`sourceHash` mismatch) | English content, banner explaining the translation is out of date |
| Missing | English content, banner explaining it is not yet translated |

Falling back to English rather than rendering stale German is deliberate: outdated text that
looks authoritative is worse than text in the wrong language.

## The toggle

`src/components/LanguageToggle.tsx`, a React island in the footer, consistent with the
existing `RecipeScaler` / `DinnerChecklist` pattern. It maps the current path to its
counterpart and navigates.

Two deliberate behaviors:

- **No auto-redirect** based on stored preference. Silent redirects on a static site are
  disorienting, especially mid-shift.
- **Disabled, not dead-linked,** on pages with no German counterpart (home, search, shopping
  list).

## UI strings

`src/lib/ui-strings.ts` — a locale-keyed dictionary of roughly 30 strings: nav labels, footer
text, `Ingredients` / `Instructions` / `Notes` / `Servings` headings, checklist labels and the
banner copy. React islands take a `lang` prop.

## Testing

- Staleness: hash mismatch is detected; matching hash passes; missing file does not fail.
- Field whitelist: a German file's numeric and unit fields are identical to its English source.
- URL mapping: every in-scope English route maps to its `/de/` counterpart and back.
- Fallback selection: each of the four states above resolves to the right content and banner.
- String table: both locales define every key.
- Build: `npm run build` emits the expected `/de/` routes.

Translation *quality* is explicitly not tested. That is what `reviewed` is for.

## Risks

- **Review is the long pole.** ~19.7k words across 65 recipes. The code is roughly a day; the
  German review of ingredient vocabulary is the work that makes this trustworthy, and it needs
  a German-reading human.
- **Page count roughly doubles** for in-scope routes. Build time is currently ~2s for 93
  pages, so this is not a practical concern.
- **Ongoing upkeep.** Every new recipe needs `npm run translate` and a review pass. The
  staleness test makes neglect visible rather than silent.
