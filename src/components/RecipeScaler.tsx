import { useState } from 'react';
import type { Ingredient } from '../lib/types';
import { scaleFactor, scaleIngredient, formatQuantity, formatMetric } from '../lib/scale';
import './RecipeScaler.css';

interface Props {
  baseServings: number;
  ingredients: Ingredient[];
}

const MAX_SERVINGS = 9999;

export default function RecipeScaler({ baseServings, ingredients }: Props) {
  const [servings, setServings] = useState(baseServings);
  // Holds raw keystrokes while the field is mid-edit so a cleared or half-typed
  // value can sit on screen without the ingredient list following it.
  const [draft, setDraft] = useState<string | null>(null);

  function commit(raw: string) {
    setDraft(raw);
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 1 && n <= MAX_SERVINGS) setServings(n);
  }

  function step(next: number) {
    setServings(Math.min(MAX_SERVINGS, Math.max(1, next)));
    setDraft(null);
  }

  const factor = scaleFactor(baseServings, servings);
  const scaled = ingredients.map((ing) => scaleIngredient(ing, factor));

  // Render in original order, inserting a subheading whenever `group` changes.
  let lastGroup: string | undefined;
  const rows = scaled.map((ing, i) => {
    const showGroup = ing.group && ing.group !== lastGroup;
    if (ing.group) lastGroup = ing.group;
    const qty = formatQuantity(ing);
    const metric = formatMetric(ing);
    return (
      <li key={i} className={ing.optional ? 'optional' : undefined}>
        {showGroup && <h3>{ing.group}</h3>}
        {qty && <span className="qty">{qty}</span>} {ing.item}
        {metric && <span className="metric"> ({metric})</span>}
        {ing.note && <span className="note"> - {ing.note}</span>}
      </li>
    );
  });

  return (
    <div className="scaler">
      <div className="stepper">
        <button aria-label="Fewer servings" onClick={() => step(servings - 1)}>−</button>
        <input
          className="count"
          type="number"
          min={1}
          max={MAX_SERVINGS}
          inputMode="numeric"
          aria-label="Servings"
          value={draft ?? String(servings)}
          onChange={(e) => commit(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={() => setDraft(null)}
        />
        <button aria-label="More servings" onClick={() => step(servings + 1)}>+</button>
        <span>servings</span>
        {servings !== baseServings && (
          <button className="reset" onClick={() => step(baseServings)}>reset</button>
        )}
      </div>
      <ul className="ingredients">{rows}</ul>
    </div>
  );
}
