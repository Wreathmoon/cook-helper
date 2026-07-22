/**
 * Shopping Service — A 层核心纯函数
 * 同构纯函数，签名 fn(supabase, userId, args)，不依赖浏览器全局
 * 供 UI (Server Actions) 和二期 Agent 共用
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ShoppingListItem, InventoryCategory } from '@/types';
import { batchMarkRestocked } from '../inventory';

/**
 * 生成购物清单
 * 逻辑：
 * 1. 获取用户所有库存
 * 2. 获取选中菜谱的食材需求，筛选 stock_level 为 low/out 的
 * 3. 检查厨具是否缺失
 * 4. 自动添加 low/out 的调料/主食/蛋奶
 * 5. 可选：包含计划中菜谱的缺失食材
 */
export async function generateShoppingList(
  supabase: SupabaseClient,
  userId: string,
  selectedRecipeIds: string[],
  includePlannedRecipes: boolean = false
): Promise<{ data: ShoppingListItem[]; error: string | null }> {
  const items: ShoppingListItem[] = [];

  // 1. 获取用户所有库存
  const { data: inventory, error: invError } = await supabase
    .from('inventory')
    .select('*')
    .eq('user_id', userId);

  if (invError || !inventory) {
    return { data: [], error: '获取库存失败' };
  }

  const inventoryMap = new Map(inventory.map((i) => [i.id, i]));

  // 2. 获取选中菜谱的食材需求
  if (selectedRecipeIds.length > 0) {
    const { data: recipeIngredients } = await supabase
      .from('recipe_ingredients')
      .select('*, recipes!inner(name)')
      .in('recipe_id', selectedRecipeIds);

    if (recipeIngredients) {
      for (const ri of recipeIngredients) {
        const invItem = inventoryMap.get(ri.inventory_id);
        if (!invItem || invItem.stock_level === 'out' || invItem.stock_level === 'low') {
          const recipeName = (ri as Record<string, unknown>).recipes
            ? ((ri as Record<string, unknown>).recipes as Record<string, string>).name
            : '未知菜谱';
          items.push({
            name: invItem?.name || '未知食材',
            category: (invItem?.category || 'vegetable') as InventoryCategory,
            source: recipeName,
            suggestedAmount: ri.amount || undefined,
            inventoryId: invItem?.id,
          });
        }
      }
    }

    // 检查厨具是否缺失
    const { data: recipeUtensils } = await supabase
      .from('recipe_utensils')
      .select('*, recipes!inner(name)')
      .in('recipe_id', selectedRecipeIds);

    const { data: userUtensils } = await supabase
      .from('utensils')
      .select('name')
      .eq('user_id', userId);

    const ownedUtensils = new Set((userUtensils || []).map((u) => u.name));

    if (recipeUtensils) {
      for (const ru of recipeUtensils) {
        if (!ownedUtensils.has(ru.utensil_name)) {
          const recipeName = (ru as Record<string, unknown>).recipes
            ? ((ru as Record<string, unknown>).recipes as Record<string, string>).name
            : '未知菜谱';
          items.push({
            name: ru.utensil_name,
            category: 'staple' as InventoryCategory, // 厨具归类为主食/干货方便展示
            source: recipeName,
          });
        }
      }
    }
  }

  // 3. 添加库存不足的调料/主食/蛋奶（low/out 的）
  const lowStockCategories: InventoryCategory[] = ['seasoning', 'staple', 'egg_dairy_bean'];
  for (const inv of inventory) {
    if (
      lowStockCategories.includes(inv.category as InventoryCategory) &&
      (inv.stock_level === 'low' || inv.stock_level === 'out')
    ) {
      // 避免重复
      const alreadyInList = items.some((i) => i.inventoryId === inv.id);
      if (!alreadyInList) {
        items.push({
          name: inv.name,
          category: inv.category as InventoryCategory,
          source: '库存不足',
          inventoryId: inv.id,
        });
      }
    }
  }

  // 4. 可选：包含计划中的菜谱的缺失食材
  if (includePlannedRecipes) {
    const { data: plannedEntries } = await supabase
      .from('calendar_entries')
      .select('recipe_id')
      .eq('user_id', userId)
      .eq('status', 'planned')
      .gte('date', new Date().toISOString().split('T')[0]);

    if (plannedEntries && plannedEntries.length > 0) {
      const plannedRecipeIds = plannedEntries
        .map((e) => e.recipe_id)
        .filter((id) => !selectedRecipeIds.includes(id));

      if (plannedRecipeIds.length > 0) {
        const { data: plannedIngredients } = await supabase
          .from('recipe_ingredients')
          .select('*, recipes!inner(name)')
          .in('recipe_id', plannedRecipeIds);

        if (plannedIngredients) {
          for (const ri of plannedIngredients) {
            const invItem = inventoryMap.get(ri.inventory_id);
            if (!invItem || invItem.stock_level === 'out' || invItem.stock_level === 'low') {
              const alreadyInList = items.some((i) => i.inventoryId === invItem?.id);
              if (!alreadyInList) {
                const recipeName = (ri as Record<string, unknown>).recipes
                  ? ((ri as Record<string, unknown>).recipes as Record<string, string>).name
                  : '未知菜谱';
                items.push({
                  name: invItem?.name || '未知食材',
                  category: (invItem?.category || 'vegetable') as InventoryCategory,
                  source: `计划: ${recipeName}`,
                  suggestedAmount: ri.amount || undefined,
                  inventoryId: invItem?.id,
                });
              }
            }
          }
        }
      }
    }
  }

  return { data: items, error: null };
}

/** 购物清单回填（勾选已采购的项 → 标记为 enough） */
export async function checkoutShoppingList(
  supabase: SupabaseClient,
  userId: string,
  checkedInventoryIds: string[]
): Promise<{ error: string | null }> {
  if (checkedInventoryIds.length === 0) return { error: null };
  return batchMarkRestocked(supabase, userId, checkedInventoryIds);
}
