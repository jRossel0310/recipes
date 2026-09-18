import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

// Guards the invariant the whole German-recipe feature depends on: every
// recipes-de file must have exactly as many ingredients as its English
// counterpart, in the same relative path, so that overriding item/note/group
// by array index (see alignGermanIngredients in ./translation) never attaches
// a German label to the wrong English quantity. This test reads the raw
// content files directly (not through Astro's content collections) so it can
// run under plain vitest.

const RECIPES_DIR = path.join(__dirname, '../content/recipes');
const RECIPES_DE_DIR = path.join(__dirname, '../content/recipes-de');

function listMarkdownFiles(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listMarkdownFiles(full, base));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(path.relative(base, full));
    }
  }
  return out;
}

const germanFiles = listMarkdownFiles(RECIPES_DE_DIR);

describe('German recipe ingredient alignment', () => {
  it('found at least the seed translation to check (sanity check for this test itself)', () => {
    expect(germanFiles.length).toBeGreaterThan(0);
  });

  it.each(germanFiles)('%s has the same ingredient count as its English source', (relPath) => {
    const englishPath = path.join(RECIPES_DIR, relPath);
    expect(fs.existsSync(englishPath), `missing English counterpart for recipes-de/${relPath}`).toBe(true);

    const english = matter(fs.readFileSync(englishPath, 'utf8'));
    const german = matter(fs.readFileSync(path.join(RECIPES_DE_DIR, relPath), 'utf8'));

    const englishIngredients = (english.data.ingredients ?? []) as unknown[];
    const germanIngredients = (german.data.ingredients ?? []) as unknown[];

    expect(
      germanIngredients.length,
      `recipes-de/${relPath} has ${germanIngredients.length} ingredient(s) but recipes/${relPath} has ${englishIngredients.length}`,
    ).toBe(englishIngredients.length);
  });
});
