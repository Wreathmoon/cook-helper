'use server';

import { listUtensils, addUtensil, updateUtensil, deleteUtensil } from '@/lib/services/utensil';
import { getVault } from '@/lib/vault';
import { guardData, guardResult } from '@/lib/utils/error';
import type { Utensil } from '@/types';
import { revalidatePath } from 'next/cache';

export async function getListUtensils() {
  return guardData([] as Utensil[], () => listUtensils(getVault()));
}

export async function addUtensilAction(item: { name: string; category?: string; note?: string }) {
  const result = await guardResult(() => addUtensil(getVault(), item), { data: null });
  revalidatePath('/utensils');
  return result;
}

export async function updateUtensilAction(
  id: string,
  updates: { name?: string; category?: string; note?: string }
) {
  const result = await guardResult(() => updateUtensil(getVault(), id, updates), { data: null });
  revalidatePath('/utensils');
  return result;
}

export async function deleteUtensilAction(id: string) {
  const result = await guardResult(() => deleteUtensil(getVault(), id));
  revalidatePath('/utensils');
  return result;
}
