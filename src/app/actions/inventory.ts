'use server';

import {
  listInventory,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  batchUpdateStockLevel,
} from '@/lib/services/inventory';
import { getVault } from '@/lib/vault';
import { guardData, guardResult } from '@/lib/utils/error';
import type { InventoryCategory, InventoryItem, StockLevel } from '@/types';
import { revalidatePath } from 'next/cache';

export async function getListInventory(category?: string) {
  return guardData([] as InventoryItem[], () =>
    listInventory(getVault(), category as InventoryCategory | undefined)
  );
}

export async function addInventoryItemAction(item: {
  name: string;
  category: string;
  total_amount?: string;
  stock_level?: string;
  unit?: string;
  note?: string;
}) {
  const result = await guardResult(
    () =>
      addInventoryItem(getVault(), {
        ...item,
        category: item.category as InventoryCategory,
        stock_level: item.stock_level as StockLevel | undefined,
      }),
    { data: null }
  );
  revalidatePath('/inventory');
  return result;
}

export async function updateInventoryItemAction(id: string, updates: Record<string, unknown>) {
  const result = await guardResult(
    () =>
      updateInventoryItem(
        getVault(),
        id,
        updates as Partial<Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>>
      ),
    { data: null }
  );
  revalidatePath('/inventory');
  return result;
}

export async function deleteInventoryItemAction(id: string) {
  const result = await guardResult(() => deleteInventoryItem(getVault(), id));
  revalidatePath('/inventory');
  return result;
}

export async function batchUpdateStockLevelAction(items: { id: string; stock_level: string }[]) {
  const result = await guardResult(() =>
    batchUpdateStockLevel(getVault(), items as { id: string; stock_level: StockLevel }[])
  );
  revalidatePath('/inventory');
  return result;
}
