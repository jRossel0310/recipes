#!/usr/bin/env python3
"""
shopping_list.py — Build a consolidated shopping list from multiple recipes.

Drop this file in the root of the recipes repo. It scans the markdown recipe
files in the sub-folders (Tofu/, bread/, breakfasts/, desserts/, dinners/,
probation/, …), parses their `**Servings:**` and `## Ingredients` sections,
scales each recipe to a target serving count, then merges overlapping
ingredients across recipes into a single shopping list with summed quantities.

Quick start:

    # List every recipe the script can see, then quit:
    python shopping_list.py --list

    # Build a shopping list at the recipes' original serving counts:
    python shopping_list.py Fajitas mexican-rice

    # Scale every recipe to 6 servings each:
    python shopping_list.py Fajitas mexican-rice --servings 6

    # Override servings for one recipe only, others use --servings:
    python shopping_list.py Fajitas:8 mexican-rice "Dinner Rolls:12" --servings 6

Recipe names are matched loosely — case, dashes, spaces, and the `.md`
extension are all ignored. Use a relative path (`dinners/Fajitas.md`) when a
plain name is ambiguous.
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Optional


# ---------------------------------------------------------------------------
# Number parsing — handles unicode fractions, plain fractions, and ranges.
# ---------------------------------------------------------------------------

UNICODE_FRACTIONS: dict[str, float] = {
    "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75,
    "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8,
    "⅙": 1 / 6, "⅚": 5 / 6, "⅛": 0.125, "⅜": 0.375,
    "⅝": 0.625, "⅞": 0.875,
}
FRAC_CHARS = "".join(UNICODE_FRACTIONS.keys())

# Any of these dashes can appear in a range like "4–5 cups".
DASH_CLASS = "[-–—−]"

# Character class matching one "token" of a quantity: digits, decimal point,
# slash (for "1/2"), or one of the unicode fraction glyphs.
NUM_TOKEN = rf"[\d./{FRAC_CHARS}]"


def parse_single_number(text: str) -> Optional[float]:
    """Parse one number token: '1', '1.5', '½', '1½', '3/4', '1 1/2'."""
    s = text.strip()
    if not s:
        return None

    # Mixed digit + unicode fraction, e.g. "1½" or "1 ½"
    m = re.fullmatch(rf"(\d+)\s*([{FRAC_CHARS}])", s)
    if m:
        return int(m.group(1)) + UNICODE_FRACTIONS[m.group(2)]

    # Lone unicode fraction
    if s in UNICODE_FRACTIONS:
        return UNICODE_FRACTIONS[s]

    # "1 1/2" (mixed with plain fraction)
    m = re.fullmatch(r"(\d+)\s+(\d+)\s*/\s*(\d+)", s)
    if m:
        return int(m.group(1)) + int(m.group(2)) / int(m.group(3))

    # "3/4"
    m = re.fullmatch(r"(\d+)\s*/\s*(\d+)", s)
    if m:
        return int(m.group(1)) / int(m.group(2))

    # Plain int or decimal
    try:
        return float(s)
    except ValueError:
        return None


def parse_quantity(text: str) -> Optional[float]:
    """Parse a quantity which may be a range. Ranges use the midpoint.

    Examples: '4', '½', '1½', '4-5', '3½–4', '480–600'.
    """
    if not text:
        return None
    # Try as a range first.
    m = re.fullmatch(
        rf"\s*({NUM_TOKEN}+(?:\s+{NUM_TOKEN}+)?)\s*{DASH_CLASS}\s*"
        rf"({NUM_TOKEN}+(?:\s+{NUM_TOKEN}+)?)\s*",
        text,
    )
    if m:
        lo = parse_single_number(m.group(1))
        hi = parse_single_number(m.group(2))
        if lo is not None and hi is not None:
            return (lo + hi) / 2
    return parse_single_number(text.strip())


# ---------------------------------------------------------------------------
# Unit normalisation,  only real measurement units. Words like "clove" or
# "head" are *not* units; they're descriptive nouns and should stay in the
# ingredient name so consolidation matches them.
# ---------------------------------------------------------------------------

UNIT_ALIASES: dict[str, str] = {
    # Volume
    "tsp": "tsp", "teaspoon": "tsp", "teaspoons": "tsp",
    "tbsp": "tbsp", "tablespoon": "tbsp", "tablespoons": "tbsp",
    "cup": "cup", "cups": "cup",
    "ml": "mL", "millilitre": "mL", "millilitres": "mL",
    "milliliter": "mL", "milliliters": "mL",
    "l": "L", "litre": "L", "litres": "L", "liter": "L", "liters": "L",
    "pint": "pint", "pints": "pint",
    "quart": "quart", "quarts": "quart",
    "gallon": "gallon", "gallons": "gallon",
    # Weight
    "g": "g", "gram": "g", "grams": "g",
    "kg": "kg", "kilogram": "kg", "kilograms": "kg",
    "oz": "oz", "ounce": "oz", "ounces": "oz",
    "lb": "lb", "lbs": "lb", "pound": "lb", "pounds": "lb",
}
# Longest-first so "tablespoons" matches before "tbsp".
_UNIT_PATTERN_BODY = "|".join(
    re.escape(u) for u in sorted(UNIT_ALIASES, key=len, reverse=True)
)
UNIT_PATTERN = rf"(?:{_UNIT_PATTERN_BODY})\.?"


# Descriptors stripped from the *normalised matching key* so that
# "thinly sliced bell pepper" matches "bell pepper". Casing-insensitive.
DESCRIPTORS = (
    "finely chopped", "finely minced", "roughly chopped", "thinly sliced",
    "freshly ground", "freshly grated", "freshly squeezed",
    "chopped", "minced", "grated", "sliced", "diced", "softened",
    "melted", "softened", "warm", "warmed", "cold", "chilled", "hot",
    "room temperature", "room-temperature",
    "fresh", "dried", "whole", "halved", "quartered",
    "crushed", "shredded", "ground", "uncooked", "raw",
    "large", "small", "medium", "extra-large", "extra large",
    "boneless", "skinless", "thin", "thick",
    "to taste", "as needed", "optional",
    "for greasing", "for dusting", "for brushing",
    "for serving", "for garnish",
)


def normalise_name(name: str) -> str:
    """Aggressive normalisation used as a grouping key — never shown to user."""
    n = name.lower()
    # Strip any leftover parenthetical noise.
    n = re.sub(r"\([^)]*\)", " ", n)
    # Drop descriptor words/phrases (longest first to handle multi-word).
    for d in sorted(DESCRIPTORS, key=len, reverse=True):
        n = re.sub(rf"\b{re.escape(d)}\b", " ", n)
    # Collapse punctuation and whitespace.
    n = re.sub(r"[,;:*]", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    # Drop trailing connectives that may be left over.
    n = re.sub(r"\b(?:and|or|the|a|an|of|with)\b", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    # Crude singularise: trailing 's' on each word (but not 'ss').
    n = " ".join(_singularise(w) for w in n.split())
    # Sort words so "garlic cloves" matches "cloves garlic".
    return " ".join(sorted(n.split()))


def _singularise(word: str) -> str:
    if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
        # Handle "berries" → "berry", "tomatoes" → "tomato".
        if word.endswith("ies"):
            return word[:-3] + "y"
        if word.endswith("oes"):
            return word[:-2]
        return word[:-1]
    return word


# ---------------------------------------------------------------------------
# Ingredient parsing.
# ---------------------------------------------------------------------------

@dataclass
class Ingredient:
    raw: str                          # Original markdown line
    display_name: str                 # Pretty name preserved as written
    match_key: str                    # Normalised key for consolidation
    qty: Optional[float]              # Numeric quantity (scaled)
    unit: Optional[str]               # Canonical unit ("tbsp", "g", …) or None
    grams: Optional[float]            # Scaled gram weight from "(≈Ng)" annotation
    millilitres: Optional[float]      # Scaled mL weight from "(≈N mL)" annotation
    source: str                       # Recipe title this came from
    notes: str = ""                   # Trailing descriptors after the first comma


# A post-comma fragment is treated as a descriptor (and stripped off the name)
# only when its first word looks like a prep instruction, qualifier, or
# substitution note. Otherwise the comma is part of a compound name (e.g.
# "boneless, skinless chicken breasts") and we keep the whole thing together.
DESCRIPTOR_FIRST_WORDS: frozenset[str] = frozenset({
    # Prep instructions (most also caught by the -ed/-ing heuristic below)
    "chopped", "minced", "grated", "sliced", "diced", "cut", "cubed",
    "crushed", "shredded", "ground", "drained", "softened", "melted",
    "halved", "quartered", "peeled", "beaten", "whisked", "whipped",
    "toasted", "roasted", "rinsed", "trimmed", "stemmed", "pitted",
    "zested", "juiced", "seeded", "deveined", "scored",
    # Qualifiers / substitutions
    "to", "as", "for", "from", "or", "plus", "about", "approximately",
    "approx", "roughly", "around", "optional", "divided", "preferably",
    # Temperature & state
    "room", "warm", "cold", "hot", "chilled", "frozen", "fresh", "dried",
    "whole", "halved", "quartered",
    # Manner adverbs (usually followed by a participle)
    "thinly", "finely", "coarsely", "freshly", "well",
    # Numeric / brand notes ("110°F / 43°C", "about 2 inches")
})


def _looks_like_descriptor(phrase: str) -> bool:
    """True when the comma-separated tail is clearly a prep or qualifier
    note, e.g. 'finely minced' or 'to taste'. False when it's a continuation
    of the ingredient name like 'skinless chicken breasts'."""
    phrase = phrase.strip().lower()
    if not phrase:
        return False
    first = phrase.split(None, 1)[0].rstrip(".,;:")
    if first in DESCRIPTOR_FIRST_WORDS:
        return True
    # -ed or -ing participles (sliced, drained, simmering, …).
    if len(first) > 3 and first.endswith("ed"):
        return True
    if len(first) > 4 and first.endswith("ing"):
        return True
    # Numeric specs or temperatures (110°F, 1-inch pieces, etc.).
    if first[0].isdigit() or "°" in first:
        return True
    return False


# Match (≈Ng) / (~Ng) / (about N grams) annotations inside parentheses.
GRAM_PAREN_RE = re.compile(
    rf"\(\s*(?:[≈~]|about|approx\.?|approximately)?\s*"
    rf"({NUM_TOKEN}+(?:\s+{NUM_TOKEN}+)?(?:\s*{DASH_CLASS}\s*"
    rf"{NUM_TOKEN}+(?:\s+{NUM_TOKEN}+)?)?)"
    rf"\s*g(?:rams?)?\b[^)]*\)",
    re.IGNORECASE,
)
ML_PAREN_RE = re.compile(
    rf"\(\s*(?:[≈~]|about|approx\.?|approximately)?\s*"
    rf"({NUM_TOKEN}+(?:\s+{NUM_TOKEN}+)?(?:\s*{DASH_CLASS}\s*"
    rf"{NUM_TOKEN}+(?:\s+{NUM_TOKEN}+)?)?)"
    rf"\s*(?:ml|mL|millilitres?|milliliters?)\b[^)]*\)",
    re.IGNORECASE,
)

# Leading quantity on the cleaned ingredient text. Supports plain numbers,
# unicode fractions, mixed forms ("1½", "1 1/2"), and ranges ("4-5", "3½–4").
LEADING_QTY_RE = re.compile(
    rf"^\s*"
    rf"(?P<qty>"
    rf"{NUM_TOKEN}+(?:\s+\d+/\d+)?"                    # 1 or 1.5 or 1 1/2 or ½
    rf"(?:\s*{DASH_CLASS}\s*{NUM_TOKEN}+(?:\s+\d+/\d+)?)?"  # optional - range
    rf")"
    rf"(?=\s|$)",
)
LEADING_UNIT_RE = re.compile(rf"^\s*(?P<unit>{UNIT_PATTERN})(?=\s|$|,)", re.IGNORECASE)


def parse_ingredient_line(line: str, source: str) -> Optional[Ingredient]:
    """Parse a single bulleted ingredient line. Returns None if line is empty
    or doesn't look like an ingredient at all."""
    # Real bullets are followed by whitespace. This avoids treating an
    # emphasis label like "**For the dry cure:**" as a list item.
    bullet_m = re.match(r"^\s*[*\-+]\s+", line)
    if not bullet_m:
        return None
    text = line[bullet_m.end():].strip()
    if not text:
        return None
    # Strip inline markdown emphasis (*italic*, **bold**, _italic_) so the
    # display name doesn't end up with stray asterisks or underscores.
    text = re.sub(r"\*{1,3}([^*]+)\*{1,3}", r"\1", text)
    text = re.sub(r"_{1,2}([^_]+)_{1,2}", r"\1", text)
    text = text.strip()
    if not text:
        return None
    # Skip stray emphasis / non-list lines that somehow leaked in.
    if text.startswith("**") and text.endswith("**"):
        return None

    # Extract conversion annotations BEFORE stripping parens.
    grams = None
    m = GRAM_PAREN_RE.search(text)
    if m:
        grams = parse_quantity(m.group(1))

    millilitres = None
    m = ML_PAREN_RE.search(text)
    if m:
        millilitres = parse_quantity(m.group(1))

    # Now strip parenthetical asides for the name extraction.
    cleaned = re.sub(r"\([^)]*\)", "", text).strip()
    # Tidy stray whitespace left where parens were removed (e.g. "foo , bar").
    cleaned = re.sub(r"\s+([,;:])", r"\1", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    # Split off the descriptor tail at the FIRST comma whose tail looks like
    # a prep/qualifier note. This keeps compound names like
    # "boneless, skinless chicken breasts" intact, while still recognising
    # the "...breasts, cut into cutlets" comma later in the line.
    head = cleaned
    notes = ""
    pos = 0
    while True:
        idx = cleaned.find(",", pos)
        if idx < 0:
            break
        candidate_tail = cleaned[idx + 1:].lstrip()
        if _looks_like_descriptor(candidate_tail):
            head = cleaned[:idx].strip()
            notes = candidate_tail.strip()
            break
        pos = idx + 1

    # Pull leading quantity off `head`.
    qty: Optional[float] = None
    qty_m = LEADING_QTY_RE.match(head)
    rest = head
    if qty_m:
        qty = parse_quantity(qty_m.group("qty"))
        rest = head[qty_m.end():].lstrip()

    # Pull leading unit off whatever's left.
    unit: Optional[str] = None
    unit_m = LEADING_UNIT_RE.match(rest)
    if unit_m:
        raw_unit = unit_m.group("unit").rstrip(".").lower()
        unit = UNIT_ALIASES.get(raw_unit, raw_unit)
        rest = rest[unit_m.end():].lstrip()

    display_name = rest.strip(" ,")
    if not display_name:
        # The line was nothing but qty+unit ("1 tbsp ."). Skip it.
        return None

    return Ingredient(
        raw=line.rstrip(),
        display_name=display_name,
        match_key=normalise_name(display_name),
        qty=qty,
        unit=unit,
        grams=grams,
        millilitres=millilitres,
        source=source,
        notes=notes,
    )


# ---------------------------------------------------------------------------
# Recipe loading.
# ---------------------------------------------------------------------------

@dataclass
class Recipe:
    path: Path
    title: str
    servings: float
    ingredients: list[Ingredient] = field(default_factory=list)


SERVINGS_RE = re.compile(r"\*\*\s*Servings\s*:\s*\*\*\s*([^\n]+)", re.IGNORECASE)
TITLE_RE = re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)
INGREDIENTS_SECTION_RE = re.compile(
    r"^##\s+Ingredients\b[^\n]*\n(.*?)(?=^##\s|\Z)",
    re.MULTILINE | re.DOTALL | re.IGNORECASE,
)


