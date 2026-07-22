/**
 * Inventory Service — A 层核心纯函数
 * 同构纯函数，签名 fn(supabase, userId, args)，不依赖浏览器全局
 * 供 UI (Server Actions) 和二期 Agent 共用
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { InventoryItem, InventoryCategory, StockLevel } from '@/types';

/** 查询库存列表（可按分类筛选） */
export async function listInventory(
  supabase: SupabaseClient,
  userId: string,
  category?: InventoryCategory
): Promise<{ data: InventoryItem[]; error: string | null }> {
  let query = supabase
    .from('inventory')
    .select('*')
    .eq('user_id', userId)
    .order('category')
    .order('name');

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  return { data: data || [], error: error?.message || null };
}

/** 添加食材 */
export async function addInventoryItem(
  supabase: SupabaseClient,
  userId: string,
  item: {
    name: string;
    category: InventoryCategory;
    total_amount?: string;
    stock_level?: StockLevel;
    unit?: string;
    note?: string;
  }
): Promise<{ data: InventoryItem | null; error: string | null }> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('inventory')
    .insert({
      ...item,
      user_id: userId,
      stock_level: item.stock_level || 'enough',
      last_restocked_at:
        item.stock_level === 'out' || item.stock_level === 'low' ? null : now,
    })
    .select()
    .single();

  return { data, error: error?.message || null };
}

/** 更新食材 */
export async function updateInventoryItem(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  updates: Partial<Omit<InventoryItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<{ data: InventoryItem | null; error: string | null }> {
  // 如果 stock_level 被设为 enough，刷新 last_restocked_at
  if (updates.stock_level === 'enough') {
    (updates as Record<string, unknown>).last_restocked_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('inventory')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  return { data, error: error?.message || null };
}

/** 删除食材 */
export async function deleteInventoryItem(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('inventory')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  return { error: error?.message || null };
}

/** 批量更新库存档位 */
export async function batchUpdateStockLevel(
  supabase: SupabaseClient,
  userId: string,
  items: { id: string; stock_level: StockLevel }[]
): Promise<{ error: string | null }> {
  const now = new Date().toISOString();

  for (const item of items) {
    const updates: Record<string, unknown> = { stock_level: item.stock_level };
    if (item.stock_level === 'enough') {
      updates.last_restocked_at = now;
    }

    const { error } = await supabase
      .from('inventory')
      .update(updates)
      .eq('id', item.id)
      .eq('user_id', userId);

    if (error) return { error: error.message };
  }

  return { error: null };
}

/** 做完菜更新食材档位（复用 batchUpdateStockLevel） */
export async function updateStockOnCook(
  supabase: SupabaseClient,
  userId: string,
  updates: { id: string; stock_level: StockLevel }[]
): Promise<{ error: string | null }> {
  return batchUpdateStockLevel(supabase, userId, updates);
}

/** 标记为已补货（购物清单回填用） */
export async function markRestocked(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<{ data: InventoryItem | null; error: string | null }> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('inventory')
    .update({ stock_level: 'enough', last_restocked_at: now })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  return { data, error: error?.message || null };
}

/** 批量标记已补货（购物清单批量回填） */
export async function batchMarkRestocked(
  supabase: SupabaseClient,
  userId: string,
  ids: string[]
): Promise<{ error: string | null }> {
  const now = new Date().toISOString();

  for (const id of ids) {
    const { error } = await supabase
      .from('inventory')
      .update({ stock_level: 'enough', last_restocked_at: now })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) return { error: error.message };
  }

  return { error: null };
}
