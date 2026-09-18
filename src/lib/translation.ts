import { createHash } from 'node:crypto';
import type { Ingredient } from './types';

export type BannerKind = null | 'unreviewed' | 'stale' | 'missing';

export interface TranslatableSource {
  title: string;
  summary?: string;
  ingredients?: Ingredient[];
  notes?: string[];
  body: string;
}

export interface TranslatableField {
  key: string;
  text: string;
}

const FIELD_SEP = String.fromCharCode(0);
const RECORD_SEP = String.fromCharCode(1);

export function translatableFields(input: TranslatableSource): TranslatableField[] {
  const fields: TranslatableField[] = [{ key: 'title', text: input.title }];
  if (input.summary) fields.push({ key: 'summary', text: input.summary });
  (input.notes ?? []).forEach((note, i) => fields.push({ key: `notes.${i}`, text: note }));
  (input.ingredients ?? []).forEach((ing, i) => {
    fields.push({ key: `ingredients.${i}.item`, text: ing.item });
    if (ing.note) fields.push({ key: `ingredients.${i}.note`, text: ing.note });
    if (ing.group) fields.push({ key: `ingredients.${i}.group`, text: ing.group });
  });
  fields.push({ key: 'body', text: input.body });
  return fields;
}

export function fingerprint(input: TranslatableSource): string {
  const canonical = translatableFields(input)
    .map((f) => f.key + FIELD_SEP + f.text)
    .join(RECORD_SEP);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function resolveTranslation(args: {
  english: TranslatableSource;
  german?: { sourceHash: string; reviewed: boolean };
}): { useGerman: boolean; banner: BannerKind } {
  const { english, german } = args;
  if (!german) return { useGerman: false, banner: 'missing' };
  if (german.sourceHash !== fingerprint(english)) return { useGerman: false, banner: 'stale' };
  return { useGerman: true, banner: german.reviewed ? null : 'unreviewed' };
}

// Worst-first severity order. `unreviewed` is the only state that means "you
// are reading machine-translated German right now" - `stale` and `missing`
// both mean "you are reading English", which is safe even if a translation
// exists somewhere. A page that composes several translated pieces (a dinner
// page pulling in several dish recipes, say) must not let a dinner-level
// banner of `stale`/`missing`/`null` hide that one of its dishes is actually
// rendering unreviewed machine output.
const BANNER_SEVERITY: readonly BannerKind[] = ['unreviewed', 'stale', 'missing', null];

export function worstBanner(banners: BannerKind[]): BannerKind {
  let worst: BannerKind = null;
  let worstRank = BANNER_SEVERITY.indexOf(null);
  for (const banner of banners) {
    const rank = BANNER_SEVERITY.indexOf(banner);
    if (rank < worstRank) {
      worstRank = rank;
      worst = banner;
    }
  }
  return worst;
}

export interface GermanIngredientText {
  item: string;
  note?: string;
  group?: string;
}

/**
 * Overrides item/note/group on the English ingredient list with German text,
 * matched purely by array position. The `sourceHash` fingerprint only covers
 * the English file, so it cannot detect a German file whose ingredients were
 * reordered or had a line dropped - the array lengths (and, per position,
 * the pattern of which entries even have a note/group) always "match" the
 * hash regardless of German-side corruption.
 *
 * Two checks close the gap without needing a shared identifier between the
 * English and German entries (their `item` text is in different languages
 * and cannot be matched automatically):
 *
 * 1. Length: a dropped or added line changes the count. Always catchable.
 * 2. Note/group shape: German notes/groups are translations of the English
 *    ones at the same position, so English and German should agree on
 *    *whether* a note/group exists at each index, even though the text
 *    itself differs by language. A swap that moves a note to the wrong
 *    index is caught by this shape mismatch (this is what a two-item swap
 *    of the seed recipe trips, since only some of its ingredients carry a
 *    note).
 *
 * This is a best-effort structural check, not a semantic one: a swap
 * between two ingredients that both happen to have (or both lack) a
 * note/group at their positions is not detectable this way - there is no
 * language-independent signal left to catch it. That residual gap is why
 * the `unreviewed` banner exists: a human still has to check quantities
 * against English before flipping `reviewed: true`.
 */
/**
 * Reconstructs per-dish German notes from the flat array `translate.mjs`
 * writes to a German dinner file's `notes` frontmatter field.
 *
 * `translateDinner` flattens `(dishes ?? []).flatMap((dish) => dish.notes ?? [])`
 * - dishes in file order, each dish's notes in order - because the German
 * dinner schema has no `dishes` key of its own (the dish list and every
 * serving count live only in the English file). To render them back onto
 * the right dish, this walks the English `dishes` array in that same order
 * and slices off as many entries as each dish's English note count expects.
 *
 * Like `alignGermanIngredients`, this is a structural guard, not a semantic
 * one: if the flat German array's length doesn't match the total number of
 * English dish notes, there is no safe way to know which notes belong to
 * which dish, so this returns `null` rather than risk attaching a note to
 * the wrong dish - the caller should fall back to the English notes.
 */
export function alignGermanDishNotes(
  dishes: { notes?: string[] }[],
  germanNotes: string[],
): string[][] | null {
  const totalEnglish = dishes.reduce((sum, dish) => sum + (dish.notes?.length ?? 0), 0);
  if (totalEnglish !== germanNotes.length) return null;
  const result: string[][] = [];
  let index = 0;
  for (const dish of dishes) {
    const count = dish.notes?.length ?? 0;
    result.push(germanNotes.slice(index, index + count));
    index += count;
  }
  return result;
}

/**
 * Numbers embedded in translated prose (a dinner summary's "- serves ~96.",
 * a recipe body's "165°F" internal-temp check, oven temps and times
 * throughout instructions) are not covered by the ingredient-field
 * whitelist in `translatableFields` - the model is free to rewrite the
 * surrounding text, and nothing stops it from also rewriting a number
 * ("165°F" -> "156°F", or converting to "74°C"). This extracts the ordered
 * sequence of numeric *values* from a string so callers can verify a
 * translation didn't change or drop any of them.
 *
 * This compares values, not notation: `½`, `1/2`, `0.5`, and `0,5` are all
 * the same number, and a translator choosing a different notation for the
 * same quantity is not a number change. The English source recipes use
 * Unicode vulgar fractions (`½`, `1 ½`) and ASCII fractions (`1/2`) directly
 * in prose; nothing requires the model to preserve that exact notation, only
 * the value. Each step below normalizes one notation into plain digits, in
 * an order chosen so a later step never re-consumes what an earlier one
 * produced (in particular, a lone fraction character must be folded into
 * its preceding whole number *before* it is replaced by its decimal value,
 * or "1½" would turn into the bogus concatenation "10.5" instead of "1.5").
 */
const VULGAR_FRACTIONS: Record<string, number> = {
  '½': 1 / 2,
  '¼': 1 / 4,
  '¾': 3 / 4,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅛': 1 / 8,
  '⅜': 3 / 8,
  '⅝': 5 / 8,
  '⅞': 7 / 8,
};

const FRACTION_CHARS = Object.keys(VULGAR_FRACTIONS).join('');
// 1. Mixed Unicode fraction: "1½" / "1 ½" -> "1.5". Must run before (2).
const MIXED_UNICODE_FRACTION_RE = new RegExp(`(\\d+) ?([${FRACTION_CHARS}])`, 'g');
// 2. Standalone Unicode fraction -> its decimal value.
const UNICODE_FRACTION_RE = new RegExp(`[${FRACTION_CHARS}]`, 'g');
// 3. Mixed ASCII fraction: "1 1/2" -> "1.5". Must run before (4), or the
// plain-fraction pass would turn "1 1/2" into "1 0.5", leaving the leading
// "1" as a spurious extra token.
const MIXED_ASCII_FRACTION_RE = /(\d+) (\d+)\/(\d+)/g;
// 4. Plain ASCII fraction: "1/2" -> "0.5", "3/4" -> "0.75".
const PLAIN_ASCII_FRACTION_RE = /(\d+)\/(\d+)/g;
// 5. Thousands separators: strip the separator only in the unambiguous
// grouping pattern (1-3 digits, then one or more groups of separator plus
// exactly 3 digits, not touching another digit on either side) so "1.100"
// and "1,000" become "1100" and "1000", while a genuine decimal like "1.5"
// or "0,25" is left untouched.
//
// The leading digit group must be non-zero ([1-9], not \d): nobody writes a
// thousands-grouped number with a leading zero group ("0,125" never means
// "the number 0125"), so a leading zero unambiguously marks this as a
// decimal instead. This matters because steps 1-4 can themselves produce a
// decimal with exactly three fractional digits - an eighth-family fraction
// (⅛/⅜/⅝/⅞ -> "0.125"/"0.375"/"0.625"/"0.875") looks exactly like thousands
// notation to a naive \d{1,3}([.,]\d{3})+ pattern, and would otherwise get
// its separator stripped ("0.125" -> "0125" -> 125), silently creating a
// blind spot where a genuine value change (e.g. a translation reading "125"
// for what should still be "0.125") would compare equal instead of being
// caught. The [1-9] restriction closes that gap without a special case for
// fractions specifically, since it is really the same underlying rule:
// thousands grouping never has a leading zero.
const THOUSANDS_SEPARATOR_RE = /(?<!\d)[1-9]\d{0,2}(?:[.,]\d{3})+(?!\d)/g;
// 6. Remaining decimal comma -> period ("0,5" -> "0.5"). German uses `,` as
// its decimal separator; by this point any `,` still adjacent to digits on
// both sides is a decimal point, not a thousands grouping (those were
// already stripped in step 5).
const DECIMAL_COMMA_RE = /(\d),(\d)/g;
const NUMBER_RE = /\d+(?:\.\d+)?/g;

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function extractNumberTokens(text: string): number[] {
  let normalized = text;
  normalized = normalized.replace(
    MIXED_UNICODE_FRACTION_RE,
    (_match, whole: string, frac: string) => String(Number(whole) + VULGAR_FRACTIONS[frac]),
  );
  normalized = normalized.replace(UNICODE_FRACTION_RE, (frac) => String(VULGAR_FRACTIONS[frac]));
  normalized = normalized.replace(
    MIXED_ASCII_FRACTION_RE,
    (_match, whole: string, num: string, den: string) =>
      String(Number(whole) + Number(num) / Number(den)),
  );
  normalized = normalized.replace(
    PLAIN_ASCII_FRACTION_RE,
    (_match, num: string, den: string) => String(Number(num) / Number(den)),
  );
  normalized = normalized.replace(THOUSANDS_SEPARATOR_RE, (match) => match.replace(/[.,]/g, ''));
  normalized = normalized.replace(DECIMAL_COMMA_RE, '$1.$2');

  const matches = normalized.match(NUMBER_RE) ?? [];
  return matches.map((token) => round4(parseFloat(token)));
}

/**
 * True when `translated` contains exactly the same ordered sequence of
 * numeric values as `source` (see `extractNumberTokens`). Used to reject a
 * translated field before it is ever written to disk. Values are compared
 * after rounding to 4 decimal places, so e.g. `⅓` (0.3333...) and `1/3`
 * (also 0.3333...) compare equal regardless of which side wrote which
 * notation.
 */
export function numbersPreserved(source: string, translated: string): boolean {
  const sourceNumbers = extractNumberTokens(source);
  const translatedNumbers = extractNumberTokens(translated);
  if (sourceNumbers.length !== translatedNumbers.length) return false;
  return sourceNumbers.every((n, i) => n === translatedNumbers[i]);
}

export function alignGermanIngredients(
  english: Ingredient[],
  german: GermanIngredientText[],
): Ingredient[] | null {
  if (english.length !== german.length) return null;
  for (let i = 0; i < english.length; i++) {
    if (Boolean(english[i].note) !== Boolean(german[i].note)) return null;
    if (Boolean(english[i].group) !== Boolean(german[i].group)) return null;
  }
  return english.map((ing, i) => ({
    ...ing,
    item: german[i].item,
    note: german[i].note,
    group: german[i].group,
  }));
}
