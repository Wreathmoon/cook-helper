'use server';

import { createClient } from '@/lib/supabase/server';
import { listInventory } from '@/lib/services/inventory';
import { listRecipes, getRecipeDetail } from '@/lib/services/recipe';
import { listUtensils } from '@/lib/services/utensil';
import { getCalendarEntries } from '@/lib/services/calendar';
import { tierRecipes } from '@/lib/recommend/tiering';
import { scoreAndSort } from '@/lib/recommend/scoring';
import { generateShoppingList, checkoutShoppingList } from '@/lib/services/shopping';
import type { CalendarEntry, ShoppingListItem } from '@/types';

export async function getRecommendations(filters?: {
  maxCookTime?: number;
  spiciness?: string;
  dietType?: string;
  method?: string[];
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');

  // 获取所有数据
  const now = new Date();
  const [inventoryRes, recipesRes, utensilsRes, calendarRes] = await Promise.all([
    listInventory(supabase, user.id),
    listRecipes(supabase, user.id),
    listUtensils(supabase, user.id),
    getCalendarEntries(supabase, user.id, now.getFullYear(), now.getMonth() + 1),
  ]);

  // 获取所有菜谱的食材关联和厨具关联
  const recipeIngredients = new Map<
    string,
    { inventory_id: string; role: string; amount?: string }[]
  >();
  const recipeUtensils = new Map<string, string[]>();

  for (const recipe of recipesRes.data) {
    const detail = await getRecipeDetail(supabase, user.id, recipe.id);
    if (detail.data) {
      recipeIngredients.set(
        recipe.id,
        detail.data.ingredients.map((i) => ({
          inventory_id: i.inventory_id,
          role: i.role,
          amount: i.amount ?? undefined,
        }))
      );
      recipeUtensils.set(
        recipe.id,
        detail.data.utensils.map((u) => u.utensil_name)
      );
    }
  }

  // 第一层：硬分档
  const tiered = tierRecipes({
    recipes: recipesRes.data,
    inventory: inventoryRes.data,
    utensils: utensilsRes.data,
    calendarEntries: calendarRes.data as CalendarEntry[],
    recipeIngredients,
    recipeUtensils,
  });

  // 第二层：档内评分
  const scored = scoreAndSort({
    tieredRecipes: tiered,
    calendarEntries: calendarRes.data as CalendarEntry[],
    inventory: inventoryRes.data,
    recipeIngredients,
    userFilters: filters,
  });

  return { data: scored, error: null };
}

export async function generateShoppingListAction(
  selectedRecipeIds: string[],
  includePlannedRecipes: boolean = false
): Promise<{ data: ShoppingListItem[]; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  return generateShoppingList(supabase, user.id, selectedRecipeIds, includePlannedRecipes);
}

export async function checkoutShoppingListAction(
  checkedInventoryIds: string[]
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  return checkoutShoppingList(supabase, user.id, checkedInventoryIds);
}
