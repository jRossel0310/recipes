import type { RecipeData } from './types';
import { scaleFactor, scaleIngredient } from './scale';
import { formatScaledQuantity, formatScaledMetric } from './units';

// English bodies use "## Instructions"; German bodies use "## Zubereitung"
// (the same string as t('de', 'instructions')). Both must be recognized so a
// translated dish keeps its cooking steps.
const INSTRUCTIONS_HEADING = /^##\s+(?:Instructions|Zubereitung)\s*$/m;

export function extractInstructions(body: string): string[] {
  const start = body.search(INSTRUCTIONS_HEADING);
  if (start === -1) return [];
  let rest = body.slice(start).replace(INSTRUCTIONS_HEADING, '');
  const next = rest.search(/^##\s/m);
  if (next !== -1) rest = rest.slice(0, next);
  const steps: string[] = [];
  for (const line of rest.split('\n')) {
    const m = line.match(/^\s*\d+\.\s+(.*\S)\s*$/);
    if (m) steps.push(m[1]);
  }
  return steps;
}

/**
 * True when the English and German bodies of the same dish yield the same
 * number of instruction steps. The heading regex above only recognizes
 * "Instructions" and "Zubereitung" - if a translation instead writes a
 * variant like "Anleitung" or "Zubereitungsschritte", `extractInstructions`
 * finds no heading and returns zero steps, silently dropping the entire
 * method while the ingredient list still renders fine. This is an outcome
 * check (not an attempt to match every possible heading spelling): callers
 * should fall back to the English dish when this returns false.
 */
export function stepCountMatches(englishBody: string, germanBody: string): boolean {
  return extractInstructions(englishBody).length === extractInstructions(germanBody).length;
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
  optional: boolean;
  ingredients: DishIngredient[];
  steps: string[];
  notes: string[];
}

export function buildChecklistDish(
  recipe: RecipeData,
  body: string,
  targetServings: number,
  notes: string[] = [],
  optional = false,
): DishView {
  const factor = scaleFactor(recipe.servings, targetServings);
  const ingredients: DishIngredient[] = recipe.ingredients.map((ing) => {
    const s = scaleIngredient(ing, factor);
    return {
      primary: formatScaledQuantity(s),
      metric: formatScaledMetric(s),
      item: s.item,
      note: s.note,
      group: s.group,
      optional: s.optional,
    };
  });
  return { name: recipe.title, servings: targetServings, optional, ingredients, steps: extractInstructions(body), notes };
}