def parse_servings(text: str) -> float:
    """Parse the value after `**Servings:**`. Falls back to 1 if unparseable."""
    # First numeric token (with optional range) at the start.
    m = re.match(
        rf"\s*({NUM_TOKEN}+(?:\s*{DASH_CLASS}\s*{NUM_TOKEN}+)?)",
        text,
    )
    if m:
        val = parse_quantity(m.group(1))
        if val and val > 0:
            return val
    return 1.0


def load_recipe(path: Path) -> Recipe:
    """Load and parse a recipe markdown file."""
    content = path.read_text(encoding="utf-8")

    title_m = TITLE_RE.search(content)
    title = title_m.group(1).strip() if title_m else path.stem

    servings_m = SERVINGS_RE.search(content)
    servings = parse_servings(servings_m.group(1)) if servings_m else 1.0

    ingredients: list[Ingredient] = []
    section_m = INGREDIENTS_SECTION_RE.search(content)
    if section_m:
        for line in section_m.group(1).splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            # Skip section sub-headers ("### Pasta Dough"), divider rules,
            # and bolded category labels ("**For the dry cure:**").
            if stripped.startswith("#"):
                continue
            if stripped.startswith("---"):
                continue
            if not re.match(r"^[*\-+]\s+", stripped):
                continue
            ing = parse_ingredient_line(line, source=title)
            if ing:
                ingredients.append(ing)

    return Recipe(path=path, title=title, servings=servings, ingredients=ingredients)


