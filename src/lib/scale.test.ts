import { describe, it, expect } from 'vitest';
import { scaleFactor, scaleIngredient, formatNumber, formatQuantity, formatMetric } from './scale';
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

describe('formatQuantity', () => {
  it('renders qty + unit', () => {
    expect(formatQuantity({ item: 'milk', qty: 0.75, unit: 'cup' })).toBe('¾ cup');
  });

  it('renders a range', () => {
    expect(formatQuantity({ item: 'chicken', qty: 6, qtyMax: 8 })).toBe('6–8');
  });

  it('renders a range with a unit', () => {
    expect(formatQuantity({ item: 'water', qty: 0.5, qtyMax: 1, unit: 'cup' })).toBe('½–1 cup');
  });

  it('renders a unitless count', () => {
    expect(formatQuantity({ item: 'eggs', qty: 2 })).toBe('2');
  });

  it('returns empty string when there is no qty', () => {
    expect(formatQuantity({ item: 'salt', note: 'to taste' })).toBe('');
  });

  it('renders grams with unit', () => {
    expect(formatQuantity({ item: 'flour', qty: 339, unit: 'g' })).toBe('339 g');
  });
});

describe('formatMetric', () => {
  it('formats a grams annotation', () => {
    expect(formatMetric({ item: 'pasta', qty: 0.75, unit: 'lb', grams: 339 })).toBe('≈339 g');
  });
  it('formats an ml annotation', () => {
    expect(formatMetric({ item: 'milk', qty: 0.75, unit: 'cup', ml: 180 })).toBe('≈180 mL');
  });
  it('formats both grams and ml', () => {
    expect(formatMetric({ item: 'x', qty: 1, grams: 100, ml: 50 })).toBe('≈100 g, ≈50 mL');
  });
  it('returns empty string when there is no metric annotation', () => {
    expect(formatMetric({ item: 'eggs', qty: 2 })).toBe('');
  });
});
