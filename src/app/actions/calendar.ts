'use server';

import { createClient } from '@/lib/supabase/server';
import {
  getCalendarEntries,
  addCalendarEntry,
  completeEntry,
  deleteCalendarEntry,
  uploadCalendarPhoto,
} from '@/lib/services/calendar';
import { updateStockOnCook } from '@/lib/services/inventory';
import { listRecipes, getRecipeDetail } from '@/lib/services/recipe';
import { revalidatePath } from 'next/cache';

export async function getCalendarEntriesAction(year: number, month: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  return getCalendarEntries(supabase, user.id, year, month);
}

export async function addCalendarEntryAction(entry: {
  date: string;
  recipe_id: string;
  status?: 'planned' | 'completed';
  notes?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const result = await addCalendarEntry(supabase, user.id, entry);
  revalidatePath('/calendar');
  return result;
}

export async function completeEntryAction(entryId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const result = await completeEntry(supabase, user.id, entryId);
  revalidatePath('/calendar');
  return result;
}

export async function deleteCalendarEntryAction(entryId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const result = await deleteCalendarEntry(supabase, user.id, entryId);
  revalidatePath('/calendar');
  return result;
}

export async function uploadCalendarPhotoAction(entryId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const file = formData.get('file') as File;
  if (!file) throw new Error('未选择文件');
  const result = await uploadCalendarPhoto(supabase, user.id, entryId, file);
  revalidatePath('/calendar');
  return result;
}

export async function updateStockOnCookAction(
  updates: { id: string; stock_level: 'enough' | 'low' | 'out' }[]
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const result = await updateStockOnCook(supabase, user.id, updates);
  revalidatePath('/inventory');
  revalidatePath('/calendar');
  return result;
}

export async function getRecipesForCalendar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  return listRecipes(supabase, user.id);
}

export async function getRecipeDetailForCalendar(recipeId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  return getRecipeDetail(supabase, user.id, recipeId);
}
