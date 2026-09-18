// scripts/translate.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod/v4';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { translatableFields, fingerprint, extractNumberTokens, numbersPreserved } from '../src/lib/translation.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FORCE = process.argv.includes('--force');
const client = new Anthropic();

const TranslationSchema = z.object({
  translations: z.array(z.object({ key: z.string(), text: z.string().min(1) })),
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
  if (response.stop_reason === 'max_tokens') {
    // A truncated-but-still-parseable response would otherwise write a
    // German file with a cut-off body and reviewed: false, indistinguishable
    // from a good translation until a human happens to read to the end.
    throw new Error('Response truncated: hit max_tokens before completing translation');
  }
  const parsed = response.parsed_output;
  if (!parsed) throw new Error('Model returned no parsable output');
  const byKey = new Map(parsed.translations.map((entry) => [entry.key, entry.text]));
  for (const f of fields) {
    if (!byKey.has(f.key)) throw new Error(`Missing translation for key ${f.key}`);
  }
  return byKey;
}

/**
 * Numeric fields (qty, unit, grams, ...) are already kept out of the
 * translation request by `translatableFields`, but three whitelisted *text*
 * fields routinely carry numbers embedded in prose: a dinner's `summary`
 * ("- serves ~96."), and recipe/dinner `body` text (internal-temp checks
 * like "165°F", oven temps, times). Nothing else verifies those survive
 * translation unchanged, so this checks every field before any file is
 * written and reports (without throwing) every field where the ordered
 * sequence of numbers in the translation doesn't match the English source.
 */
function findNumberMismatches(fields, byKey) {
  const mismatches = [];
  for (const field of fields) {
    const translated = byKey.get(field.key);
    if (!numbersPreserved(field.text, translated)) {
      mismatches.push({
        key: field.key,
        english: extractNumberTokens(field.text),
        german: extractNumberTokens(translated),
      });
    }
  }
  return mismatches;
}

function reportNumberMismatches(relPath, mismatches) {
  console.error(`FAILED ${relPath}: translated text changed or dropped a number`);
  for (const m of mismatches) {
    const english = m.english.map(String).join(', ');
    const german = m.german.map(String).join(', ');
    console.error(`  field "${m.key}": english=[${english}] german=[${german}]`);
  }
}

/**
 * `translatableFields` (src/lib/translation.ts) unconditionally includes a
 * `body` field, even for a dinner file whose body is completely empty -
 * `bbq-night.md`, `baked-night.md`, and `enchilada-night.md` are all
 * frontmatter-only as of this writing. That function must not change here:
 * removing the unconditional `body` push would change `fingerprint()`'s
 * hash and invalidate `sourceHash` on the one committed German file
 * (`src/content/recipes-de/sides/chili-lime-corn.md`), silently reverting
 * that page to English.
 *
 * Instead, this script never sends an empty field to the model at all. With
 * `TranslationSchema` requiring `text.min(1)`, an empty field would force
 * the model to either invent filler text or fail the whole response - and
 * since the loop at the bottom of this file has no per-file try/catch, one
 * failure would abort the entire bulk translate run. An empty English field
 * has nothing to translate, so it is carried straight through as an empty
 * string instead.
 */
function partitionFields(fields) {
  const toTranslate = [];
  const empty = [];
  for (const field of fields) {
    (field.text.trim() === '' ? empty : toTranslate).push(field);
  }
  return { toTranslate, empty };
}

/**
 * Translates only the non-empty fields, merging empty ones back in as `''`
 * without ever sending them to the model. Skips the API call entirely if
 * every field is empty. Returns `sentFields` alongside `byKey` so callers
 * (the completeness check inside `translateFields`, and
 * `findNumberMismatches`) only ever look at the fields that were actually
 * sent - a skipped empty field can't be reported as a missing key or a
 * number mismatch.
 */
async function translateFieldsAllowingEmpty(fields) {
  const { toTranslate, empty } = partitionFields(fields);
  const byKey = new Map(empty.map((f) => [f.key, '']));
  if (toTranslate.length > 0) {
    for (const [key, text] of await translateFields(toTranslate)) {
      byKey.set(key, text);
    }
  }
  return { byKey, sentFields: toTranslate };
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

  const fields = translatableFields(english);
  const { byKey, sentFields } = await translateFieldsAllowingEmpty(fields);

  const mismatches = findNumberMismatches(sentFields, byKey);
  if (mismatches.length) {
    reportNumberMismatches(rel, mismatches);
    return 'failed';
  }

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

  const fields = translatableFields(english);
  const { byKey, sentFields } = await translateFieldsAllowingEmpty(fields);

  const mismatches = findNumberMismatches(sentFields, byKey);
  if (mismatches.length) {
    reportNumberMismatches(rel, mismatches);
    return 'failed';
  }

  const frontmatter = { title: byKey.get('title'), sourceHash: hash, reviewed: false };
  if (parsed.data.summary) frontmatter.summary = byKey.get('summary');
  if (notes.length) frontmatter.notes = notes.map((_, i) => byKey.get(`notes.${i}`));

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, matter.stringify(byKey.get('body'), frontmatter));
  return 'written';
}

async function main() {
  const targets = [
    ...walk(path.join(ROOT, 'src/content/recipes')).map((f) => ['recipe', f]),
    ...walk(path.join(ROOT, 'src/content/dinners')).map((f) => ['dinner', f]),
  ];
  let written = 0;
  let skipped = 0;
  let failed = 0;
  for (const [kind, file] of targets) {
    const result = kind === 'recipe' ? await translateRecipe(file) : await translateDinner(file);
    if (result === 'written') {
      written += 1;
      console.log(`translated ${path.relative(ROOT, file)}`);
    } else if (result === 'failed') {
      failed += 1;
    } else {
      skipped += 1;
    }
  }
  console.log(`\n${written} translated, ${skipped} already current, ${failed} failed.`);
  console.log('All new files are reviewed: false - set reviewed: true after a German speaker checks them.');
  if (failed > 0) {
    console.error(`${failed} file(s) failed number-preservation checks and were not written - see FAILED lines above.`);
    process.exitCode = 1;
  }
}

// Only run the bulk translate pipeline (which makes real API calls) when
// this file is executed directly (`npm run translate`) - not when it's
// imported, e.g. by a unit test importing `partitionFields` below.
const isMain = process.argv[1] ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) {
  await main();
}

export { partitionFields };
