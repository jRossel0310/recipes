import { describe, it, expect } from 'vitest';
import { UI_STRINGS, t } from './ui-strings';

describe('ui-strings', () => {
  it('defines every key in both locales', () => {
    const en = Object.keys(UI_STRINGS.en).sort();
    const de = Object.keys(UI_STRINGS.de).sort();
    expect(de).toEqual(en);
  });

  it('returns the string for a locale', () => {
    expect(t('en', 'ingredients')).toBe('Ingredients');
    expect(t('de', 'ingredients')).toBe('Zutaten');
  });

  it('carries the exact machine-translation banner', () => {
    expect(t('de', 'bannerUnreviewed')).toBe('Maschinell übersetzt — Mengen auf Englisch prüfen');
  });
});
