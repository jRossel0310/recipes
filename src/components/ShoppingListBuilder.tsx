import { useMemo, useState } from 'react';
import type { RecipeData } from '../lib/types';
import { consolidate, type ShoppingItem } from '../lib/consolidate';
import { formatNumber } from '../lib/scale';
import './ShoppingListBuilder.css';

export interface RecipeChoice {
  slug: string;
  title: string;
  category: string;
  data: RecipeData;
}

export interface DinnerOption {
  slug: string;
  title: string;
  kind: string;
  dishes: { recipeSlug: string; servings: number }[];
}

interface Props { recipes: RecipeChoice[]; dinners?: DinnerOption[]; allRecipes?: RecipeChoice[] }

interface Selected { servings: number }

function itemLine(item: ShoppingItem): string {
  const parts: string[] = [];
  if (item.qty !== undefined) {
    const lo = formatNumber(item.qty, item.unit);
    const num = item.qtyMax !== undefined ? `${lo}-${formatNumber(item.qtyMax, item.unit)}` : lo;
    parts.push(item.unit ? `${num} ${item.unit}` : num);
  }
  let line = `${parts.join(' ')} ${item.item}`.trim();
  if (item.grams !== undefined && item.unit !== 'g') line += ` (~${Math.round(item.grams)} g)`;
  return line;
}

export default function ShoppingListBuilder({ recipes, dinners = [], allRecipes = recipes }: Props) {
  const [selected, setSelected] = useState<Record<string, Selected>>({});
  const [loadedDinner, setLoadedDinner] = useState('');
  const [pickerOpen, setPickerOpen] = useState(true);

  const byCategory = useMemo(() => {
    const m = new Map<string, RecipeChoice[]>();
    for (const r of recipes) {
      if (!m.has(r.category)) m.set(r.category, []);
      m.get(r.category)!.push(r);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [recipes]);

  const recipeBySlug = useMemo(() => new Map(allRecipes.map((r) => [r.slug, r])), [allRecipes]);

  const list = useMemo(() => {
    const sel: { recipe: RecipeData; targetServings: number }[] = [];
    for (const [slug, s] of Object.entries(selected)) {
      const r = recipeBySlug.get(slug);
      if (r) sel.push({ recipe: r.data, targetServings: s.servings });
    }
    return consolidate(sel);
  }, [recipeBySlug, selected]);

  function toggle(r: RecipeChoice) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[r.slug]) delete next[r.slug];
      else next[r.slug] = { servings: r.data.servings };
      return next;
    });
  }

  function setServings(slug: string, servings: number) {
    setSelected((prev) => ({ ...prev, [slug]: { servings: Math.max(1, servings) } }));
  }

  function loadDinner(slug: string) {
    setLoadedDinner(slug);
    if (!slug) return;
    const dinner = dinners.find((d) => d.slug === slug);
    if (!dinner) return;
    const next: Record<string, Selected> = {};
    for (const dish of dinner.dishes) next[dish.recipeSlug] = { servings: dish.servings };
    setSelected(next);
    setPickerOpen(false);
  }

  function clearAll() {
    setLoadedDinner('');
    setSelected({});
    setPickerOpen(true);
  }

  const text = useMemo(() => {
    const lines = list.items.map((i) => `- ${itemLine(i)}`);
    if (list.toTaste.length) {
      lines.push('', 'To taste / as needed:');
      lines.push(...list.toTaste.map((i) => `- ${i.item}`));
    }
    return lines.join('\n');
  }, [list]);

  const anySelected = Object.keys(selected).length > 0;

  return (
    <div className="slb">
      {dinners.length > 0 && (
        <div className="dinner-load">
          <label htmlFor="dinner-select">Load a dinner</label>
          <select id="dinner-select" value={loadedDinner} onChange={(e) => loadDinner(e.target.value)}>
            <option value="">Choose a dinner...</option>
            {dinners.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.title} ({d.dishes.length} {d.dishes.length === 1 ? 'dish' : 'dishes'})
              </option>
            ))}
          </select>
          {anySelected && (
            <button type="button" className="clear" onClick={clearAll}>
              Clear
            </button>
          )}
          <p className="hint">Pulls in every dish's ingredients at that dinner's servings, merging shared ingredients into one line. Adjust checkboxes and servings below as needed.</p>
        </div>
      )}

      <div className="pick">
        <div className="pick-header">
          <h2>Pick recipes</h2>
          <button type="button" className="pick-toggle" onClick={() => setPickerOpen((v) => !v)} aria-expanded={pickerOpen}>
            {pickerOpen ? 'Hide' : 'Edit'}
          </button>
        </div>
        {!pickerOpen && (
          <p className="pick-summary">
            {Object.keys(selected).length} {Object.keys(selected).length === 1 ? 'recipe' : 'recipes'} selected
          </p>
        )}
        {pickerOpen && byCategory.map(([cat, rs]) => (
          <div key={cat}>
            <h3 className="cat">{cat}</h3>
            {rs.map((r) => (
              <div className="row" key={r.slug}>
                <input
                  type="checkbox"
                  id={r.slug}
                  checked={!!selected[r.slug]}
                  onChange={() => toggle(r)}
                />
                <label htmlFor={r.slug}>{r.title}</label>
                {selected[r.slug] && (
                  <input
                    type="number"
                    min={1}
                    value={selected[r.slug].servings}
                    onChange={(e) => setServings(r.slug, Number(e.target.value))}
                    aria-label={`${r.title} servings`}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {anySelected && (
        <div className="out">
          <h2>Shopping list</h2>
          <button type="button" className="copy-btn" onClick={() => navigator.clipboard.writeText(text)}>
            Copy as text
          </button>
          <ul>
            {list.items.map((i, idx) => (
              <li key={idx}>
                {itemLine(i)}
                {i.sources.length > 1 && <span className="src"> - {i.sources.join(', ')}</span>}
              </li>
            ))}
          </ul>
          {list.toTaste.length > 0 && (
            <>
              <h3>To taste / as needed</h3>
              <ul>
                {list.toTaste.map((i, idx) => <li key={idx}>{i.item}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
