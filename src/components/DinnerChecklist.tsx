import { useEffect, useRef, useState } from 'react';
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
  optional: boolean;
  ingredients: DishIngredient[];
  steps: { text: string; section?: string }[];
  notes: string[];
}
interface Props {
  slug: string;
  dishes: DishView[];
}

// Batch labels like "(Co-op Batch)" just crowd the dish menu.
function shortName(name: string): string {
  return name.replace(/\s*\([^()]*\)\s*$/, '');
}

function countDone(checked: Record<string, boolean>, di: number, dish: DishView): number {
  let n = 0;
  dish.ingredients.forEach((_, ii) => { if (checked[`d${di}-i${ii}`]) n++; });
  dish.steps.forEach((_, si) => { if (checked[`d${di}-s${si}`]) n++; });
  return n;
}

export default function DinnerChecklist({ slug, dishes }: Props) {
  const storageKey = `dinner-checklist:${slug}`;
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [activeDish, setActiveDish] = useState(0);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const menuRef = useRef<HTMLDetailsElement | null>(null);

  // Load persisted state after mount (keeps SSR markup and first client render identical).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setChecked(JSON.parse(raw));
    } catch {
      /* ignore unreadable storage */
    }
  }, [storageKey]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const topMost = visible.reduce((a, b) => (a.boundingClientRect.top > b.boundingClientRect.top ? a : b));
        const index = sectionRefs.current.findIndex((el) => el === topMost.target);
        if (index !== -1) setActiveDish(index);
      },
      // 132px clears the sticky site header (60-68px) + sticky jump nav (~61px) across
      // breakpoints; the -70% bottom margin keeps the trigger band near the top of the
      // viewport so only the dish currently under the sticky bars counts as active.
      { rootMargin: '-132px 0px -70% 0px', threshold: 0 },
    );
    for (const el of sectionRefs.current) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [dishes.length]);

  // The dish menu is a native <details>, so it opens before hydration too; once
  // hydrated, close it on an outside tap or Escape like any other dropdown.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const menu = menuRef.current;
      if (menu?.open && !menu.contains(e.target as Node)) menu.open = false;
    }
    function onKeyDown(e: KeyboardEvent) {
      const menu = menuRef.current;
      if (e.key === 'Escape' && menu?.open) {
        menu.open = false;
        menu.querySelector('summary')?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  function closeMenu() {
    if (menuRef.current) menuRef.current.open = false;
  }

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
      <nav className="jump" aria-label="Jump to dish">
        <details className="jump-menu" ref={menuRef}>
          <summary>
            <span className="jump-count">{activeDish + 1}/{dishes.length}</span>
            <span className="jump-current">{shortName(dishes[activeDish]?.name ?? '')}</span>
            <span className="jump-chevron" aria-hidden="true" />
          </summary>
          <ol className="jump-list">
            {dishes.map((dish, di) => {
              const total = dish.ingredients.length + dish.steps.length;
              const done = countDone(checked, di, dish);
              return (
                <li key={di}>
                  <a
                    href={`#dish-${di}`}
                    onClick={closeMenu}
                    aria-current={di === activeDish ? 'location' : undefined}
                    className={[dish.optional ? 'optional' : '', di === activeDish ? 'active' : ''].filter(Boolean).join(' ') || undefined}
                  >
                    <span className="jump-name">
                      {shortName(dish.name)}
                      {dish.optional && <span className="jump-optional"> · optional</span>}
                    </span>
                    {done > 0 && (
                      <span className={`jump-progress${done === total ? ' complete' : ''}`}>
                        {done === total ? '✓' : `${done}/${total}`}
                      </span>
                    )}
                  </a>
                </li>
              );
            })}
          </ol>
        </details>
        <button className="reset" onClick={reset}>
          Reset checklist
        </button>
      </nav>

      {dishes.map((dish, di) => {
        let lastGroup: string | undefined;
        return (
          <section
            key={di}
            id={`dish-${di}`}
            ref={(el) => { sectionRefs.current[di] = el; }}
            className={`dish${dish.optional ? ' dish-optional' : ''}`}
          >
            <h2>
              {dish.name} {dish.optional && <span className="optional-badge">Optional</span>}
              <span className="servings">· {dish.servings === 1 ? '1 batch' : `${dish.servings} servings`}</span>
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
                    const showSection = step.section && step.section !== dish.steps[si - 1]?.section;
                    return (
                      <li key={si}>
                        {showSection && <h4 className="group">{step.section}</h4>}
                        <label className={checked[key] ? 'done' : undefined}>
                          <input type="checkbox" checked={!!checked[key]} onChange={() => toggle(key)} />
                          <span>{step.text}</span>
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
