import { defineCollection, reference, z } from 'astro:content';

const ingredient = z.object({
  item: z.string(),
  qty: z.number().optional(),
  qtyMax: z.number().optional(),
  unit: z.string().optional(),
  grams: z.number().optional(),
  ml: z.number().optional(),
  note: z.string().optional(),
  group: z.string().optional(),
  optional: z.boolean().optional(),
});

const recipes = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    source: z.string().optional(),
    servings: z.number().positive(),
    prepTime: z.string().optional(),
    cookTime: z.string().optional(),
    nutrition: z
      .object({
        calories: z.number().optional(),
        protein: z.number().optional(),
        carbs: z.number().optional(),
        fat: z.number().optional(),
        servingGrams: z.number().positive().optional(),
      })
      .optional(),
    tags: z.array(z.string()).optional(),
    hidden: z.boolean().optional(),
    ingredients: z.array(ingredient).min(1),
  }),
});

const dinners = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    summary: z.string().optional(),
    kind: z.enum(['everyday', 'event']).default('event'),
    sortOrder: z.number().int().positive().optional(),
    date: z.date().optional(),
    dishes: z
      .array(
        z.object({
          recipe: reference('recipes'),
          servings: z.number().positive(),
          notes: z.array(z.string()).optional(),
          optional: z.boolean().optional(),
        }),
      )
      .min(1),
  }),
});

export const collections = { recipes, dinners };
