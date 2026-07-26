/**
 * Inventory Service — A 层核心纯函数
 * 签名 fn(vault, args)，不依赖浏览器全局。供 UI (Server Actions) 和二期 Agent 共用。
 *
 * 数据落在 `kitchen/inventory/{分类}.yaml`，一次改动重写整份分类文件——
 * 48 种食材的量级下这比增量写便宜得多，而且 diff 干净（按名称排序）。
 */
import type { InventoryItem, InventoryCategory, StockLevel } from '@/types';
import { normalizeIngredientName } from '@/lib/utils/normalize-name';
import type { Vault } from '@/lib/vault';
import { assertWritable, VaultError, writeInventoryCategory } from '@/lib/vault';

/** 把 VaultError 翻成 `{data, error}` 里的那个 error —— UI 层原样展示 */
function toMessage(err: unknown): string {
  return err instanceof VaultError ? err.toDisplayString() : (err as Error).message;
}

/** 查询库存列表（可按分类筛选）*/
export async function listInventory(
  vault: Vault,
  category?: InventoryCategory
): Promise<{ data: InventoryItem[]; error: string | null }> {
  const data = vault.inventory
    .filter((item) => !category || item.category === category)
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name, 'zh'));

  return { data, error: null };
}

/** 添加食材 */
export async function addInventoryItem(
  vault: Vault,
  item: {
    name: string;
    category: InventoryCategory;
    total_amount?: string;
    stock_level?: StockLevel;
    unit?: string;
    note?: string;
    price?: number;
  }
): Promise<{ data: InventoryItem | null; error: string | null }> {
  try {
    assertWritable('添加食材');

    const id = normalizeIngredientName(item.name, vault.aliases);
    if (!id) return { data: null, error: '食材名称不能为空' };
    if (vault.inventory.some((existing) => existing.id === id)) {
      return { data: null, error: `「${item.name}」已经在库存里了` };
    }

    const now = new Date().toISOString();
    const stockLevel = item.stock_level || 'enough';
    const created: InventoryItem = {
      id,
      name: item.name,
      category: item.category,
      total_amount: item.total_amount ?? null,
      stock_level: stockLevel,
      unit: item.unit ?? null,
      last_restocked_at: stockLevel === 'enough' ? now.slice(0, 10) : null,
      note: item.note ?? null,
      price: item.price ?? null,
      created_at: now,
      updated_at: now,
    };

    vault.inventory.push(created);
    writeInventoryCategory(vault, item.category);
    return { data: created, error: null };
  } catch (err) {
    return { data: null, error: toMessage(err) };
  }
}

/** 更新食材 */
export async function updateInventoryItem(
  vault: Vault,
  id: string,
  updates: Partial<Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>>
): Promise<{ data: InventoryItem | null; error: string | null }> {
  try {
    assertWritable('修改食材');

    const item = vault.inventory.find((existing) => existing.id === id);
    if (!item) return { data: null, error: '食材不存在' };

    const previousCategory = item.category;
    Object.assign(item, updates);

    // stock_level 被设为 enough 视同补货
    if (updates.stock_level === 'enough') {
      item.last_restocked_at = new Date().toISOString().slice(0, 10);
    }
    // 改名会改变关联键（vault 用名称做外键），id 必须跟着走
    if (updates.name) {
      item.id = normalizeIngredientName(updates.name, vault.aliases);
    }
    item.updated_at = new Date().toISOString();

    writeInventoryCategory(vault, item.category);
    if (previousCategory !== item.category) writeInventoryCategory(vault, previousCategory);

    return { data: item, error: null };
  } catch (err) {
    return { data: null, error: toMessage(err) };
  }
}

/** 删除食材 */
export async function deleteInventoryItem(
  vault: Vault,
  id: string
): Promise<{ error: string | null }> {
  try {
    assertWritable('删除食材');

    const index = vault.inventory.findIndex((item) => item.id === id);
    if (index === -1) return { error: '食材不存在' };

    const [removed] = vault.inventory.splice(index, 1);
    writeInventoryCategory(vault, removed.category);
    return { error: null };
  } catch (err) {
    return { error: toMessage(err) };
  }
}

/** 批量更新库存档位 */
export async function batchUpdateStockLevel(
  vault: Vault,
  items: { id: string; stock_level: StockLevel }[]
): Promise<{ error: string | null }> {
  try {
    assertWritable('更新库存');

    const now = new Date().toISOString();
    const touched = new Set<string>();

    for (const change of items) {
      const item = vault.inventory.find((existing) => existing.id === change.id);
      if (!item) continue;

      item.stock_level = change.stock_level;
      if (change.stock_level === 'enough') item.last_restocked_at = now.slice(0, 10);
      item.updated_at = now;
      touched.add(item.category);
    }

    for (const category of touched) writeInventoryCategory(vault, category);
    return { error: null };
  } catch (err) {
    return { error: toMessage(err) };
  }
}

/** 做完菜更新食材档位（复用 batchUpdateStockLevel）*/
export async function updateStockOnCook(
  vault: Vault,
  updates: { id: string; stock_level: StockLevel }[]
): Promise<{ error: string | null }> {
  return batchUpdateStockLevel(vault, updates);
}

/** 标记为已补货（购物清单回填用）*/
export async function markRestocked(
  vault: Vault,
  id: string
): Promise<{ data: InventoryItem | null; error: string | null }> {
  const result = await batchUpdateStockLevel(vault, [{ id, stock_level: 'enough' }]);
  if (result.error) return { data: null, error: result.error };
  return { data: vault.inventory.find((item) => item.id === id) ?? null, error: null };
}

/** 批量标记已补货（购物清单批量回填）*/
export async function batchMarkRestocked(
  vault: Vault,
  ids: string[]
): Promise<{ error: string | null }> {
  if (ids.length === 0) return { error: null };
  return batchUpdateStockLevel(
    vault,
    ids.map((id) => ({ id, stock_level: 'enough' as StockLevel }))
  );
}
