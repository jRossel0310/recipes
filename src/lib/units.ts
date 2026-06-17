import type { Ingredient } from './types';
import { formatNumber } from './scale';

// Each ladder is ascending [unit, factor-in-base-unit]. Volume is capped at `cup`
// (quart/gallon intentionally excluded — impractical for a co-op kitchen).
const LADDERS: Array<Array<[string, number]>> = [
  [['tsp', 1], ['tbsp', 3], ['cup', 48]], // volume (base: tsp)
  [['ml', 1], ['l', 1000]], // metric volume (base: mL)
  [['g', 1], ['kg', 1000]], // metric weight (base: g)
  [['oz', 1], ['lb', 16]], // imperial weight (base: oz)
];

// Common plural/long-form unit spellings normalized to the canonical units used in LADDERS.
const UNIT_ALIASES: Record<string, string> = {
  lbs: 'lb', pound: 'lb', pounds: 'lb',
  cups: 'cup',
  tbsps: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  tsps: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  gram: 'g', grams: 'g',
  kilogram: 'kg', kilograms: 'kg',
  ounce: 'oz', ounces: 'oz',
  milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  liter: 'l', liters: 'l', litre: 'l', litres: 'l',
};

function canonicalUnit(unit: string): string {
  return UNIT_ALIASES[unit] ?? unit;
}

function findLadder(unit: string): Array<[string, number]> | undefined {
  return LADDERS.find((ladder) => ladder.some(([u]) => u === unit));
}

function factorOf(ladder: Array<[string, number]>, unit: string): number {
  return ladder.find(([u]) => u === unit)![1];
}

export function rollUp(value: number, unit?: string): { value: number; unit?: string } {
  if (!unit) return { value, unit };
  const u = canonicalUnit(unit.toLowerCase());
  const ladder = findLadder(u);
  if (!ladder) return { value, unit }; // count/descriptive unit — leave as-is
  const base = value * factorOf(ladder, u);
  // Largest unit at which the converted value is >= 1 (ladder is ascending).
  let chosen = ladder[0];
  for (const entry of ladder) {
    if (base / entry[1] >= 1) chosen = entry;
  }
  return { value: base / chosen[1], unit: chosen[0] };
}

// Display spelling for canonical lowercase units.
function prettyUnit(unit: string | undefined, value: number): string | undefined {
  if (!unit) return unit;
  if (unit === 'ml') return 'mL';
  if (unit === 'l') return 'L';
  if (unit === 'cup' && value > 1) return 'cups';
  return unit;
}

function convert(value: number, fromUnit: string | undefined, toUnit: string | undefined): number {
  if (!fromUnit || !toUnit || fromUnit === toUnit) return value;
  const ladder = findLadder(canonicalUnit(fromUnit.toLowerCase()));
  if (!ladder || !ladder.some(([u]) => u === toUnit)) return value;
  return (value * factorOf(ladder, canonicalUnit(fromUnit.toLowerCase()))) / factorOf(ladder, toUnit);
}

export function formatBatchQuantity(ing: Ingredient): string {
  if (ing.qty === undefined) return '';
  const r = rollUp(ing.qty, ing.unit);
  const unit = r.unit;
  const loVal = r.value;
  const hiVal = ing.qtyMax === undefined ? undefined : convert(ing.qtyMax, ing.unit, unit);
  const lo = formatNumber(loVal, unit);
  const num = hiVal === undefined ? lo : `${lo}–${formatNumber(hiVal, unit)}`;
  // Pluralize based on the upper bound when it's a range.
  const display = prettyUnit(unit, hiVal ?? loVal);
  return display ? `${num} ${display}` : num;
}

export function formatBatchMetric(ing: Ingredient): string {
  const parts: string[] = [];
  if (ing.grams !== undefined) {
    const r = rollUp(ing.grams, 'g');
    parts.push(`≈${formatNumber(r.value, r.unit)} ${prettyUnit(r.unit, r.value)}`);
  }
  if (ing.ml !== undefined) {
    const r = rollUp(ing.ml, 'ml');
    parts.push(`≈${formatNumber(r.value, r.unit)} ${prettyUnit(r.unit, r.value)}`);
  }
  return parts.join(', ');
}