# ---------------------------------------------------------------------------
# Recipe discovery & CLI argument resolution.
# ---------------------------------------------------------------------------

def discover_recipes(repo: Path) -> list[Path]:
    """All recipe .md files in the repo, excluding README and hidden dirs."""
    out: list[Path] = []
    for md in repo.rglob("*.md"):
        if any(part.startswith(".") for part in md.parts):
            continue
        if md.name.lower() == "readme.md":
            continue
        out.append(md)
    return sorted(out)


def _slug(s: str) -> str:
    return re.sub(r"[\s_-]+", "-", s.lower()).strip("-")


def resolve_recipe(repo: Path, query: str, all_recipes: list[Path]) -> Path:
    """Resolve a user query to an actual file. Tries exact path, then slug
    match, then unique substring match."""
    # Strip an optional ".md" so users can pass either form.
    candidates = [repo / query, repo / (query + ".md")]
    for c in candidates:
        if c.is_file():
            return c

    target = _slug(query.removesuffix(".md"))

    exact = [p for p in all_recipes if _slug(p.stem) == target]
    if len(exact) == 1:
        return exact[0]
    if len(exact) > 1:
        names = ", ".join(str(p.relative_to(repo)) for p in exact)
        raise SystemExit(
            f"Recipe '{query}' is ambiguous between: {names}. "
            f"Use a relative path."
        )

    # Substring fallback (the query is contained in the slugged filename).
    subs = [p for p in all_recipes if target in _slug(p.stem)]
    if len(subs) == 1:
        return subs[0]
    if len(subs) > 1:
        names = ", ".join(str(p.relative_to(repo)) for p in subs)
        raise SystemExit(
            f"Recipe '{query}' matches multiple files: {names}. "
            f"Use a more specific name or a relative path."
        )

    raise SystemExit(
        f"Recipe '{query}' not found. Run with --list to see what's available."
    )


