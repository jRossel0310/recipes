import { describe, it, expect } from 'vitest';
import { searchRecipes, type Searchable } from './search';

const items: Searchable[] = [
  { slug: 'proteins/fajitas', title: 'Chipotle Fajita Veggies', category: 'Proteins', tags: ['mexican', 'fajitas', 'sheet-pan'] },
  { slug: 'pasta-and-bakes/chicken-enchiladas', title: 'Chicken Enchiladas (Co-op Batch)', category: 'Pasta & mains', tags: ['mexican', 'enchiladas', 'chicken'] },
  { slug: 'sides/cilantro-lime-rice', title: 'Cilantro Lime Rice', category: 'Sides', tags: ['rice', 'mexican', 'side'] },
  { slug: 'breakfasts/browned-butter-buttermilk-waffles', title: 'Browned Butter Buttermilk Waffles', category: 'Breakfast', tags: ['breakfast', 'waffles', 'buttermilk'] },
];

describe('searchRecipes', () => {
  it('returns nothing for an empty or whitespace-only query', () => {
    expect(searchRecipes(items, '')).toEqual([]);
    expect(searchRecipes(items, '   ')).toEqual([]);
  });

  it('matches a whole word in the title', () => {
    expect(searchRecipes(items, 'waffles').map((r) => r.slug)).toEqual([
      'breakfasts/browned-butter-buttermilk-waffles',
    ]);
  });

  it('matches a plural query against a singular title word', () => {
    // Title says "Fajita", query says "fajitas" - this is the bug that motivated
    // pulling this logic into its own tested module.
    expect(searchRecipes(items, 'fajitas').map((r) => r.slug)).toEqual(['proteins/fajitas']);
  });

  it('matches a singular query against a plural title word', () => {
    expect(searchRecipes(items, 'enchilada').map((r) => r.slug)).toEqual([
      'pasta-and-bakes/chicken-enchiladas',
    ]);
  });

  it('matches partial words as you type', () => {
    expect(searchRecipes(items, 'waff').map((r) => r.slug)).toEqual([
      'breakfasts/browned-butter-buttermilk-waffles',
    ]);
  });

  it('matches against tags and category, not just the title', () => {
    expect(searchRecipes(items, 'mexican').map((r) => r.slug).sort()).toEqual(
      ['pasta-and-bakes/chicken-enchiladas', 'proteins/fajitas', 'sides/cilantro-lime-rice'].sort(),
    );
    expect(searchRecipes(items, 'breakfast').map((r) => r.slug)).toEqual([
      'breakfasts/browned-butter-buttermilk-waffles',
    ]);
  });

  it('requires every word in a multi-word query to match (AND, not OR)', () => {
    expect(searchRecipes(items, 'chicken enchiladas').map((r) => r.slug)).toEqual([
      'pasta-and-bakes/chicken-enchiladas',
    ]);
    expect(searchRecipes(items, 'chicken rice')).toEqual([]);
  });

  it('is case-insensitive', () => {
    expect(searchRecipes(items, 'WAFFLES').map((r) => r.slug)).toEqual([
      'breakfasts/browned-butter-buttermilk-waffles',
    ]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(searchRecipes(items, 'xyznotreal')).toEqual([]);
  });
});
