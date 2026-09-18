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
| `nutrition` | no | Per serving: `calories`, `protein`, `carbs`, `fat`; optional `servingGrams` (one serving's weight in g, enables a per-100g calorie display) |
| `tags` | no | String list |
| `ingredients` | yes | List of ingredient objects (below) |

Ingredient fields: `item` (required), `qty`, `qtyMax` (range upper bound), `unit`, `grams`,
`ml`, `note`, `group` (subsection label), `optional`. **Omit `qty` for "to taste" items** -
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
- `nutrition` (per serving): `calories`, `protein`, `carbs`, `fat` - estimate if not given. Optionally `servingGrams` (estimated weight of one serving, in grams) to enable a calories-per-100g display.
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

## German translations

German versions of recipe, dinner and Cloyne pages live under `/de/...`, reachable from the
toggle in the footer. The toggle is server-rendered and works without JavaScript; it renders
disabled (not linked) on pages with no German counterpart - the home page, the shopping-list
builder, and nutrition pages.

German content lives in `src/content/recipes-de/` and `src/content/dinners-de/`, mirroring the
English paths. **Only text is translated.** Structured quantity fields (`qty`, `unit`, `grams`,
`ml`, serving counts) are never sent to the translator and are always read from the English file
at render time, so ingredient amounts and servings always match between languages.

Numbers that appear *inside* translated prose - a dinner summary's "- serves ~96.", a recipe
body's internal-temperature check ("165°F"), oven temps and times throughout instructions - are
not structured fields, so that guarantee doesn't cover them by construction. `npm run translate`
closes that gap with an explicit check: after the model translates a field, it compares the
ordered sequence of numeric *values* in the English text against the same sequence in the German
text and refuses to write the file if they don't match exactly, reporting the field and both
sequences instead. The comparison is value-based, not notational: `½`, `1/2`, `0.5`, and `0,5` all
compare equal, since a translator choosing different notation for the same quantity (a Unicode
fraction rewritten as an ASCII fraction or a German decimal comma, "1.100" vs "1,000" as
thousands-separator style) is not a number change. A file that fails this check is left
untranslated (falls back to English with a banner) rather than silently shipping a wrong number.

After adding or editing a recipe or dinner:

```bash
export ANTHROPIC_API_KEY=...   # needed to run the translator, never to build
npm run translate               # translates recipes and dinners that are missing or out of date
npm test                        # fails if a German file is stale or misaligned
```

`npm run translate` walks both `src/content/recipes/` and `src/content/dinners/` and skips any
file whose German counterpart already has a matching `sourceHash` - so a normal run only pays for
what actually changed. Pass `--force` to re-translate everything regardless of hash.

The stored hash covers only the translatable text (title, ingredient names/notes/groups, body -
plus summary and dish notes for dinners). Rescaling a recipe, changing its serving count, or
updating its nutrition does **not** invalidate an existing translation, since none of that is
translated text; editing a title, an ingredient name or note, or the body does.

Freshness is enforced by two test files, both part of the normal `npm test` run:

- `src/lib/translation-freshness.test.ts` fails if a German file's `sourceHash` no longer matches
  its English source's current hash.
- `src/lib/translation-alignment.test.ts` fails if a German file's ingredient count diverges from
  its English source's.

New translations are written with `reviewed: false` and render with a banner reading
*"Maschinell übersetzt — Mengen auf Englisch prüfen"*. **Set `reviewed: true` by hand only after
someone who reads German has checked the recipe**, paying particular attention to ingredient
vocabulary. Editing the English source changes its hash, which resets the German file to
unreviewed on the next translate run.

A missing or stale German file falls back to English with an explanatory banner, so an
untranslated or out-of-date recipe never breaks the page.

A Cloyne or dinner page pulls in several dish recipes, each with its own translation state. The
page shows the worst banner across the dinner file itself and every dish it includes (`unreviewed`
beats `stale` beats `missing` beats no banner), so a dish rendering unreviewed machine-translated
German is never masked by, say, the dinner file itself having no German version at all. Similarly,
if a dish's German body doesn't yield the same number of instruction steps as its English source
(most commonly because it used a heading other than "Zubereitung"), that dish falls back to
English entirely rather than rendering an ingredient list with no method.

**Known limitations:**

- The alignment check catches a dropped/added ingredient line and a note or group appearing at
  the wrong position, but it cannot catch two German ingredients of the same shape (both with a
  note, say) swapped with each other - nothing links a German ingredient back to its specific
  English source line. The `unreviewed` banner is the backstop for this: a human check before
  flipping `reviewed: true` is what catches it.
- `npm run translate` needs `ANTHROPIC_API_KEY` exported locally; it is never invoked during the
  Vercel build, which only builds already-committed files. A translation-provider outage can
  never break a deploy.

As of this writing, only the hand-written seed translation (`sides/chili-lime-corn`) exists under
`src/content/recipes-de/`; everything else awaits a `npm run translate` run.

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
- Keep `notes` to things the page can't work out on its own - pan counts, equipment, prep order.
  Never restate the scale factor or the scaled amounts ("12x the base recipe", "use 18 lb of corn"):
  the page already computes and displays those, so repeating them is noise the head cook has to read past.
- The build fails if a `recipe` slug doesn't exist, so typos are caught before deploy.
- Quantities scale automatically from the recipe's base servings - no hand math.
- View at `/dinners/<slug>`; reuse next week by copying the file and adjusting servings/notes.
- If a dish isn't a recipe yet, add it to `src/content/recipes/` first (see the recipe format above), then reference it.
- `kind` sorts a dinner into a section: `everyday` (regular rotation, shown on the home page), `event`
  (large one-off dinners, default if omitted), or `cloyne` (co-op sized menus - see below). `summary` and
  `sortOrder` are optional too.

### Cloyne menus (co-op sized, ~150 servings)

Cloyne menus are dinner files with `kind: cloyne` - same format as above, same scaling and checklist
machinery, just filed under their own tab instead of the regular dinner list. They live in
`src/content/dinners/<slug>.md` alongside everything else and show up at `/cloyne` and `/cloyne/<slug>`.

```markdown
---
title: Enchilada Night
kind: cloyne
summary: Chicken, cheese, and vegan enchiladas with fajitas, beans, and street corn - serves ~150.
dishes:
  - recipe: pasta-and-bakes/chicken-enchiladas
    servings: 120
  - recipe: pasta-and-bakes/cheese-enchiladas
    servings: 60
---

Shift notes go here.
```

See `src/content/dinners/enchilada-night.md` for a full worked example.

### Adding a Cloyne menu with an LLM

Paste the prompt below into an LLM along with your menu (dish names + how many servings each - remember
Cloyne portions are co-op scale, typically 100-150+ per dish).

---

Create an Astro dinner file for my recipe site's Cloyne (co-op sized) menus. Output only the file contents.

- Frontmatter: `title`, `kind: cloyne`, optional `summary` (one line) and `date` (YYYY-MM-DD), and `dishes`.
- Each dish: `recipe` (a recipe slug like `tofu/buffalo-tofu` - ask me if unsure which slug), `servings`
  (a number, co-op scale - usually 100-150+), and optional `notes` (a YAML list of short head-cook
  reminders: pan counts, batching, timing).
- After the frontmatter, write the overall shift notes as a short markdown paragraph.
- Do not invent recipe slugs; use only ones I provide. If a dish isn't a recipe yet, tell me so I can add
  it first.

Here is the menu:

[PASTE MENU HERE]

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
