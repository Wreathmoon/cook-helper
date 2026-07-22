import { seedIngredients, seedRecipes } from '@/lib/seed/seed-data';

/**
 * 种子复制 — 新用户注册初始化
 *
 * 新用户注册成功后调用，将种子食材和菜谱复制到用户账户下。
 * 注意：此函数必须使用 service_role client 调用，因为要绕过 RLS 读写种子数据。
 */
export async function initUserFromSeed(
  serviceRoleSupabase: any, // SupabaseClient with service_role
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const idMap = new Map<string, string>(); // 食材名 → 新 inventory_id
    const now = new Date().toISOString();

    // 1. 复制种子 inventory
    // 初始档位混合策略（使用确定性 hash，不用随机数）：
    // - 调料/主食 → 全部 enough
    // - 蔬菜 → 60% enough / 25% low / 15% out
    // - 肉类 → 50% enough / 30% low / 20% out
    // - 蛋奶豆 → 70% enough / 20% low / 10% out
    for (const ingredient of seedIngredients) {
      let stockLevel: 'enough' | 'low' | 'out' = 'enough';
      const hash = simpleHash(ingredient.name);

      if (ingredient.category === 'seasoning' || ingredient.category === 'staple') {
        stockLevel = 'enough';
      } else if (ingredient.category === 'vegetable') {
        if (hash % 100 < 60) stockLevel = 'enough';
        else if (hash % 100 < 85) stockLevel = 'low';
        else stockLevel = 'out';
      } else if (ingredient.category === 'meat') {
        if (hash % 100 < 50) stockLevel = 'enough';
        else if (hash % 100 < 80) stockLevel = 'low';
        else stockLevel = 'out';
      } else if (ingredient.category === 'egg_dairy_bean') {
        if (hash % 100 < 70) stockLevel = 'enough';
        else if (hash % 100 < 90) stockLevel = 'low';
        else stockLevel = 'out';
      }

      const { data: newItem, error } = await serviceRoleSupabase
        .from('inventory')
        .insert({
          user_id: userId,
          name: ingredient.name,
          category: ingredient.category,
          stock_level: stockLevel,
          unit: ingredient.unit || null,
          last_restocked_at: stockLevel === 'enough' ? now : null,
        })
        .select()
        .single();

      if (error) throw error;
      idMap.set(ingredient.name, newItem.id);
    }

    // 2. 复制种子 recipes
    for (const seedRecipe of seedRecipes) {
      const { data: recipe, error: recipeError } = await serviceRoleSupabase
        .from('recipes')
        .insert({
          user_id: userId,
          name: seedRecipe.name,
          steps: seedRecipe.steps || null,
          cook_time_minutes: seedRecipe.cook_time_minutes || null,
          difficulty: seedRecipe.difficulty || null,
          attributes: seedRecipe.attributes || {},
          tips: seedRecipe.tips || null,
        })
        .select()
        .single();

      if (recipeError) throw recipeError;

      // 3. 复制 recipe_ingredients，重映射 inventory_id
      const ingredientsToInsert = seedRecipe.ingredients
        .map(ing => {
          const inventoryId = idMap.get(ing.name);
          if (!inventoryId) return null; // 种子中没有该食材，跳过
          return {
            recipe_id: recipe.id,
            inventory_id: inventoryId,
            role: ing.role,
            amount: ing.amount || null,
          };
        })
        .filter(Boolean);

      if (ingredientsToInsert.length > 0) {
        const { error: ingError } = await serviceRoleSupabase
          .from('recipe_ingredients')
          .insert(ingredientsToInsert);
        if (ingError) throw ingError;
      }

      // 4. 复制 recipe_utensils
      if (seedRecipe.utensils && seedRecipe.utensils.length > 0) {
        const { error: utError } = await serviceRoleSupabase
          .from('recipe_utensils')
          .insert(
            seedRecipe.utensils.map(name => ({
              recipe_id: recipe.id,
              utensil_name: name,
            }))
          );
        if (utError) throw utError;
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('Seed initialization failed:', error);
    return { success: false, error: error.message };
  }
}

/** 简单 hash 函数，用于确定性地决定初始档位 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}
