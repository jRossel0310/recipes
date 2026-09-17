import { describe, it, expect } from 'vitest';
import { hasGermanRoute, localeOf, counterpartPath } from './locale-paths';

describe('localeOf', () => {
  it('detects the locale from the path', () => {
    expect(localeOf('/cloyne/bbq-night')).toBe('en');
    expect(localeOf('/de/cloyne/bbq-night')).toBe('de');
    expect(localeOf('/de')).toBe('de');
  });
});

describe('hasGermanRoute', () => {
  it('is true for translated sections', () => {
    expect(hasGermanRoute('/recipes/sides/chili-lime-corn')).toBe(true);
    expect(hasGermanRoute('/cloyne')).toBe(true);
    expect(hasGermanRoute('/cloyne/bbq-night')).toBe(true);
    expect(hasGermanRoute('/dinners/baked-night')).toBe(true);
  });

  it('is false for untranslated sections', () => {
    expect(hasGermanRoute('/')).toBe(false);
    expect(hasGermanRoute('/shopping-list')).toBe(false);
    expect(hasGermanRoute('/cloyne/bbq-night/nutrition')).toBe(false);
  });
});

describe('counterpartPath', () => {
  it('maps English to German', () => {
    expect(counterpartPath('/cloyne/bbq-night')).toBe('/de/cloyne/bbq-night');
    expect(counterpartPath('/recipes/sides/chili-lime-corn')).toBe('/de/recipes/sides/chili-lime-corn');
  });

  it('maps German back to English', () => {
    expect(counterpartPath('/de/cloyne/bbq-night')).toBe('/cloyne/bbq-night');
  });

  it('round-trips', () => {
    const en = '/dinners/baked-night';
    expect(counterpartPath(counterpartPath(en)!)).toBe(en);
  });

  it('tolerates a trailing slash', () => {
    expect(counterpartPath('/cloyne/bbq-night/')).toBe('/de/cloyne/bbq-night');
  });

  it('returns null where there is no German twin', () => {
    expect(counterpartPath('/shopping-list')).toBeNull();
    expect(counterpartPath('/')).toBeNull();
    expect(counterpartPath('/cloyne/bbq-night/nutrition')).toBeNull();
  });
});
