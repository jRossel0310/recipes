import type { Ingredient } from './types';

export function scaleFactor(base: number, target: number): number {
  return base > 0 ? target / base : 1;
}

export function scaleIngredient(ing: Ingredient, factor: number): Ingredient {
  if (ing.qty === undefined) return ing;
  return {
    ...ing,
    qty: ing.qty * factor,
    qtyMax: ing.qtyMax === undefined ? undefined : ing.qtyMax * factor,
    grams: ing.grams === undefined ? undefined : ing.grams * factor,
    ml: ing.ml === undefined ? undefined : ing.ml * factor,
  };
}

// Units rendered with decimal rounding rather than kitchen fractions.
const WHOLE_UNITS = new Set(['g', 'ml', 'mg']);
const DECIMAL_UNITS = new Set(['kg', 'l', 'lb', 'oz']);

// Fraction value → unicode glyph. Includes eighths plus thirds.
const FRACTIONS: Array<[number, string]> = [
  [0, ''],
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [3 / 8, '⅜'],
  [1 / 2, '½'],
  [5 / 8, '⅝'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [7 / 8, '⅞'],
  [1, ''], // carries into the whole part
];

function trimDecimal(n: number): string {
  // One decimal place, trailing zeros removed: 2.0 -> "2", 1.25 -> "1.3".
  return parseFloat(n.toFixed(1)).toString();
}

function humanizeFraction(value: number): string {
  const whole = Math.floor(value);
  const frac = value - whole;
  let best = FRACTIONS[0];
  let bestDist = Infinity;
  for (const entry of FRACTIONS) {
    const dist = Math.abs(frac - entry[0]);
    if (dist < bestDist) {
      bestDist = dist;
      best = entry;
    }
  }
  let wholePart = whole;
  let glyph = best[1];
  if (best[0] === 1) {
    // Rounded up to the next whole number.
    wholePart += 1;
    glyph = '';
  }
  if (glyph === '') return String(wholePart);
  return wholePart === 0 ? glyph : `${wholePart}${glyph}`;
}

export function formatNumber(value: number, unit?: string): string {
  const u = unit?.toLowerCase();
  if (u && WHOLE_UNITS.has(u)) return String(Math.round(value));
  if (u && DECIMAL_UNITS.has(u)) return trimDecimal(value);
  return humanizeFraction(value);
}

export function formatQuantity(ing: Ingredient): string {
  if (ing.qty === undefined) return '';
  const lo = formatNumber(ing.qty, ing.unit);
  const num = ing.qtyMax === undefined ? lo : `${lo}–${formatNumber(ing.qtyMax, ing.unit)}`;
  if (!ing.unit) return num;
  const value = ing.qtyMax ?? ing.qty;
  const plurals: Record<string, string> = { cup: 'cups', can: 'cans', clove: 'cloves', scoop: 'scoops', pinch: 'pinches', head: 'heads' };
  const unit = value > 1 ? (plurals[ing.unit] ?? ing.unit) : ing.unit;
  const display = unit === 'ml' ? 'mL' : unit === 'l' ? 'L' : unit;
  return `${num} ${display}`;
}

export function formatMetric(ing: Ingredient): string {
  const parts: string[] = [];
  if (ing.grams !== undefined && !['g', 'kg'].includes(ing.unit?.toLowerCase() ?? '')) parts.push(`≈${formatNumber(ing.grams, 'g')} g`);
  if (ing.ml !== undefined && !['ml', 'l'].includes(ing.unit?.toLowerCase() ?? '')) parts.push(`≈${formatNumber(ing.ml, 'ml')} mL`);
  return parts.join(', ');
}
