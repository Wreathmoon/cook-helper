/**
 * Shopping Service — A 层核心纯函数
 * 签名 fn(vault, args)。
 *
 * 这一层没有自己的存储：购物清单是**算出来的**，不是存下来的
 * （库存档位 + 选中菜谱的食材 → 缺什么）。回填时才写库存。
 */
import type { ShoppingListItem, InventoryCategory } from '@/types';
import type { Vault } from '@/lib/vault';
import { batchMarkRestocked } from '../inventory';

/**
 * 生成购物清单
 * 逻辑：
 * 1. 选中菜谱的食材里，库存 low/out 的
 * 2. 选中菜谱要用但没有的厨具
 * 3. 自动添加 low/out 的调料/主食/蛋奶（这几类断了最影响做饭）
 * 4. 可选：把日历上「计划中」的菜谱也算进来
 */
export async function generateShoppingList(
  vault: Vault,
  selectedRecipeIds: string[],
  includePlannedRecipes: boolean = false
): Promise<{ data: ShoppingListItem[]; error: string | null }> {
  const items: ShoppingListItem[] = [];
  const inventoryMap = new Map(vault.inventory.map((item) => [item.id, item]));
  const recipeNames = new Map(vault.recipes.map((recipe) => [recipe.id, recipe.name]));

  const collectMissing = (recipeId: string, sourcePrefix = '') => {
    const recipeName = recipeNames.get(recipeId) ?? '未知菜谱';
    for (const ing of vault.recipeIngredients.get(recipeId) ?? []) {
      const invItem = inventoryMap.get(ing.inventory_id);
      if (invItem && invItem.stock_level === 'enough') continue;

      const alreadyInList = items.some((item) => item.inventoryId === (invItem?.id ?? ing.inventory_id));
      if (alreadyInList) continue;

      items.push({
        // 库存里没有这样食材时，菜谱写的名字本身就是最好的提示
        name: invItem?.name ?? ing.inventory_id,
        category: (invItem?.category ?? 'vegetable') as InventoryCategory,
        source: `${sourcePrefix}${recipeName}`,
        suggestedAmount: ing.amount,
        inventoryId: invItem?.id ?? ing.inventory_id,
        price: invItem?.price ?? undefined,
      });
    }
  };

  // 1 + 2. 选中的菜谱
  if (selectedRecipeIds.length > 0) {
    const ownedUtensils = new Set(vault.utensils.map((utensil) => utensil.name));

    for (const recipeId of selectedRecipeIds) {
      collectMissing(recipeId);

      for (const utensilName of vault.recipeUtensils.get(recipeId) ?? []) {
        if (ownedUtensils.has(utensilName)) continue;
        if (items.some((item) => item.name === utensilName)) continue;
        items.push({
          name: utensilName,
          category: 'staple' as InventoryCategory, // 厨具归到主食/干货，方便按分类展示
          source: recipeNames.get(recipeId) ?? '未知菜谱',
        });
      }
    }
  }

  // 3. 库存不足的调料/主食/蛋奶
  const alwaysRestock: InventoryCategory[] = ['seasoning', 'staple', 'egg_dairy_bean'];
  for (const item of vault.inventory) {
    if (!alwaysRestock.includes(item.category)) continue;
    if (item.stock_level === 'enough') continue;
    if (items.some((existing) => existing.inventoryId === item.id)) continue;

    items.push({
      name: item.name,
      category: item.category,
      source: '库存不足',
      inventoryId: item.id,
      price: item.price ?? undefined,
    });
  }

  // 4. 计划中的菜谱
  if (includePlannedRecipes) {
    const today = new Date().toISOString().slice(0, 10);
    const plannedRecipeIds = vault.calendar
      .filter((entry) => entry.status === 'planned' && entry.date >= today)
      .map((entry) => entry.recipe_id)
      .filter((id) => id && !selectedRecipeIds.includes(id));

    for (const recipeId of new Set(plannedRecipeIds)) {
      collectMissing(recipeId, '计划: ');
    }
  }

  return { data: items, error: null };
}

/** 购物清单回填（勾选已采购的项 → 标记为 enough）*/
export async function checkoutShoppingList(
  vault: Vault,
  checkedInventoryIds: string[]
): Promise<{ error: string | null }> {
  if (checkedInventoryIds.length === 0) return { error: null };
  return batchMarkRestocked(vault, checkedInventoryIds);
}
