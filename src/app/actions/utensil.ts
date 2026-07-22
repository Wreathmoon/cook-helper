'use server';

import { createClient } from '@/lib/supabase/server';
import { listUtensils, addUtensil, deleteUtensil } from '@/lib/services/utensil';
import { revalidatePath } from 'next/cache';

export async function getListUtensils() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  return listUtensils(supabase, user.id);
}

export async function addUtensilAction(item: { name: string; note?: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const result = await addUtensil(supabase, user.id, item);
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
