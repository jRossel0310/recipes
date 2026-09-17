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
