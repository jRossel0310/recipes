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
