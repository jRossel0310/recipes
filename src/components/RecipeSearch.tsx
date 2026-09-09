import { useMemo, useState } from 'react';
import { searchRecipes } from '../lib/search';
import './RecipeSearch.css';

export interface SearchableRecipe {
  slug: string;
  title: string;
  category: string;
  tags: string[];
  prepTime?: string;
  cookTime?: string;
}

interface Props {
  recipes: SearchableRecipe[];
}

export default function RecipeSearch({ recipes }: Props) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const results = useMemo(() => searchRecipes(recipes, query), [recipes, query]);

  const showResults = focused && query.trim().length > 0;

  return (
    <div className="recipe-search">
      <input
        type="search"
        placeholder="Search recipes..."
        aria-label="Search recipes"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setQuery('');
        }}
      />
      {showResults && (
        <div className="results" onMouseDown={(e) => e.preventDefault()}>
          {results.length === 0 ? (
            <p className="empty">No recipes match "{query}".</p>
          ) : (
            results.map((r) => (
              <a key={r.slug} className="result" href={`/recipes/${r.slug}`}>
                <strong>{r.title}</strong>
                <span>
                  {r.prepTime && `Prep ${r.prepTime}`}
                  {r.prepTime && r.cookTime && ' · '}
                  {r.cookTime && `Cook ${r.cookTime}`}
                </span>
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
}
