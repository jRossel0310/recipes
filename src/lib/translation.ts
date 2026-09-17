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
