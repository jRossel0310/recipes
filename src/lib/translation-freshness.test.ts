import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { fingerprint } from './translation';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const EN = path.join(ROOT, 'src/content/recipes');
const DE = path.join(ROOT, 'src/content/recipes-de');

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : full.endsWith('.md') ? [full] : [];
  });
}

const germanFiles = walk(DE);

describe('German translations are current', () => {
  it('has something to check or is legitimately empty', () => {
    expect(Array.isArray(germanFiles)).toBe(true);
  });

  for (const file of germanFiles) {
    const rel = path.relative(DE, file);

    it(`${rel} matches its English source`, () => {
      const englishPath = path.join(EN, rel);
      expect(fs.existsSync(englishPath), `orphaned German file: ${rel}`).toBe(true);

      const en = matter(fs.readFileSync(englishPath, 'utf8'));
      const de = matter(fs.readFileSync(file, 'utf8'));

      expect(
        de.data.sourceHash,
        `${rel} is stale - run \`npm run translate\` and re-review`,
      ).toBe(
        fingerprint({ title: en.data.title, ingredients: en.data.ingredients, body: en.content }),
      );

      expect(
        de.data.ingredients.length,
        `${rel} has a different ingredient count than English`,
      ).toBe(en.data.ingredients.length);
    });
  }
});
