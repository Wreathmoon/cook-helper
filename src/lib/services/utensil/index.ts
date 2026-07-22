/**
 * Utensil Service — A 层核心纯函数
 * 同构纯函数，签名 fn(supabase, userId, args)，不依赖浏览器全局
 * 供 UI (Server Actions) 和二期 Agent 共用
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Utensil } from '@/types';

/** 查询厨具列表 */
export async function listUtensils(
  supabase: SupabaseClient,
  userId: string
): Promise<{ data: Utensil[]; error: string | null }> {
  const { data, error } = await supabase
    .from('utensils')
    .select('*')
    .eq('user_id', userId)
    .order('name');

  return { data: data || [], error: error?.message || null };
}

/** 添加厨具 */
export async function addUtensil(
  supabase: SupabaseClient,
  userId: string,
  item: { name: string; note?: string }
): Promise<{ data: Utensil | null; error: string | null }> {
  const { data, error } = await supabase
    .from('utensils')
    .insert({ ...item, user_id: userId })
    .select()
    .single();

  return { data, error: error?.message || null };
}

/** 删除厨具 */
export async function deleteUtensil(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('utensils')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  return { error: error?.message || null };
}
