import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Every other test in this suite works against source content files or pure
// functions - none of them ever look at what Astro actually renders. That
// leaves a real gap: a regression that made every German page silently fall
// back to English (e.g. `resolveTranslation` always returning
// `useGerman: false`, or a routing bug that fed the English entry to a
// German route) would leave `npm test` fully green. This test closes that
// gap by reading the actual built HTML for a known-German page and asserting
// it contains real German text, not the English fallback.
//
// `npm test` runs `astro build` first via the `pretest` script in
// package.json, so `dist/` always reflects the current source when this
// test runs.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DIST_FILE = path.join(ROOT, 'dist/de/recipes/sides/chili-lime-corn/index.html');

describe('German build output', () => {
  it('renders real German text for a known-translated recipe, not the English fallback', () => {
    expect(
      fs.existsSync(DIST_FILE),
      `expected build output at ${path.relative(ROOT, DIST_FILE)} - did \`npm run build\` (or the pretest hook) run?`,
    ).toBe(true);

    const html = fs.readFileSync(DIST_FILE, 'utf8');
    expect(html).toContain('gefrorene Maiskörner');
  });
});
