export interface Searchable {
  slug: string;
  title: string;
  category: string;
  tags: string[];
}

function tokens(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

// Crude depluralization so "fajitas" matches a title with "Fajita" and vice versa.
function normalize(word: string): string {
  return word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word;
}

function haystackTokens(item: Searchable): string[] {
  return tokens([item.title, item.category, ...item.tags].join(' '));
}

// A query word matches an item if it's a prefix match (either direction, after
// depluralizing) against any of the item's title/category/tag words - handles
// partial typing as you go, and simple singular/plural mismatches.
function wordMatches(queryWord: string, hay: string[]): boolean {
  const q = normalize(queryWord);
  return hay.some((w) => {
    const nw = normalize(w);
    return nw.startsWith(q) || q.startsWith(nw);
  });
}

export function searchRecipes<T extends Searchable>(items: T[], query: string): T[] {
  const words = tokens(query);
  if (words.length === 0) return [];
  return items.filter((item) => {
    const hay = haystackTokens(item);
    return words.every((w) => wordMatches(w, hay));
  });
}
