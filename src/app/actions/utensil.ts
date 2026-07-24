'use server';

import { createClient } from '@/lib/supabase/server';
import { listUtensils, addUtensil, updateUtensil, deleteUtensil } from '@/lib/services/utensil';
import { revalidatePath } from 'next/cache';

export async function getListUtensils() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  return listUtensils(supabase, user.id);
}

export async function addUtensilAction(item: { name: string; category?: string; note?: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const result = await addUtensil(supabase, user.id, item);
  revalidatePath('/utensils');
  return result;
}

export async function updateUtensilAction(
  id: string,
  updates: { name?: string; category?: string; note?: string }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const result = await updateUtensil(supabase, user.id, id, updates);
  revalidatePath('/utensils');
  return result;
}

export async function deleteUtensilAction(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const result = await deleteUtensil(supabase, user.id, id);
  revalidatePath('/utensils');
  return result;
}
