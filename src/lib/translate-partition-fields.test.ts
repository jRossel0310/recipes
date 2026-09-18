import { describe, it, expect } from 'vitest';
import { partitionFields } from '../../scripts/translate.mjs';

// Regression coverage for the frontmatter-only dinner bug: translatableFields
// always includes a `body` field, even when the English body is empty
// (bbq-night.md, baked-night.md, enchilada-night.md). With
// TranslationSchema's `text: z.string().min(1)`, sending that empty field to
// the model would force it to invent filler or fail the whole response,
// aborting the entire bulk translate run. partitionFields is what lets
// translate.mjs skip the model for those fields entirely.

describe('partitionFields', () => {
  it('separates a field set with one empty field: it is preserved, not sent', () => {
    const fields = [
      { key: 'title', text: 'BBQ Night' },
      { key: 'body', text: '' },
    ];
    const { toTranslate, empty } = partitionFields(fields);
    expect(toTranslate).toEqual([{ key: 'title', text: 'BBQ Night' }]);
    expect(empty).toEqual([{ key: 'body', text: '' }]);
  });

  it('treats whitespace-only text as empty too', () => {
    const fields = [{ key: 'body', text: '   \n  ' }];
    const { toTranslate, empty } = partitionFields(fields);
    expect(toTranslate).toEqual([]);
    expect(empty).toEqual(fields);
  });

  it('sends every field when none are empty (unchanged behavior)', () => {
    const fields = [
      { key: 'title', text: 'BBQ Night' },
      { key: 'body', text: '## Instructions\n\n1. Do it.' },
    ];
    const { toTranslate, empty } = partitionFields(fields);
    expect(toTranslate).toEqual(fields);
    expect(empty).toEqual([]);
  });

  it('sends nothing when every field is empty, so the caller can skip the API call entirely', () => {
    const fields = [
      { key: 'body', text: '' },
      { key: 'summary', text: '' },
    ];
    const { toTranslate, empty } = partitionFields(fields);
    expect(toTranslate).toEqual([]);
    expect(empty).toEqual(fields);
  });
});
