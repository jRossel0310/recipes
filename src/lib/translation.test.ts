import { describe, it, expect } from 'vitest';
import { translatableFields, fingerprint, resolveTranslation } from './translation';

const english = {
  title: 'Chili-Lime Corn',
  body: '## Instructions\n\n1. Heat a large skillet.\n',
  ingredients: [
    { item: 'frozen corn kernels', qty: 1.5, unit: 'lb', grams: 680 },
    { item: 'butter', qty: 2, unit: 'tbsp', note: 'or vegan butter', group: 'Topping' },
  ],
};

describe('translatableFields', () => {
  it('extracts only text, never numbers or units', () => {
    const keys = translatableFields(english).map((f) => f.key);
    expect(keys).toContain('title');
    expect(keys).toContain('ingredients.0.item');
    expect(keys).toContain('ingredients.1.note');
    expect(keys).toContain('ingredients.1.group');
    expect(keys).toContain('body');
    expect(keys.some((k) => k.includes('qty'))).toBe(false);
    expect(keys.some((k) => k.includes('unit'))).toBe(false);
    expect(keys.some((k) => k.includes('grams'))).toBe(false);
  });
});

describe('fingerprint', () => {
  it('is stable for identical text', () => {
    expect(fingerprint(english)).toBe(fingerprint({ ...english }));
  });

  it('ignores changes to numeric fields', () => {
    const rescaled = {
      ...english,
      ingredients: [
        { item: 'frozen corn kernels', qty: 18, unit: 'lb', grams: 8165 },
        { item: 'butter', qty: 24, unit: 'tbsp', note: 'or vegan butter', group: 'Topping' },
      ],
    };
    expect(fingerprint(rescaled)).toBe(fingerprint(english));
  });

  it('changes when translatable text changes', () => {
    const edited = { ...english, title: 'Chili-Lime Corn with Cilantro' };
    expect(fingerprint(edited)).not.toBe(fingerprint(english));
  });
});

describe('resolveTranslation', () => {
  it('uses German with no banner when fresh and reviewed', () => {
    const german = { sourceHash: fingerprint(english), reviewed: true };
    expect(resolveTranslation({ english, german })).toEqual({ useGerman: true, banner: null });
  });

  it('uses German with a banner when fresh but unreviewed', () => {
    const german = { sourceHash: fingerprint(english), reviewed: false };
    expect(resolveTranslation({ english, german })).toEqual({ useGerman: true, banner: 'unreviewed' });
  });

  it('falls back to English when the hash no longer matches', () => {
    const german = { sourceHash: 'stale-hash', reviewed: true };
    expect(resolveTranslation({ english, german })).toEqual({ useGerman: false, banner: 'stale' });
  });

  it('falls back to English when there is no German file', () => {
    expect(resolveTranslation({ english })).toEqual({ useGerman: false, banner: 'missing' });
  });
});
