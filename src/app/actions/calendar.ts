'use server';

import {
  getCalendarEntries,
  addCalendarEntry,
  completeEntry,
  deleteCalendarEntry,
} from '@/lib/services/calendar';
import { updateStockOnCook } from '@/lib/services/inventory';
import { listRecipes, getRecipeDetail } from '@/lib/services/recipe';
import { getVault } from '@/lib/vault';
import { guardData, guardResult } from '@/lib/utils/error';
import type { CalendarEntry, Recipe } from '@/types';
import { revalidatePath } from 'next/cache';

export async function getCalendarEntriesAction(year: number, month: number) {
  return guardData([] as (CalendarEntry & { recipe?: { name: string } })[], () =>
    getCalendarEntries(getVault(), year, month)
  );
}

export async function addCalendarEntryAction(entry: {
  date: string;
  recipe_id: string;
  status?: 'planned' | 'completed';
  notes?: string;
}) {
  const result = await guardResult(() => addCalendarEntry(getVault(), entry), { data: null });
  revalidatePath('/calendar');
  return result;
}

export async function completeEntryAction(entryId: string) {
  const result = await guardResult(() => completeEntry(getVault(), entryId), { data: null });
  revalidatePath('/calendar');
  return result;
}

export async function deleteCalendarEntryAction(entryId: string) {
  const result = await guardResult(() => deleteCalendarEntry(getVault(), entryId));
  revalidatePath('/calendar');
  return result;
}

export async function updateStockOnCookAction(
  updates: { id: string; stock_level: 'enough' | 'low' | 'out' }[]
) {
  const result = await guardResult(() => updateStockOnCook(getVault(), updates));
  revalidatePath('/inventory');
  revalidatePath('/calendar');
  return result;
}

export async function getRecipesForCalendar() {
  return guardData([] as Recipe[], () => listRecipes(getVault()));
}

export async function getRecipeDetailForCalendar(recipeId: string) {
  return guardData(null, () => getRecipeDetail(getVault(), recipeId));
}
