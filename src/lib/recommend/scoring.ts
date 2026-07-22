// 二期将由 LLM 决策取代
import type { RecommendedRecipe, CalendarEntry, InventoryItem } from '@/types';
import { RECOMMEND_CONFIG } from './config';

interface ScoringInput {
  tieredRecipes: RecommendedRecipe[];
  calendarEntries: CalendarEntry[];
  inventory: InventoryItem[];
  recipeIngredients: Map<string, { inventory_id: string }[]>;
  userFilters?: {
    maxCookTime?: number;
    spiciness?: string;
    dietType?: string;
    method?: string[];
  };
}

export function scoreAndSort(input: ScoringInput): RecommendedRecipe[] {
  const { tieredRecipes, calendarEntries, inventory, userFilters } = input;

  // 硬过滤（临时约束）
  let filtered = tieredRecipes;

  if (userFilters) {
    if (userFilters.maxCookTime) {
      filtered = filtered.filter(
        (r) => !r.recipe.cook_time_minutes || r.recipe.cook_time_minutes <= userFilters.maxCookTime!
      );
    }
    if (userFilters.spiciness) {
      filtered = filtered.filter(
        (r) =>
          r.recipe.attributes?.spiciness === userFilters.spiciness ||
          !r.recipe.attributes?.spiciness
      );
    }
    if (userFilters.dietType) {
      filtered = filtered.filter(
        (r) =>
          r.recipe.attributes?.diet_type === userFilters.dietType ||
          !r.recipe.attributes?.diet_type
      );
    }
    if (userFilters.method && userFilters.method.length > 0) {
      filtered = filtered.filter((r) => {
        if (!r.recipe.attributes?.method) return true; // 缺失维度优雅降级
        return userFilters.method!.some((m) =>
          r.recipe.attributes.method!.includes(m as never)
        );
      });
    }
  }

  const now = new Date();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _inventoryMap = new Map(inventory.map((i) => [i.id, i]));

  // 计算每道菜的评分
  for (const recipe of filtered) {
    const scores: number[] = [];
    const weights: number[] = [];
    const config = RECOMMEND_CONFIG.weights;

    // 1. 不重样（距上次做该菜天数越久分越高）
    const lastDone = calendarEntries
      .filter((e) => e.recipe_id === recipe.recipe.id && e.status === 'completed')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    if (lastDone) {
      const daysSince = Math.floor(
        (now.getTime() - new Date(lastDone.date).getTime()) / (1000 * 60 * 60 * 24)
      );
      // 归一化：0天=0分，30天+=1分
      const noRepeatScore = Math.min(daysSince / 30, 1);
      scores.push(noRepeatScore);
      weights.push(config.noRepeat);
    } else {
      // 从没做过，给高分
      scores.push(1);
      weights.push(config.noRepeat);
    }

    // 2. 清库存（菜里含"久放 enough 食材"越多分越高）
    if (recipe.clearStockIngredients && recipe.clearStockIngredients.length > 0) {
      const clearScore = Math.min(recipe.clearStockIngredients.length / 3, 1);
      scores.push(clearScore);
      weights.push(config.clearStock);
    }

    // 3. 耗时匹配（用户设了时间筛选才计）
    if (userFilters?.maxCookTime && recipe.recipe.cook_time_minutes) {
      const diff = Math.abs(recipe.recipe.cook_time_minutes - userFilters.maxCookTime);
      const timeScore = Math.max(0, 1 - diff / 60); // 差60分钟以上=0分
      scores.push(timeScore);
      weights.push(config.timeMatch);
    }

    // 4. 营养搭配（近3天连续荤菜 → 给纯素/多蔬菜加分）
    const recentEntries = calendarEntries.filter((e) => {
      const daysDiff = Math.floor(
        (now.getTime() - new Date(e.date).getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysDiff <= 3 && e.status === 'completed';
    });

    if (recentEntries.length > 0) {
      const dietType = recipe.recipe.attributes?.diet_type;
      const nutrition = recipe.recipe.attributes?.nutrition;

      if (dietType === '纯素' || (nutrition && nutrition.includes('多蔬菜纤维'))) {
        scores.push(0.8);
        weights.push(config.nutritionBalance);
      } else if (dietType === '荤素搭配') {
        scores.push(0.5);
        weights.push(config.nutritionBalance);
      }
    }

    // 加权求和
    if (weights.length > 0) {
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      recipe.score = scores.reduce((sum, s, i) => sum + s * weights[i], 0) / totalWeight;
    } else {
      recipe.score = 0.5; // 默认分
    }
  }

  // 按档分组，档内按分数排序，每档取 Top N
  const tiers: Record<string, RecommendedRecipe[]> = {
    can_make_now: [],
    need_shopping: [],
    clear_stock: [],
  };

  for (const recipe of filtered) {
    tiers[recipe.tier]?.push(recipe);
  }

  const result: RecommendedRecipe[] = [];
  for (const tier of ['can_make_now', 'clear_stock', 'need_shopping'] as const) {
    const sorted = (tiers[tier] || []).sort((a, b) => b.score - a.score);
    result.push(...sorted.slice(0, RECOMMEND_CONFIG.topPerTier));
  }

  return result;
}
