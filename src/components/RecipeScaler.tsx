import { useState } from 'react';
import type { Ingredient } from '../lib/types';
import { scaleFactor, scaleIngredient, formatQuantity } from '../lib/scale';
import './RecipeScaler.css';

interface Props {
  baseServings: number;
  ingredients: Ingredient[];
}

export default function RecipeScaler({ baseServings, ingredients }: Props) {
  const [servings, setServings] = useState(baseServings);
  const factor = scaleFactor(baseServings, servings);
  const scaled = ingredients.map((ing) => scaleIngredient(ing, factor));

  // Render in original order, inserting a subheading whenever `group` changes.
  let lastGroup: string | undefined;
  const rows = scaled.map((ing, i) => {
    const showGroup = ing.group && ing.group !== lastGroup;
    lastGroup = ing.group;
    const qty = formatQuantity(ing);
    return (
      <li key={i} className={ing.optional ? 'optional' : undefined}>
        {showGroup && <h3>{ing.group}</h3>}
        {qty && <span className="qty">{qty}</span>} {ing.item}
        {ing.note && <span className="note"> — {ing.note}</span>}
      </li>
    );
  });

  return (
    <div className="scaler">
      <div className="stepper">
        <button aria-label="Fewer servings" onClick={() => setServings((s) => Math.max(1, s - 1))}>−</button>
        <span className="count">{servings}</span>
        <button aria-label="More servings" onClick={() => setServings((s) => s + 1)}>+</button>
        <span>servings</span>
        {servings !== baseServings && (
          <button className="reset" onClick={() => setServings(baseServings)}>reset</button>
        )}
      </div>
      <ul className="ingredients">{rows}</ul>
    </div>
  );
}
