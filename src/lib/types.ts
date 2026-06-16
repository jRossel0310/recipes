export interface Ingredient {
  item: string;
  qty?: number;
  qtyMax?: number;
  unit?: string;
  grams?: number;
  ml?: number;
  note?: string;
  group?: string;
  optional?: boolean;
}

export interface Nutrition {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export interface RecipeData {
  title: string;
  servings: number;
  ingredients: Ingredient[];
}
