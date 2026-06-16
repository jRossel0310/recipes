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
