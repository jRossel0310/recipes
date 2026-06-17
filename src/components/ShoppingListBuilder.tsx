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

interface Props { recipes: RecipeChoice[] }

interface Selected { servings: number }

function itemLine(item: ShoppingItem): string {
  const parts: string[] = [];
  if (item.qty !== undefined) {
    const lo = formatNumber(item.qty, item.unit);
    const num = item.qtyMax !== undefined ? `${lo}–${formatNumber(item.qtyMax, item.unit)}` : lo;
    parts.push(item.unit ? `${num} ${item.unit}` : num);
  }
  let line = `${parts.join(' ')} ${item.item}`.trim();
  if (item.grams !== undefined && item.unit !== 'g') line += ` (~${Math.round(item.grams)} g)`;
  return line;
}

export default function ShoppingListBuilder({ recipes }: Props) {
  const [selected, setSelected] = useState<Record<string, Selected>>({});

  const byCategory = useMemo(() => {
    const m = new Map<string, RecipeChoice[]>();
    for (const r of recipes) {
      if (!m.has(r.category)) m.set(r.category, []);
      m.get(r.category)!.push(r);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [recipes]);

  const list = useMemo(() => {
    const sel = recipes
      .filter((r) => selected[r.slug])
      .map((r) => ({ recipe: r.data, targetServings: selected[r.slug].servings }));
    return consolidate(sel);
  }, [recipes, selected]);

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
      <div className="pick">
        <h2>Pick recipes</h2>
        {byCategory.map(([cat, rs]) => (
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
          <button onClick={() => navigator.clipboard.writeText(text)}>Copy as text</button>
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
