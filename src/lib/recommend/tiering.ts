// 二期将由 LLM 决策取代
import type {
  Recipe,
  InventoryItem,
  Utensil,
  CalendarEntry,
  RecommendTier,
  RecommendedRecipe,
} from '@/types';
import { RECOMMEND_CONFIG } from './config';

interface TieringInput {
  recipes: Recipe[];
  inventory: InventoryItem[];
  utensils: Utensil[];
  calendarEntries: CalendarEntry[];
  recipeIngredients: Map<string, { inventory_id: string; role: string; amount?: string }[]>;
  recipeUtensils: Map<string, string[]>; // recipe_id -> utensil names
}

export function tierRecipes(input: TieringInput): RecommendedRecipe[] {
  const { recipes, inventory, utensils, calendarEntries, recipeIngredients, recipeUtensils } = input;

  const inventoryMap = new Map(inventory.map((i) => [i.id, i]));
  const ownedUtensils = new Set(utensils.map((u) => u.name));
  const now = new Date();

  const results: RecommendedRecipe[] = [];

  for (const recipe of recipes) {
    const ingredients = recipeIngredients.get(recipe.id) || [];
    const neededUtensils = recipeUtensils.get(recipe.id) || [];

    // 检查食材状态
    const missingIngredients: string[] = [];
    const clearStockIngredients: string[] = [];
    let allAvailable = true;

    for (const ing of ingredients) {
      const invItem = inventoryMap.get(ing.inventory_id);
      if (!invItem) {
        missingIngredients.push('未知食材');
        allAvailable = false;
        continue;
      }

      if (invItem.stock_level === 'out') {
        missingIngredients.push(invItem.name);
        allAvailable = false;
      } else if (invItem.stock_level === 'low') {
        // low 不算缺，但提醒
        missingIngredients.push(invItem.name);
        allAvailable = false;
      }

      // 检查清库存
      if (invItem.stock_level === 'enough' && invItem.last_restocked_at) {
        const daysSinceRestock = Math.floor(
          (now.getTime() - new Date(invItem.last_restocked_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        const threshold = RECOMMEND_CONFIG.clearStockThreshold[invItem.category];
        if (threshold && daysSinceRestock > threshold) {
          clearStockIngredients.push(invItem.name);
        }
      }
    }

    // 检查厨具
    const missingUtensils: string[] = [];
    for (const name of neededUtensils) {
      if (!ownedUtensils.has(name)) {
        missingUtensils.push(name);
      }
    }

    // 分档判定
    let tier: RecommendTier;

    if (missingIngredients.length === 0 && missingUtensils.length === 0) {
      // 所有食材和厨具都齐
      if (clearStockIngredients.length > 0) {
        // 有久放食材，优先归入清库存档
        tier = 'clear_stock';
      } else {
        tier = 'can_make_now';
      }
    } else if (
      missingIngredients.length <= RECOMMEND_CONFIG.maxMissingForShopping ||
      missingUtensils.length > 0
    ) {
      // 缺的少，归入"需额外购买"
      // 但如果缺太多就不推荐
      if (
        missingIngredients.length > RECOMMEND_CONFIG.maxMissingForShopping * 2 &&
        missingUtensils.length > 2
      ) {
        continue; // 缺太多，不推荐
      }
      tier = 'need_shopping';
    } else if (clearStockIngredients.length > 0) {
      tier = 'clear_stock';
    } else {
      continue; // 不满足任何档位，跳过
    }

    results.push({
      recipe,
      tier,
      score: 0, // 评分在下一步计算
      missingIngredients: missingIngredients.length > 0 ? missingIngredients : undefined,
      missingUtensils: missingUtensils.length > 0 ? missingUtensils : undefined,
      clearStockIngredients: clearStockIngredients.length > 0 ? clearStockIngredients : undefined,
    });
  }

  return results;
}