def split_serving_override(arg: str) -> tuple[str, Optional[float]]:
    """Split `'Fajitas:8'` into `('Fajitas', 8.0)`. Handles names without
    overrides too. The ':' splitter only triggers if the suffix parses as
    a number — so it doesn't break Windows-style paths."""
    if ":" in arg:
        head, _, tail = arg.rpartition(":")
        n = parse_quantity(tail)
        if n is not None and n > 0:
            return head, n
    return arg, None


# ---------------------------------------------------------------------------
# Quantity scaling & consolidation.
# ---------------------------------------------------------------------------

def scale_ingredient(ing: Ingredient, factor: float) -> Ingredient:
    """Return a copy of `ing` with all numeric fields multiplied by `factor`."""
    return Ingredient(
        raw=ing.raw,
        display_name=ing.display_name,
        match_key=ing.match_key,
        qty=ing.qty * factor if ing.qty is not None else None,
        unit=ing.unit,
        grams=ing.grams * factor if ing.grams is not None else None,
        millilitres=ing.millilitres * factor if ing.millilitres is not None else None,
        source=ing.source,
        notes=ing.notes,
    )


@dataclass
class ShoppingItem:
    match_key: str
    display_name: str
    by_unit: dict[Optional[str], float] = field(default_factory=dict)
    total_grams: float = 0.0
    grams_complete: bool = True       # True if every entry had a gram annotation
    total_ml: float = 0.0
    ml_complete: bool = True
    sources: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    unparseable: list[str] = field(default_factory=list)


