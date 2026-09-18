import { describe, it, expect } from 'vitest';
import {
  translatableFields,
  fingerprint,
  resolveTranslation,
  alignGermanIngredients,
  alignGermanDishNotes,
  worstBanner,
  extractNumberTokens,
  numbersPreserved,
} from './translation';

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

describe('alignGermanIngredients', () => {
  const englishIngredients = [
    { item: 'frozen corn kernels', qty: 1.5, unit: 'lb', grams: 680 },
    { item: 'butter', qty: 2, unit: 'tbsp', note: 'or vegan butter', group: 'Topping' },
  ];

  it('overrides item/note/group from German while keeping English quantities', () => {
    const german = [
      { item: 'gefrorene Maiskörner' },
      { item: 'Butter', note: 'oder vegane Butter', group: 'Belag' },
    ];
    expect(alignGermanIngredients(englishIngredients, german)).toEqual([
      { item: 'gefrorene Maiskörner', qty: 1.5, unit: 'lb', grams: 680 },
      { item: 'Butter', qty: 2, unit: 'tbsp', note: 'oder vegane Butter', group: 'Belag' },
    ]);
  });

  it('returns null when the German file is missing an ingredient (list shortened)', () => {
    const german = [{ item: 'gefrorene Maiskörner' }];
    expect(alignGermanIngredients(englishIngredients, german)).toBeNull();
  });

  it('returns null when the German file has an extra ingredient', () => {
    const german = [
      { item: 'gefrorene Maiskörner' },
      { item: 'Butter', note: 'oder vegane Butter', group: 'Belag' },
      { item: 'Limette' },
    ];
    expect(alignGermanIngredients(englishIngredients, german)).toBeNull();
  });

  it('returns null for a same-length swap when it moves a note/group to the wrong position', () => {
    // Swapping the first two German entries keeps the length the same, so a
    // length check alone would miss this (this is the exact reproduction from
    // the "misordered ingredients" bug report). English index 0 (corn) has no
    // note and index 1 (butter) does, so a swap creates a shape mismatch this
    // helper can detect even without understanding either language's text.
    const swapped = [
      { item: 'Butter', note: 'oder vegane Butter', group: 'Belag' },
      { item: 'gefrorene Maiskörner' },
    ];
    expect(alignGermanIngredients(englishIngredients, swapped)).toBeNull();
  });

  it('cannot detect a same-length swap when the note/group shape matches at both positions (documented limitation)', () => {
    // Two ingredients that both carry a note (or both lack one) are
    // indistinguishable by shape alone - there is no language-independent
    // signal left once length and note/group presence both check out. This
    // is a known, inherent limitation without a shared cross-language id;
    // it is why unreviewed translations still show a banner.
    const bothHaveNotes = [
      { item: 'frozen corn kernels', qty: 1.5, unit: 'lb', note: 'a' },
      { item: 'butter', qty: 2, unit: 'tbsp', note: 'b' },
    ];
    const swappedSameShape = [
      { item: 'Butter-Text', note: 'b-de' },
      { item: 'Mais-Text', note: 'a-de' },
    ];
    expect(alignGermanIngredients(bothHaveNotes, swappedSameShape)).not.toBeNull();
  });
});

describe('worstBanner', () => {
  it('returns null for an empty list', () => {
    expect(worstBanner([])).toBeNull();
  });

  it('returns null when every banner is null', () => {
    expect(worstBanner([null, null])).toBeNull();
  });

  it('prefers unreviewed over stale, missing, and null', () => {
    expect(worstBanner([null, 'missing', 'stale', 'unreviewed'])).toBe('unreviewed');
    expect(worstBanner(['stale', 'unreviewed'])).toBe('unreviewed');
    expect(worstBanner(['missing', 'unreviewed'])).toBe('unreviewed');
  });

  it('prefers stale over missing and null when no unreviewed is present', () => {
    expect(worstBanner([null, 'missing', 'stale'])).toBe('stale');
  });

  it('prefers missing over null when nothing worse is present', () => {
    expect(worstBanner([null, 'missing'])).toBe('missing');
  });

  it('is order-independent (worst wins regardless of position)', () => {
    expect(worstBanner(['unreviewed', 'missing', 'stale'])).toBe('unreviewed');
    expect(worstBanner(['missing', 'stale', 'unreviewed'])).toBe('unreviewed');
  });

  it('reflects the bug scenario: a missing dinner banner must not hide an unreviewed dish', () => {
    // The dinner file itself has no German translation ('missing'), but one
    // of its dishes is rendering unreviewed machine-translated German. The
    // page must show the unreviewed warning, not "not translated yet".
    expect(worstBanner(['missing', null, 'unreviewed', null])).toBe('unreviewed');
  });
});

