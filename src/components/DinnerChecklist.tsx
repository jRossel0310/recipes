import { useEffect, useState } from 'react';
import './DinnerChecklist.css';

interface DishIngredient {
  primary: string;
  metric: string;
  item: string;
  note?: string;
  group?: string;
  optional?: boolean;
}
interface DishView {
  name: string;
  servings: number;
  ingredients: DishIngredient[];
  steps: string[];
  notes: string[];
}
interface Props {
  slug: string;
  dishes: DishView[];
}

export default function DinnerChecklist({ slug, dishes }: Props) {
  const storageKey = `dinner-checklist:${slug}`;
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // Load persisted state after mount (keeps SSR markup and first client render identical).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setChecked(JSON.parse(raw));
    } catch {
      /* ignore unreadable storage */
    }
  }, [storageKey]);

  function toggle(key: string) {
    setChecked((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function reset() {
    setChecked({});
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="dinner">
      <nav className="jump">
        {dishes.map((dish, di) => (
          <a key={di} href={`#dish-${di}`}>
            {dish.name}
          </a>
        ))}
        <button className="reset" onClick={reset}>
          Reset checklist
        </button>
      </nav>

      {dishes.map((dish, di) => {
        let lastGroup: string | undefined;
        return (
          <section key={di} id={`dish-${di}`} className="dish">
            <h2>
              {dish.name} <span className="servings">· {dish.servings} servings</span>
            </h2>

            <h3>Ingredients</h3>
            <ul className="checklist">
              {dish.ingredients.map((ing, ii) => {
                const key = `d${di}-i${ii}`;
                const showGroup = ing.group && ing.group !== lastGroup;
                if (ing.group) lastGroup = ing.group;
                return (
                  <li key={ii} className={ing.optional ? 'optional' : undefined}>
                    {showGroup && <h4 className="group">{ing.group}</h4>}
                    <label className={checked[key] ? 'done' : undefined}>
                      <input type="checkbox" checked={!!checked[key]} onChange={() => toggle(key)} />
                      <span>
                        {ing.primary && <span className="qty">{ing.primary}</span>} {ing.item}
                        {ing.metric && <span className="metric"> ({ing.metric})</span>}
                        {ing.note && <span className="note"> - {ing.note}</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>

            {dish.notes.length > 0 && (
              <div className="cook-notes">
                <strong>Head-cook notes</strong>
                <ul>
                  {dish.notes.map((n, ni) => (
                    <li key={ni}>{n}</li>
                  ))}
                </ul>
              </div>
            )}

            {dish.steps.length > 0 && (
              <>
                <h3>Instructions</h3>
                <ol className="checklist steps">
                  {dish.steps.map((step, si) => {
                    const key = `d${di}-s${si}`;
                    return (
                      <li key={si}>
                        <label className={checked[key] ? 'done' : undefined}>
                          <input type="checkbox" checked={!!checked[key]} onChange={() => toggle(key)} />
                          <span>{step}</span>
                        </label>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
