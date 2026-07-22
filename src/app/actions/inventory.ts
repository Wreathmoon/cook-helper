'use server';

import { createClient } from '@/lib/supabase/server';
import {
  listInventory,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  batchUpdateStockLevel,
} from '@/lib/services/inventory';
import { revalidatePath } from 'next/cache';

export async function getListInventory(category?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const result = await listInventory(supabase, user.id, category as any);
  return result;
}

export async function addInventoryItemAction(item: {
  name: string;
  category: string;
  total_amount?: string;
  stock_level?: string;
  unit?: string;
  note?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const result = await addInventoryItem(supabase, user.id, item as any);
  revalidatePath('/inventory');
  return result;
}

export async function updateInventoryItemAction(
  id: string,
  updates: Record<string, unknown>
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const result = await updateInventoryItem(supabase, user.id, id, updates as any);
  revalidatePath('/inventory');
  return result;
}

export async function deleteInventoryItemAction(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const result = await deleteInventoryItem(supabase, user.id, id);
  revalidatePath('/inventory');
  return result;
}

export async function batchUpdateStockLevelAction(
  items: { id: string; stock_level: string }[]
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const result = await batchUpdateStockLevel(
    supabase,
    user.id,
    items as any
  );
  revalidatePath('/inventory');
  return result;
}
