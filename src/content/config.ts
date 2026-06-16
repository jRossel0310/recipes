import { defineCollection, z } from 'astro:content';

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
      })
      .optional(),
    tags: z.array(z.string()).optional(),
    ingredients: z.array(ingredient).min(1),
  }),
});

export const collections = { recipes };
