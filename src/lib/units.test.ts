import { describe, it, expect } from 'vitest';
import { rollUp, formatBatchQuantity, formatBatchMetric } from './units';

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
});

describe('formatBatchQuantity', () => {
  it('formats a rolled-up volume with pluralized cups', () => {
    expect(formatBatchQuantity({ item: 'salt', qty: 112, unit: 'tsp' })).toBe('2⅓ cups');
  });
  it('uses tbsp when the value is below one cup (largest unit >= 1)', () => {
    expect(formatBatchQuantity({ item: 'salt', qty: 24, unit: 'tsp' })).toBe('8 tbsp');
  });
  it('keeps a single cup singular', () => {
    expect(formatBatchQuantity({ item: 'milk', qty: 1, unit: 'cup' })).toBe('1 cup');
  });
  it('formats weight rolled to kg', () => {
    expect(formatBatchQuantity({ item: 'chicken', qty: 27200, unit: 'g' })).toBe('27.2 kg');
  });
  it('formats a count with its unit word', () => {
    expect(formatBatchQuantity({ item: 'lemons', qty: 16, unit: 'lemons' })).toBe('16 lemons');
  });
  it('formats a unitless count', () => {
    expect(formatBatchQuantity({ item: 'eggs', qty: 6 })).toBe('6');
  });
  it('formats a range in a single rolled-up unit', () => {
    expect(formatBatchQuantity({ item: 'vinegar', qty: 240, qtyMax: 360, unit: 'ml' })).toBe('240–360 mL');
  });
  it('returns empty string when there is no qty', () => {
    expect(formatBatchQuantity({ item: 'salt', note: 'to taste' })).toBe('');
  });
});

describe('formatBatchMetric', () => {
  it('rolls a grams annotation up to kg', () => {
    expect(formatBatchMetric({ item: 'sauce', qty: 16, unit: 'cup', grams: 4320 })).toBe('≈4.3 kg');
  });
  it('rolls an ml annotation up to L', () => {
    expect(formatBatchMetric({ item: 'oil', qty: 2, unit: 'cup', ml: 2000 })).toBe('≈2 L');
  });
  it('returns empty string when there is no metric annotation', () => {
    expect(formatBatchMetric({ item: 'eggs', qty: 6 })).toBe('');
  });
});