def consolidate(scaled: Iterable[Ingredient]) -> list[ShoppingItem]:
    items: dict[str, ShoppingItem] = {}
    for ing in scaled:
        key = ing.match_key or ing.display_name.lower()
        item = items.get(key)
        if item is None:
            item = ShoppingItem(match_key=key, display_name=ing.display_name)
            items[key] = item

        if ing.qty is not None:
            item.by_unit[ing.unit] = item.by_unit.get(ing.unit, 0.0) + ing.qty
        else:
            item.unparseable.append(ing.raw.strip())

        if ing.grams is not None:
            item.total_grams += ing.grams
        else:
            item.grams_complete = False

        if ing.millilitres is not None:
            item.total_ml += ing.millilitres
        else:
            item.ml_complete = False

        if ing.source not in item.sources:
            item.sources.append(ing.source)
        if ing.notes and ing.notes not in item.notes:
            item.notes.append(ing.notes)

    # Stable order: items with a quantity first, then alphabetical by display.
    return sorted(
        items.values(),
        key=lambda x: (not (x.by_unit or x.total_grams), x.display_name.lower()),
    )


# ---------------------------------------------------------------------------
# Output formatting.
# ---------------------------------------------------------------------------

def _format_number(n: float) -> str:
    """Tidy float → string. Whole numbers print without decimals; otherwise
    round to a couple of decimal places and drop trailing zeros."""
    if abs(n - round(n)) < 1e-6:
        return str(int(round(n)))
    # Fractions of teaspoons matter; allow two decimals but trim zeros.
    return f"{n:.2f}".rstrip("0").rstrip(".")


