import { describe, it, expect } from 'vitest';
import { menuName, menuTags, buildMenuText, type MenuDish } from './menu';

describe('menuName', () => {
  it('strips a trailing parenthetical batch label', () => {
    expect(menuName('Chicken Enchiladas (Co-op Batch)')).toBe('Chicken Enchiladas');
  });
  it('strips a trailing dash suffix', () => {
    expect(menuName('Mexican Pinto Beans - Dry Bean Version')).toBe('Mexican Pinto Beans');
  });
  it('leaves a plain title alone', () => {
    expect(menuName('Chipotle Fajita Veggies')).toBe('Chipotle Fajita Veggies');
  });
  it('only strips a parenthetical at the end', () => {
    expect(menuName('Rice (v) with Beans')).toBe('Rice (v) with Beans');
  });
});

describe('menuTags', () => {
  it('maps the vegan tag to vg', () => {
    expect(menuTags(['mexican', 'vegan', 'side-dish'])).toEqual(['vg']);
  });
  it('maps the vegetarian tag to v', () => {
    expect(menuTags(['side-dish', 'vegetarian'])).toEqual(['v']);
  });
  it('prefers vg when a recipe is tagged both vegetarian and vegan', () => {
    expect(menuTags(['vegetarian', 'vegan', 'tex-mex'])).toEqual(['vg']);
  });
  it('puts the diet tag before gf', () => {
    expect(menuTags(['gluten-free', 'vegan'])).toEqual(['vg', 'gf']);
  });
  it('returns nothing for a recipe with no dietary tags', () => {
    expect(menuTags(['mexican', 'chicken', 'co-op'])).toEqual([]);
  });
});

const dish = (title: string, tags: string[], over: Partial<MenuDish> = {}): MenuDish => ({
  title,
  tags,
  ...over,
});

describe('buildMenuText', () => {
  it('formats a dish with its derived tags in parentheses', () => {
    const text = buildMenuText({ dishes: [dish('Mexican Pinto Beans - Dry Bean Version', ['vegan', 'gluten-free'])] });
    expect(text).toContain('Mexican Pinto Beans (vg, gf)');
  });
  it('omits the parentheses entirely when a dish has no tags', () => {
    const text = buildMenuText({ dishes: [dish('Chicken Enchiladas (Co-op Batch)', ['chicken'])] });
    expect(text).toContain('\nChicken Enchiladas\n');
  });
  it('lets menuTags override the derived tags', () => {
    const text = buildMenuText({
      dishes: [dish('Spanish-Style Rice', ['gluten-free'], { menuTags: ['vg', 'gf'] })],
    });
    expect(text).toContain('Spanish-Style Rice (vg, gf)');
  });
  it('lets menuName override the stripped title', () => {
    const text = buildMenuText({ dishes: [dish('Spanish-Style Rice', [], { menuName: 'Spanish Rice' })] });
    expect(text).toContain('Spanish Rice');
    expect(text).not.toContain('Spanish-Style');
  });
  it('formats the date as M/D', () => {
    const text = buildMenuText({ dishes: [], date: new Date('2026-09-02') });
    expect(text.split('\n')[0]).toBe('Dinner Menu 9/2');
  });
  it('falls back to a blank date placeholder when no date is set', () => {
    const text = buildMenuText({ dishes: [] });
    expect(text.split('\n')[0]).toBe('Dinner Menu _/_');
  });
  it('defaults the serving time to 18:30', () => {
    expect(buildMenuText({ dishes: [] })).toContain('Planning on serving 18:30');
  });
  it('uses a custom serving time when given', () => {
    expect(buildMenuText({ dishes: [], serveTime: '19:00' })).toContain('Planning on serving 19:00');
  });
  it('ends with empty crew role labels', () => {
    const lines = buildMenuText({ dishes: [] }).split('\n');
    expect(lines.slice(-3)).toEqual(['Head:', 'Ass:', 'Prep:']);
  });
  it('reproduces the Enchilada Night menu exactly', () => {
    const text = buildMenuText({
      date: new Date('2026-09-02'),
      dishes: [
        dish('Spanish-Style Rice', ['rice', 'gluten-free'], { menuName: 'Spanish Rice', menuTags: ['vg', 'gf'] }),
        dish('Chicken Enchiladas (Co-op Batch)', ['mexican', 'chicken']),
        dish('Cheese Enchiladas (Co-op Batch)', ['mexican', 'vegetarian']),
        dish('Vegan Enchiladas (Co-op Batch)', ['mexican', 'vegan', 'gluten-free']),
        dish('Mexican Pinto Beans - Dry Bean Version', ['mexican', 'vegan', 'gluten-free']),
        dish('Chipotle Fajita Veggies', ['vegetarian', 'vegan', 'gluten-free']),
        dish('Mexican Street Corn (Esquites)', ['vegetarian', 'gluten-free']),
      ],
    });
    expect(text).toBe(
      [
        'Dinner Menu 9/2',
        '',
        'Spanish Rice (vg, gf)',
        'Chicken Enchiladas',
        'Cheese Enchiladas (v)',
        'Vegan Enchiladas (vg, gf)',
        'Mexican Pinto Beans (vg, gf)',
        'Chipotle Fajita Veggies (vg, gf)',
        'Mexican Street Corn (v, gf)',
        '',
        'Planning on serving 18:30',
        '',
        'Head:',
        'Ass:',
        'Prep:',
      ].join('\n'),
    );
  });
});
