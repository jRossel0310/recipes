import type { Ingredient, RecipeData } from './types';
import { scaleFactor, scaleIngredient } from './scale';

export interface RecipeSelection {
  recipe: RecipeData;
  targetServings: number;
}

export interface ShoppingItem {
  item: string;
  unit?: string;
  qty?: number;
  grams?: number;
  ml?: number;
  sources: string[];
  notes: string[];
}

export interface ShoppingList {
  items: ShoppingItem[];
  toTaste: ShoppingItem[];
}

function normalize(item: string): string {
  return item.toLowerCase().trim();
}

function addSource(target: ShoppingItem, source: string, note?: string): void {
  if (!target.sources.includes(source)) target.sources.push(source);
  if (note && !target.notes.includes(note)) target.notes.push(note);
}

export function consolidate(selections: RecipeSelection[]): ShoppingList {
  const quantified = new Map<string, ShoppingItem>();
  const toTaste = new Map<string, ShoppingItem>();

  for (const { recipe, targetServings } of selections) {
    const factor = scaleFactor(recipe.servings, targetServings);
    for (const raw of recipe.ingredients) {
      const ing: Ingredient = scaleIngredient(raw, factor);

      if (ing.qty === undefined) {
        const key = normalize(ing.item);
        let entry = toTaste.get(key);
        if (!entry) {
          entry = { item: ing.item, sources: [], notes: [] };
          toTaste.set(key, entry);
        }
        addSource(entry, recipe.title, ing.note);
        continue;
      }

      const key = `${normalize(ing.item)}|${ing.unit ?? ''}`;
      let entry = quantified.get(key);
      if (!entry) {
        entry = { item: ing.item, unit: ing.unit, qty: 0, sources: [], notes: [] };
        quantified.set(key, entry);
      }
      entry.qty = (entry.qty ?? 0) + ing.qty;
      if (ing.grams !== undefined) entry.grams = (entry.grams ?? 0) + ing.grams;
      if (ing.ml !== undefined) entry.ml = (entry.ml ?? 0) + ing.ml;
      addSource(entry, recipe.title, ing.note);
    }
  }

  const byName = (a: ShoppingItem, b: ShoppingItem) => a.item.localeCompare(b.item);
  return {
    items: [...quantified.values()].sort(byName),
    toTaste: [...toTaste.values()].sort(byName),
  };
}
