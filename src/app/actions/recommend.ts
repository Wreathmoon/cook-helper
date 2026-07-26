'use server';

import { listInventory } from '@/lib/services/inventory';
import { listRecipes } from '@/lib/services/recipe';
import { listUtensils } from '@/lib/services/utensil';
import { getCalendarEntries } from '@/lib/services/calendar';
import { tierRecipes } from '@/lib/recommend/tiering';
import { scoreAndSort } from '@/lib/recommend/scoring';
import { generateShoppingList, checkoutShoppingList } from '@/lib/services/shopping';
import { getVault } from '@/lib/vault';
import { guardData, guardResult } from '@/lib/utils/error';
import type { CalendarEntry, RecommendedRecipe, ShoppingListItem } from '@/types';

export async function getRecommendations(filters?: {
  maxCookTime?: number;
  spiciness?: string;
  dietType?: string;
  method?: string[];
}) {
  return guardData([] as RecommendedRecipe[], async () => {
    const vault = getVault();
    const now = new Date();

    const [inventoryRes, recipesRes, utensilsRes, calendarRes] = await Promise.all([
      listInventory(vault),
      listRecipes(vault),
      listUtensils(vault),
      getCalendarEntries(vault, now.getFullYear(), now.getMonth() + 1),
    ]);

    // 食材与厨具的关联已经在 vault 加载时建好了，不需要再逐菜谱查一遍。
    // 注意：recipeIngredients 里的 inventory_id 装的是**归一化后的食材名称**，
    // 而 InventoryItem.id 同样是归一化名称——推荐引擎因此一行都不用改
    // （见 src/lib/vault/reader.ts 的 §关联键）。
    const tiered = tierRecipes({
      recipes: recipesRes.data,
      inventory: inventoryRes.data,
      utensils: utensilsRes.data,
      calendarEntries: calendarRes.data as CalendarEntry[],
      recipeIngredients: vault.recipeIngredients,
      recipeUtensils: vault.recipeUtensils,
    });

    const scored = scoreAndSort({
      tieredRecipes: tiered,
      calendarEntries: calendarRes.data as CalendarEntry[],
      inventory: inventoryRes.data,
      recipeIngredients: vault.recipeIngredients,
      userFilters: filters,
    });

    return { data: scored, error: null };
  });
}

export async function generateShoppingListAction(
  selectedRecipeIds: string[],
  includePlannedRecipes: boolean = false
): Promise<{ data: ShoppingListItem[]; error: string | null }> {
  return guardData([] as ShoppingListItem[], () =>
    generateShoppingList(getVault(), selectedRecipeIds, includePlannedRecipes)
  );
}

export async function checkoutShoppingListAction(
  checkedInventoryIds: string[]
): Promise<{ error: string | null }> {
  return guardResult(() => checkoutShoppingList(getVault(), checkedInventoryIds));
}
