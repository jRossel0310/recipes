import type { Locale } from './ui-strings';

const TRANSLATED_SECTIONS = ['recipes', 'cloyne', 'dinners'];

function normalize(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

export function localeOf(pathname: string): Locale {
  const p = normalize(pathname);
  return p === '/de' || p.startsWith('/de/') ? 'de' : 'en';
}

function englishPath(pathname: string): string {
  const p = normalize(pathname);
  if (p === '/de') return '/';
  return p.startsWith('/de/') ? p.slice(3) : p;
}

export function hasGermanRoute(pathname: string): boolean {
  const segments = englishPath(pathname).split('/').filter(Boolean);
  if (segments.length === 0) return false;
  if (!TRANSLATED_SECTIONS.includes(segments[0])) return false;
  if (segments[segments.length - 1] === 'nutrition') return false;
  return true;
}

export function counterpartPath(pathname: string): string | null {
  if (!hasGermanRoute(pathname)) return null;
  const p = normalize(pathname);
  return localeOf(p) === 'de' ? englishPath(p) : `/de${p}`;
}
