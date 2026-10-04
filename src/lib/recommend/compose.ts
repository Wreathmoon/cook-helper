/**
 * 把规则引擎的两步（分档 → 档内评分）组装成一次调用。
 *
 * 抽出来是因为现在有**两个**调用方：`getRecommendations` action，以及
 * Task/12 里 agent 的 `get_recommendations` 工具。两边各拼一遍同样的六个参数，
 * 迟早会漂移——而一旦漂移，「命令栏给的推荐」和「推荐页给的推荐」就会不一样，
 * 用户没有任何办法发现是哪边错了。
 *
 * ⚠️ **本文件不含任何新逻辑**，只是搬运。`tiering.ts` / `scoring.ts` 一行未改
 * （它们的 18 个测试是这个项目核心价值的回归基准）。
 */
import type { CalendarEntry, RecommendedRecipe } from '@/types';
import type { Vault } from '@/lib/vault';
import { tierRecipes } from './tiering';
import { scoreAndSort } from './scoring';

export interface RecommendFilters {
  maxCookTime?: number;
  spiciness?: string;
  dietType?: string;
  method?: string[];
}

export function composeRecommendations(
  vault: Vault,
  args: {
    inventory: Parameters<typeof tierRecipes>[0]['inventory'];
    recipes: Parameters<typeof tierRecipes>[0]['recipes'];
    utensils: Parameters<typeof tierRecipes>[0]['utensils'];
    calendarEntries: CalendarEntry[];
    filters?: RecommendFilters;
  }
): RecommendedRecipe[] {
  const tiered = tierRecipes({
    recipes: args.recipes,
    inventory: args.inventory,
    utensils: args.utensils,
    calendarEntries: args.calendarEntries,
    recipeIngredients: vault.recipeIngredients,
    recipeUtensils: vault.recipeUtensils,
  });

  return scoreAndSort({
    tieredRecipes: tiered,
    calendarEntries: args.calendarEntries,
    inventory: args.inventory,
    recipeIngredients: vault.recipeIngredients,
    userFilters: args.filters,
  });
}
