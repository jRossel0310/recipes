import { describe, it, expect } from 'vitest';
import { consolidate } from './consolidate';
import type { RecipeData } from './types';

const rice: RecipeData = {
  title: 'Mexican Rice',
  servings: 4,
  ingredients: [
    { item: 'garlic', qty: 2, unit: 'cloves' },
    { item: 'long-grain rice', qty: 1, unit: 'cup', grams: 185 },
    { item: 'salt', note: 'to taste' },
  ],
};

const beans: RecipeData = {
  title: 'Beans',
  servings: 4,
  ingredients: [
    { item: 'garlic', qty: 3, unit: 'cloves' },
    { item: 'salt', note: 'to taste' },
  ],
};

describe('consolidate', () => {
  it('merges same item + unit across recipes', () => {
    const list = consolidate([
      { recipe: rice, targetServings: 4 },
      { recipe: beans, targetServings: 4 },
    ]);
    const garlic = list.items.find((i) => i.item.toLowerCase() === 'garlic');
    expect(garlic?.qty).toBe(5);
    expect(garlic?.unit).toBe('cloves');
    expect(garlic?.sources.sort()).toEqual(['Beans', 'Mexican Rice']);
  });

  it('scales quantities to target servings before merging', () => {
    const list = consolidate([{ recipe: rice, targetServings: 8 }]);
    const r = list.items.find((i) => i.item.toLowerCase() === 'long-grain rice');
    expect(r?.qty).toBeCloseTo(2);
    expect(r?.grams).toBeCloseTo(370);
  });

  it('collects no-qty ingredients into toTaste, deduped', () => {
    const list = consolidate([
      { recipe: rice, targetServings: 4 },
      { recipe: beans, targetServings: 4 },
    ]);
    const salt = list.toTaste.find((i) => i.item.toLowerCase() === 'salt');
    expect(salt).toBeTruthy();
    expect(list.items.find((i) => i.item.toLowerCase() === 'salt')).toBeUndefined();
    expect(list.toTaste.filter((i) => i.item.toLowerCase() === 'salt')).toHaveLength(1);
  });

  it('keeps same item with different units separate', () => {
    const a: RecipeData = {
      title: 'A',
      servings: 1,
      ingredients: [{ item: 'milk', qty: 1, unit: 'cup' }],
    };
    const b: RecipeData = {
      title: 'B',
      servings: 1,
      ingredients: [{ item: 'milk', qty: 200, unit: 'ml' }],
    };
    const list = consolidate([
      { recipe: a, targetServings: 1 },
      { recipe: b, targetServings: 1 },
    ]);
    const milks = list.items.filter((i) => i.item.toLowerCase() === 'milk');
    expect(milks).toHaveLength(2);
  });

  it('rolls up grams only from sources that provide it', () => {
    const withGrams: RecipeData = {
      title: 'With Grams',
      servings: 1,
      ingredients: [{ item: 'flour', qty: 1, unit: 'cup', grams: 120 }],
    };
    const withoutGrams: RecipeData = {
      title: 'Without Grams',
      servings: 1,
      ingredients: [{ item: 'flour', qty: 1, unit: 'cup' }],
    };
    const list = consolidate([
      { recipe: withGrams, targetServings: 1 },
      { recipe: withoutGrams, targetServings: 1 },
    ]);
    const flour = list.items.find((i) => i.item.toLowerCase() === 'flour');
    expect(flour?.qty).toBe(2);
    expect(flour?.grams).toBe(120);
  });
});
