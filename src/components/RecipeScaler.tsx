import { useState } from 'react';
import type { Ingredient } from '../lib/types';
import { scaleFactor, scaleIngredient } from '../lib/scale';
import { formatScaledQuantity, formatScaledMetric } from '../lib/units';
import TurkeyTimer from './TurkeyTimer';
import './RecipeScaler.css';

interface Props {
  baseServings: number;
  ingredients: Ingredient[];
  /** Shown instead of "servings", e.g. "lb turkey". */
  unitLabel?: string;
  /** Show the turkey cook-time estimate, reading the scaler's count as pounds. */
  turkeyTimer?: boolean;
}

const MAX_SERVINGS = 9999;

export default function RecipeScaler({ baseServings, ingredients, unitLabel, turkeyTimer }: Props) {
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
    const qty = formatScaledQuantity(ing);
    const metric = formatScaledMetric(ing);
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
    <>
    <div className="scaler">
      <div className="stepper">
        <button aria-label={`Fewer ${unitLabel ?? 'servings'}`} onClick={() => step(servings - 1)}>−</button>
        <input
          className="count"
          type="number"
          min={1}
          max={MAX_SERVINGS}
          inputMode="numeric"
          aria-label={unitLabel ?? 'Servings'}
          value={draft ?? String(servings)}
          onChange={(e) => commit(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={() => setDraft(null)}
        />
        <button aria-label={`More ${unitLabel ?? 'servings'}`} onClick={() => step(servings + 1)}>+</button>
        <span>{unitLabel ?? 'servings'}</span>
        {servings !== baseServings && (
          <button className="reset" onClick={() => step(baseServings)}>reset</button>
        )}
      </div>
      <ul className="ingredients">{rows}</ul>
    </div>
    {turkeyTimer && <TurkeyTimer lbs={servings} />}
    </>
  );
}
