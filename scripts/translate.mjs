// scripts/translate.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod/v4';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { translatableFields, fingerprint } from '../src/lib/translation.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FORCE = process.argv.includes('--force');
const client = new Anthropic();

const TranslationSchema = z.object({
  translations: z.array(z.object({ key: z.string(), text: z.string() })),
});

const SYSTEM = [
  'You translate co-op kitchen recipes from English into German.',
  '',
  'Rules:',
  '- Translate ONLY the text you are given. Never add, remove, or reorder entries.',
  '- Never translate, convert, or restate numbers, quantities, or units. If a string',
  '  contains a number or a unit (cups, lb, oz, tbsp, tsp, F), keep it exactly as written.',
  '- Keep US units and US equipment names. The cooks work in a Berkeley kitchen with US',
  '  suppliers - do NOT convert to metric and do NOT substitute German ingredients.',
  '- Preserve markdown structure exactly: heading levels, numbered lists, bullets, bold.',
  '- Translate the heading "Instructions" to "Zubereitung" and "Notes" to "Hinweise".',
  '- Return exactly one entry per input key, reusing the same key.',
].join('\n');

async function translateFields(fields) {
  const response = await client.messages.parse({
    model: 'claude-opus-5',
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify({ fields }, null, 2) }],
    output_config: { format: zodOutputFormat(TranslationSchema) },
  });
  if (response.stop_reason === 'refusal') {
    throw new Error(`Refused: ${response.stop_details?.explanation ?? 'unknown'}`);
  }
  const parsed = response.parsed_output;
  if (!parsed) throw new Error('Model returned no parsable output');
  const byKey = new Map(parsed.translations.map((entry) => [entry.key, entry.text]));
  for (const f of fields) {
    if (!byKey.has(f.key)) throw new Error(`Missing translation for key ${f.key}`);
  }
  return byKey;
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : full.endsWith('.md') ? [full] : [];
  });
}

async function translateRecipe(absPath) {
  const rel = path.relative(path.join(ROOT, 'src/content/recipes'), absPath);
  const outPath = path.join(ROOT, 'src/content/recipes-de', rel);
  const parsed = matter(fs.readFileSync(absPath, 'utf8'));
  const english = {
    title: parsed.data.title,
    ingredients: parsed.data.ingredients,
    body: parsed.content,
  };
  const hash = fingerprint(english);

  if (!FORCE && fs.existsSync(outPath)) {
    const existing = matter(fs.readFileSync(outPath, 'utf8'));
    if (existing.data.sourceHash === hash) return 'skipped';
  }

  const byKey = await translateFields(translatableFields(english));

  const ingredients = parsed.data.ingredients.map((ing, i) => {
    const out = { item: byKey.get(`ingredients.${i}.item`) };
    if (ing.note) out.note = byKey.get(`ingredients.${i}.note`);
    if (ing.group) out.group = byKey.get(`ingredients.${i}.group`);
    return out;
  });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    matter.stringify(byKey.get('body'), {
      title: byKey.get('title'),
      sourceHash: hash,
      reviewed: false,
      ingredients,
    }),
  );
  return 'written';
}

async function translateDinner(absPath) {
  const rel = path.relative(path.join(ROOT, 'src/content/dinners'), absPath);
  const outPath = path.join(ROOT, 'src/content/dinners-de', rel);
  const parsed = matter(fs.readFileSync(absPath, 'utf8'));

  // Dish notes are per-dish; flatten them in file order so keys stay stable.
  const notes = (parsed.data.dishes ?? []).flatMap((dish) => dish.notes ?? []);
  const english = {
    title: parsed.data.title,
    summary: parsed.data.summary,
    notes,
    body: parsed.content,
  };
  const hash = fingerprint(english);

  if (!FORCE && fs.existsSync(outPath)) {
    const existing = matter(fs.readFileSync(outPath, 'utf8'));
    if (existing.data.sourceHash === hash) return 'skipped';
  }

  const byKey = await translateFields(translatableFields(english));

  const frontmatter = { title: byKey.get('title'), sourceHash: hash, reviewed: false };
  if (parsed.data.summary) frontmatter.summary = byKey.get('summary');
  if (notes.length) frontmatter.notes = notes.map((_, i) => byKey.get(`notes.${i}`));

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, matter.stringify(byKey.get('body'), frontmatter));
  return 'written';
}

const targets = [
  ...walk(path.join(ROOT, 'src/content/recipes')).map((f) => ['recipe', f]),
  ...walk(path.join(ROOT, 'src/content/dinners')).map((f) => ['dinner', f]),
];
let written = 0;
let skipped = 0;
for (const [kind, file] of targets) {
  const result = kind === 'recipe' ? await translateRecipe(file) : await translateDinner(file);
  if (result === 'written') {
    written += 1;
    console.log(`translated ${path.relative(ROOT, file)}`);
  } else {
    skipped += 1;
  }
}
console.log(`\n${written} translated, ${skipped} already current.`);
console.log('All new files are reviewed: false - set reviewed: true after a German speaker checks them.');
