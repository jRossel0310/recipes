import { describe, it, expect } from 'vitest';
import { extractInstructions, buildChecklistDish } from './dinner';
import type { RecipeData } from './types';

const BODY = `## Instructions

1. Preheat the oven to 425°F.
2. Press and cube the tofu.
3. Bake 25 minutes, then flip.

## Notes

* Some note that should be ignored.
`;

describe('extractInstructions', () => {
  it('extracts numbered steps, stripping the prefix', () => {
    expect(extractInstructions(BODY)).toEqual([
      'Preheat the oven to 425°F.',
      'Press and cube the tofu.',
      'Bake 25 minutes, then flip.',
    ]);
  });
  it('returns an empty array when there is no Instructions section', () => {
    expect(extractInstructions('## Notes\n\n* just a note')).toEqual([]);
  });

  it('extracts multi-digit step numbers', () => {
    const body = `## Instructions\n\n9. Step nine.\n10. Step ten.\n11. Step eleven.\n`;
    expect(extractInstructions(body)).toEqual(['Step nine.', 'Step ten.', 'Step eleven.']);
  });

  it('ignores numbered prose that does not start a line', () => {
    const body = `## Instructions\n\n1. Real step.\n\nSee reference 1. Not a step.\n`;
    expect(extractInstructions(body)).toEqual(['Real step.']);
  });
});

describe('buildChecklistDish', () => {
  const recipe: RecipeData = {
    title: 'Buffalo Tofu',
    servings: 6,
    ingredients: [
      { item: 'tofu', qty: 454, unit: 'g' },
      { item: 'salt', note: 'to taste' },
    ],
  };

  it('scales ingredients to the target servings and formats them', () => {
    const dish = buildChecklistDish(recipe, BODY, 84, ['Use 8–10 sheet pans']);
    expect(dish.name).toBe('Buffalo Tofu');
    expect(dish.servings).toBe(84);
    expect(dish.optional).toBe(false);
    // 454 g * (84/6) = 6356 g -> 6.4 kg
    expect(dish.ingredients[0].primary).toBe('6.4 kg');
    expect(dish.ingredients[0].item).toBe('tofu');
    // no-qty ingredient keeps an empty primary string
    expect(dish.ingredients[1].primary).toBe('');
    expect(dish.ingredients[1].note).toBe('to taste');
    expect(dish.steps).toHaveLength(3);
    expect(dish.notes).toEqual(['Use 8–10 sheet pans']);
  });

  it('defaults notes to an empty array', () => {
    const dish = buildChecklistDish(recipe, BODY, 6);
    expect(dish.notes).toEqual([]);
  });

  it('marks optional dinner dishes', () => {
    expect(buildChecklistDish(recipe, BODY, 6, [], true).optional).toBe(true);
  });
});