def format_quantity(qty: float, unit: Optional[str]) -> str:
    qty_s = _format_number(qty)
    if unit is None:
        return qty_s
    # No space between number and 'g'/'kg'/'mL'/'L' (the metric convention).
    if unit in ("g", "kg", "mL", "L"):
        return f"{qty_s} {unit}"
    return f"{qty_s} {unit}"


def render_item(item: ShoppingItem) -> str:
    """Build a single shopping-list line for one consolidated item."""
    parts: list[str] = []
    # Per-unit subtotals.
    for unit in sorted(item.by_unit, key=lambda u: (u is None, u or "")):
        qty = item.by_unit[unit]
        parts.append(format_quantity(qty, unit))

    head: str
    if parts:
        head = " + ".join(parts) + " " + item.display_name
    else:
        # No parseable quantities at all (e.g. "salt and pepper, to taste").
        head = item.display_name

    # Append a metric total if we have one and it isn't redundant with the
    # main quantity already shown.
    extras: list[str] = []
    main_units = set(item.by_unit)
    if item.total_grams > 0 and main_units - {"g", "kg"}:
        # Only add a gram total when at least one non-gram unit is shown,
        # otherwise we'd just be repeating ourselves.
        approx = "" if item.grams_complete else "≥"
        extras.append(f"{approx}~{_format_number(item.total_grams)} g")
    elif item.total_grams > 0 and "g" not in item.by_unit and "kg" not in item.by_unit:
        approx = "" if item.grams_complete else "≥"
        extras.append(f"{approx}~{_format_number(item.total_grams)} g")

    if item.total_ml > 0 and main_units - {"mL", "L"}:
        approx = "" if item.ml_complete else "≥"
        extras.append(f"{approx}~{_format_number(item.total_ml)} mL")

    if extras:
        head += " (" + ", ".join(extras) + ")"

    if len(item.sources) > 1:
        head += f"  — {', '.join(item.sources)}"

    if item.notes:
        # Show distinct trailing descriptors so the user knows e.g. one recipe
        # needs the chicken "boneless, skinless" and another wants it "diced".
        head += f"  [{' / '.join(item.notes)}]"

    return head


