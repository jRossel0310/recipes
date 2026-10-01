export interface MenuDish {
  title: string;
  tags: string[];
  menuName?: string;
  menuTags?: string[];
}

export interface MenuInput {
  dishes: MenuDish[];
  date?: Date;
  serveTime?: string;
}

const DEFAULT_SERVE_TIME = '7:00 pm';

// Recipe titles carry batch labels that do not belong on a menu board:
// "Chicken Enchiladas (Co-op Batch)", "Mexican Pinto Beans - Dry Bean Version".
export function menuName(title: string): string {
  return title
    .replace(/\s*\([^()]*\)\s*$/, '')
    .replace(/\s+-\s+.*$/, '')
    .trim();
}

// Recipe tags -> the short menu-board notation. This house uses `v` for vegan
// and `vg` for vegetarian, which is the opposite of the more common convention -
// don't "fix" it. Vegan wins over vegetarian, and the diet marker precedes gf.
export function menuTags(tags: string[]): string[] {
  const out: string[] = [];
  if (tags.includes('vegan')) out.push('v');
  else if (tags.includes('vegetarian')) out.push('vg');
  if (tags.includes('gluten-free')) out.push('gf');
  return out;
}

// A date set on the dinner wins; otherwise use today, which only the browser
// knows (the site is static, so build time would freeze the last deploy's date).
// Undefined until the browser supplies it, which renders the _/_ placeholder.
export function resolveMenuDate(explicit?: Date, today?: Date): Date | undefined {
  return explicit ?? today;
}

// Frontmatter dates parse as UTC midnight, so read them in UTC or the day slips.
function formatDate(date?: Date): string {
  if (!date) return '_/_';
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

function dishLine(dish: MenuDish): string {
  const name = dish.menuName ?? menuName(dish.title);
  const tags = dish.menuTags ?? menuTags(dish.tags);
  return tags.length > 0 ? `${name} (${tags.join(', ')})` : name;
}

export function buildMenuText(input: MenuInput): string {
  return [
    `Dinner Menu ${formatDate(input.date)}`,
    '',
    ...input.dishes.map(dishLine),
    '',
    `Planning on serving ${input.serveTime ?? DEFAULT_SERVE_TIME}`,
    '',
    'Head:',
    'Ass:',
    'Prep:',
  ].join('\n');
}
