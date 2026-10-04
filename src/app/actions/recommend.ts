'use server';

import { listInventory } from '@/lib/services/inventory';
import { listRecipes } from '@/lib/services/recipe';
import { listUtensils } from '@/lib/services/utensil';
import { getCalendarEntries } from '@/lib/services/calendar';
import { tierRecipes } from '@/lib/recommend/tiering';
import { scoreAndSort } from '@/lib/recommend/scoring';
import { generateShoppingList, checkoutShoppingList } from '@/lib/services/shopping';
import { getMemoriesForPrompt } from '@/lib/services/memory';
import { getVault } from '@/lib/vault';
import { guardData, guardResult } from '@/lib/utils/error';
import { isAiConfigured } from '@/lib/ai/config';
import { annotateWithMemory, type AnnotateCandidate } from '@/lib/ai/annotate';
import { ANNOTATE_LIMIT } from '@/lib/ai/limits';
import type { MemoryVerdict } from '@/lib/ai/verdict';
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

/**
 * 用记忆给推荐结果打标注 —— **单独一个 action，不并进 `getRecommendations`**。
 *
 * 推荐页是首屏。把模型调用放进它的加载路径，等于让每个配了 key 的人每次开首页
 * 都多等一两秒，而且模型一挂首屏就白屏。所以规则引擎先秒出，这里随后异步补上。
 *
 * 顺带白拿一个保证：**没配 key 的人根本不会调到这里**，走的代码路径与
 * Task/10 之前逐字相同。规则引擎不需要 key，这条不能破（DESIGN.md §6 #3/#4）。
 *
 * 入参只有 id：整份推荐结果带着菜谱正文，来回传两遍会撞上 Server Action 的 1MB 上限。
 */
export async function annotateRecommendationsAction(
  recipeIds: string[]
): Promise<{ data: MemoryVerdict[]; error: string | null }> {
  if (!isAiConfigured() || recipeIds.length === 0) return { data: [], error: null };

  return guardData([] as MemoryVerdict[], async () => {
    const vault = getVault();
    const byId = new Map(vault.recipes.map((item) => [item.id, item]));

    const candidates: AnnotateCandidate[] = [];
    for (const id of recipeIds.slice(0, ANNOTATE_LIMIT)) {
      const recipe = byId.get(id);
      if (!recipe) continue;
      candidates.push({
        id: recipe.id,
        name: recipe.name,
        spiciness: recipe.attributes?.spiciness ?? null,
        diet_type: recipe.attributes?.diet_type ?? null,
        cuisine: recipe.attributes?.cuisine ?? null,
      });
    }

    return annotateWithMemory(getMemoriesForPrompt(vault), candidates);
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