# ---------------------------------------------------------------------------
# Main entry point.
# ---------------------------------------------------------------------------

def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Build a consolidated shopping list from recipes in this repo.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python shopping_list.py --list\n"
            "  python shopping_list.py Fajitas mexican-rice\n"
            "  python shopping_list.py Fajitas mexican-rice --servings 6\n"
            "  python shopping_list.py Fajitas:8 mexican-rice 'Dinner Rolls:12' -s 6\n"
        ),
    )
    parser.add_argument(
        "recipes",
        nargs="*",
        help="Recipe names or paths (relative to repo). Suffix with :N to "
             "override target servings for that recipe.",
    )
    parser.add_argument(
        "--servings", "-s",
        type=float,
        default=None,
        help="Target servings for every recipe (default: each recipe's own "
             "serving count, i.e. no scaling).",
    )
    parser.add_argument(
        "--list", "-l",
        action="store_true",
        help="List available recipes (folder/file) and exit.",
    )
    parser.add_argument(
        "--repo",
        type=Path,
        default=Path(__file__).resolve().parent,
        help="Path to the repo root (default: directory containing this script).",
    )

    args = parser.parse_args(argv)

    all_recipes = discover_recipes(args.repo)

    if args.list:
        if not all_recipes:
            print("No recipes found in", args.repo)
            return 1
        # Group by parent folder for a readable listing.
        by_folder: dict[str, list[Path]] = defaultdict(list)
        for p in all_recipes:
            by_folder[p.parent.name].append(p)
        for folder in sorted(by_folder):
            print(f"{folder}/")
            for p in sorted(by_folder[folder]):
                print(f"  {p.stem}")
        return 0

    if not args.recipes:
        parser.error("provide at least one recipe (or use --list)")

    # Resolve every argument: recipe path + (maybe) per-recipe serving override.
    scaled_all: list[Ingredient] = []
    plan: list[tuple[Recipe, float, float]] = []  # (recipe, target, factor)
    for arg in args.recipes:
        name, override = split_serving_override(arg)
        path = resolve_recipe(args.repo, name, all_recipes)
        recipe = load_recipe(path)
        target = override if override is not None else (args.servings or recipe.servings)
        factor = target / recipe.servings if recipe.servings else 1.0
        plan.append((recipe, target, factor))
        for ing in recipe.ingredients:
            scaled_all.append(scale_ingredient(ing, factor))

    # Header.
    print("=" * 64)
    print("SHOPPING LIST")
    print("=" * 64)
    for recipe, target, factor in plan:
        rel = recipe.path.relative_to(args.repo) if recipe.path.is_relative_to(args.repo) else recipe.path
        print(
            f"  • {recipe.title}  ({rel})"
            f"\n      original {_format_number(recipe.servings)} servings"
            f"  →  target {_format_number(target)} servings"
            f"  (×{_format_number(factor)})"
        )
    print()

    items = consolidate(scaled_all)
    if not items:
        print("(no ingredients parsed — something might be wrong)")
        return 1

    # Split items into "has quantity" and "no quantity" for tidier output.
    quantified = [i for i in items if i.by_unit or i.total_grams or i.total_ml]
    unquantified = [i for i in items if not (i.by_unit or i.total_grams or i.total_ml)]

    print(f"Ingredients ({len(items)} unique):")
    print("-" * 64)
    for item in quantified:
        print(f"  • {render_item(item)}")

    if unquantified:
        print()
        print("To-taste / as-needed:")
        for item in unquantified:
            sources = f"  — {', '.join(item.sources)}" if len(item.sources) > 1 else ""
            print(f"  • {item.display_name}{sources}")

    return 0


if __name__ == "__main__":
    sys.exit(main())