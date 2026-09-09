import { describe, it, expect } from 'vitest';
import { rollUp, formatScaledQuantity, formatScaledMetric } from './units';

describe('rollUp', () => {
  it('rolls tsp up to cups at the cup ceiling', () => {
    const r = rollUp(112, 'tsp'); // 112/48 = 2.333 cups
    expect(r.unit).toBe('cup');
    expect(r.value).toBeCloseTo(112 / 48);
  });
  it('keeps small volumes in their unit', () => {
    expect(rollUp(2, 'tsp')).toEqual({ value: 2, unit: 'tsp' });
  });
  it('does not roll past cup', () => {
    const r = rollUp(16, 'cup'); // would be 1 gallon, but cup is the ceiling
    expect(r.unit).toBe('cup');
    expect(r.value).toBeCloseTo(16);
  });
  it('rolls grams up to kg', () => {
    const r = rollUp(27200, 'g');
    expect(r.unit).toBe('kg');
    expect(r.value).toBeCloseTo(27.2);
  });
  it('rolls oz up to lb', () => {
    expect(rollUp(32, 'oz')).toEqual({ value: 2, unit: 'lb' });
  });
  it('leaves count/descriptive units unchanged', () => {
    expect(rollUp(16, 'lemons')).toEqual({ value: 16, unit: 'lemons' });
    expect(rollUp(5, undefined)).toEqual({ value: 5, unit: undefined });
  });
  it('rolls to exactly 1 cup at the boundary', () => {
    const r = rollUp(48, 'tsp'); // 48 tsp = exactly 1 cup
    expect(r.unit).toBe('cup');
    expect(r.value).toBeCloseTo(1);
  });
  it('stays in the smallest unit when below all thresholds', () => {
    expect(rollUp(0.5, 'tsp')).toEqual({ value: 0.5, unit: 'tsp' });
  });
  it('normalizes plural/long-form units before rolling', () => {
    expect(rollUp(2, 'lbs')).toEqual({ value: 2, unit: 'lb' });
    const r = rollUp(48, 'tablespoons'); // 48 tbsp = 3 cups
    expect(r.unit).toBe('cup');
    expect(r.value).toBeCloseTo(3);
  });
  it('never rolls down below the original unit, even when the value is under 1', () => {
    // 0.5 cup is exactly 8 tbsp, but a recipe written in cups should stay in cups.
    expect(rollUp(0.5, 'cup')).toEqual({ value: 0.5, unit: 'cup' });
    expect(rollUp(0.25, 'cup')).toEqual({ value: 0.25, unit: 'cup' });
  });
  it('still rolls up from a non-floor unit when scaling pushes it past the next threshold', () => {
    const r = rollUp(2, 'tbsp'); // 2 tbsp = 6 tsp, but tbsp is the floor here - stays put
    expect(r).toEqual({ value: 2, unit: 'tbsp' });
    const scaledUp = rollUp(20, 'tbsp'); // 20 tbsp scaled up should still roll to cups
    expect(scaledUp.unit).toBe('cup');
    expect(scaledUp.value).toBeCloseTo(20 / 16);
  });
});

describe('formatScaledQuantity', () => {
  it('formats a rolled-up volume with pluralized cups', () => {
    expect(formatScaledQuantity({ item: 'salt', qty: 112, unit: 'tsp' })).toBe('2⅓ cups');
  });
  it('uses tbsp when the value is below one cup (largest unit >= 1)', () => {
    expect(formatScaledQuantity({ item: 'salt', qty: 24, unit: 'tsp' })).toBe('8 tbsp');
  });
  it('keeps a single cup singular', () => {
    expect(formatScaledQuantity({ item: 'milk', qty: 1, unit: 'cup' })).toBe('1 cup');
  });
  it('keeps a fractional cup in cups rather than rolling down to tbsp', () => {
    expect(formatScaledQuantity({ item: 'cornstarch', qty: 0.5, unit: 'cup' })).toBe('½ cup');
  });
  it('formats weight rolled to kg', () => {
    expect(formatScaledQuantity({ item: 'chicken', qty: 27200, unit: 'g' })).toBe('27.2 kg');
  });
  it('formats a count with its unit word', () => {
    expect(formatScaledQuantity({ item: 'lemons', qty: 16, unit: 'lemons' })).toBe('16 lemons');
  });
  it('pluralizes canonical count units', () => {
    expect(formatScaledQuantity({ item: 'garlic', qty: 3, unit: 'clove' })).toBe('3 cloves');
    expect(formatScaledQuantity({ item: 'beans', qty: 2, unit: 'can' })).toBe('2 cans');
  });
  it('formats a unitless count', () => {
    expect(formatScaledQuantity({ item: 'eggs', qty: 6 })).toBe('6');
  });
  it('formats a range in a single rolled-up unit', () => {
    expect(formatScaledQuantity({ item: 'vinegar', qty: 240, qtyMax: 360, unit: 'ml' })).toBe('240-360 mL');
  });
  it('returns empty string when there is no qty', () => {
    expect(formatScaledQuantity({ item: 'salt', note: 'to taste' })).toBe('');
  });
  it('rolls up an aliased volume unit', () => {
    expect(formatScaledQuantity({ item: 'flour', qty: 48, unit: 'tablespoons' })).toBe('3 cups');
  });
  it('normalizes a plural weight unit in a range', () => {
    expect(formatScaledQuantity({ item: 'cheese', qty: 14, qtyMax: 16, unit: 'lbs' })).toBe('14-16 lb');
  });
});

describe('formatScaledMetric', () => {
  it('rolls a grams annotation up to kg', () => {
    expect(formatScaledMetric({ item: 'sauce', qty: 16, unit: 'cup', grams: 4320 })).toBe('≈4.3 kg');
  });
  it('rolls an ml annotation up to L', () => {
    expect(formatScaledMetric({ item: 'oil', qty: 2, unit: 'cup', ml: 2000 })).toBe('≈2 L');
  });
  it('returns empty string when there is no metric annotation', () => {
    expect(formatScaledMetric({ item: 'eggs', qty: 6 })).toBe('');
  });
  it('joins grams and ml when both are present', () => {
    expect(formatScaledMetric({ item: 'x', qty: 1, grams: 4320, ml: 2000 })).toBe('≈4.3 kg, ≈2 L');
  });
  it('suppresses duplicate metric annotations', () => {
    expect(formatScaledMetric({ item: 'pasta', qty: 220, unit: 'g', grams: 220 })).toBe('');
    expect(formatScaledMetric({ item: 'milk', qty: 300, unit: 'ml', ml: 300 })).toBe('');
  });
});
