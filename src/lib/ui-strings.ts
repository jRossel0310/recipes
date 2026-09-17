export type Locale = 'en' | 'de';

export const UI_STRINGS = {
  en: {
    dinners: 'Dinners',
    recipes: 'Recipes',
    shopping: 'Shopping',
    cloyne: 'Cloyne',
    ingredients: 'Ingredients',
    instructions: 'Instructions',
    notes: 'Notes',
    servings: 'Servings',
    footer: 'Built for the nightly dinner routine.',
    backToCloyne: 'All Cloyne menus',
    backToDinners: 'All dinners',
    switchLanguage: 'Deutsch',
    bannerUnreviewed: 'Machine translated - check quantities against English',
    bannerStale: 'The German version is out of date; showing English.',
    bannerMissing: 'Not translated yet; showing English.',
  },
  de: {
    dinners: 'Abendessen',
    recipes: 'Rezepte',
    shopping: 'Einkauf',
    cloyne: 'Cloyne',
    ingredients: 'Zutaten',
    instructions: 'Zubereitung',
    notes: 'Hinweise',
    servings: 'Portionen',
    footer: 'Für die tägliche Abendessen-Routine gebaut.',
    backToCloyne: 'Alle Cloyne-Menüs',
    backToDinners: 'Alle Abendessen',
    switchLanguage: 'English',
    bannerUnreviewed: 'Maschinell übersetzt — Mengen auf Englisch prüfen',
    bannerStale: 'Die deutsche Fassung ist veraltet; es wird Englisch angezeigt.',
    bannerMissing: 'Noch nicht übersetzt; es wird Englisch angezeigt.',
  },
} as const;

export type UiKey = keyof typeof UI_STRINGS.en;

export function t(locale: Locale, key: UiKey): string {
  return UI_STRINGS[locale][key];
}
