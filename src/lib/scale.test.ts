import { describe, it, expect } from 'vitest';
import { scaleFactor, scaleIngredient, formatNumber } from './scale';
import type { Ingredient } from './types';

describe('scaleFactor', () => {
  it('computes target / base', () => {
    expect(scaleFactor(4, 6)).toBeCloseTo(1.5);
    expect(scaleFactor(8, 4)).toBeCloseTo(0.5);
  });
});

describe('scaleIngredient', () => {
  it('multiplies qty, qtyMax, grams, ml', () => {
    const ing: Ingredient = { item: 'pasta', qty: 0.5, qtyMax: 1, unit: 'lb', grams: 226, ml: 100 };
    const out = scaleIngredient(ing, 2);
    expect(out.qty).toBeCloseTo(1);
    expect(out.qtyMax).toBeCloseTo(2);
    expect(out.grams).toBeCloseTo(452);
    expect(out.ml).toBeCloseTo(200);
    expect(out.unit).toBe('lb');
  });

  it('leaves ingredients without qty unchanged', () => {
    const ing: Ingredient = { item: 'salt', note: 'to taste' };
    expect(scaleIngredient(ing, 3)).toEqual(ing);
  });
});

describe('formatNumber', () => {
  it('snaps volume/count units to unicode fractions', () => {
    expect(formatNumber(0.75, 'cup')).toBe('¾');
    expect(formatNumber(1.5, 'cup')).toBe('1½');
    expect(formatNumber(1 / 3, 'cup')).toBe('⅓');
    expect(formatNumber(2, 'cup')).toBe('2');
    expect(formatNumber(0.125, 'tsp')).toBe('⅛');
  });

  it('treats unitless counts as fractions', () => {
    expect(formatNumber(1.5)).toBe('1½');
    expect(formatNumber(3)).toBe('3');
  });

  it('rounds grams and ml to whole numbers', () => {
    expect(formatNumber(338.9, 'g')).toBe('339');
    expect(formatNumber(120.4, 'ml')).toBe('120');
  });

  it('rounds kg, l, lb, oz to one decimal', () => {
    expect(formatNumber(1.5, 'l')).toBe('1.5');
    expect(formatNumber(1.25, 'lb')).toBe('1.3');
    expect(formatNumber(2.0, 'kg')).toBe('2');
  });
});