describe('extractNumberTokens', () => {
  it('extracts an ordered sequence of digit runs', () => {
    expect(extractNumberTokens('Bake at 425°F for 25 minutes, serves ~96.')).toEqual([
      '425',
      '25',
      '96',
    ]);
  });

  it('normalizes comma and period decimal separators to the same token', () => {
    expect(extractNumberTokens('1,5 cups')).toEqual(['1.5']);
    expect(extractNumberTokens('1.5 cups')).toEqual(['1.5']);
  });

  it('returns an empty array when there are no numbers', () => {
    expect(extractNumberTokens('Heat a large skillet until very hot.')).toEqual([]);
  });
});

describe('numbersPreserved', () => {
  it('passes when the translation has identical numbers', () => {
    expect(numbersPreserved('Bake at 425°F for 25 minutes.', 'Bei 425°F 25 Minuten backen.')).toBe(
      true,
    );
  });

  it('passes when the only difference is the decimal separator', () => {
    expect(numbersPreserved('1.5 cups butter', '1,5 Tassen Butter')).toBe(true);
  });

  it('passes when there are no numbers in either string', () => {
    expect(numbersPreserved('Heat a large skillet.', 'Eine große Pfanne erhitzen.')).toBe(true);
  });

  it('fails when a number is changed', () => {
    expect(numbersPreserved('Cook chicken to 165°F.', 'Hähnchen auf 156°F garen.')).toBe(false);
  });

  it('fails when a number is dropped', () => {
    expect(numbersPreserved('Bake at 425°F for 25 minutes.', 'Backen bis fertig.')).toBe(false);
  });

  it('fails when a number is converted to a different unit/value (e.g. metric)', () => {
    expect(numbersPreserved('Cook to 165°F.', 'Auf 74°C garen.')).toBe(false);
  });
});

describe('alignGermanDishNotes', () => {
  it('distributes a flat German notes array back onto the right dishes by count', () => {
    const dishes = [
      { notes: ['keep warm', 'double for co-op size'] },
      { notes: ['spicy'] },
      { notes: [] },
    ];
    const german = ['warmhalten', 'für Koop-Größe verdoppeln', 'scharf'];
    expect(alignGermanDishNotes(dishes, german)).toEqual([
      ['warmhalten', 'für Koop-Größe verdoppeln'],
      ['scharf'],
      [],
    ]);
  });

  it('returns null when the flat German array is shorter than the total English note count', () => {
    const dishes = [{ notes: ['a', 'b'] }, { notes: ['c'] }];
    expect(alignGermanDishNotes(dishes, ['a-de', 'b-de'])).toBeNull();
  });

  it('returns null when the flat German array is longer than the total English note count', () => {
    const dishes = [{ notes: ['a'] }];
    expect(alignGermanDishNotes(dishes, ['a-de', 'extra'])).toBeNull();
  });

  it('handles dinners with no notes at all', () => {
    const dishes = [{ notes: [] }, {}, { notes: undefined }];
    expect(alignGermanDishNotes(dishes, [])).toEqual([[], [], []]);
  });

  it('distributes correctly when only some dishes have notes', () => {
    const dishes = [{}, { notes: ['only this dish has a note'] }, {}];
    expect(alignGermanDishNotes(dishes, ['nur dieses Gericht hat eine Notiz'])).toEqual([
      [],
      ['nur dieses Gericht hat eine Notiz'],
      [],
    ]);
  });
});
