/**
 * Calendar Service — A 层核心纯函数
 * 同构纯函数，签名 fn(supabase, userId, args)，不依赖浏览器全局
 * 供 UI (Server Actions) 和二期 Agent 共用
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CalendarEntry, CalendarPhoto } from '@/types';

/** 获取月视图日历条目 */
export async function getCalendarEntries(
  supabase: SupabaseClient,
  userId: string,
  year: number,
  month: number // 1-12
): Promise<{
  data: (CalendarEntry & { recipe?: { name: string } })[];
  error: string | null;
}> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('calendar_entries')
    .select('*, recipe:recipe_id(name)')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lt('date', endDate)
    .order('date');

  return { data: data || [], error: error?.message || null };
}

/** 新增日历条目 */
export async function addCalendarEntry(
  supabase: SupabaseClient,
  userId: string,
  entry: {
    date: string;
    recipe_id: string;
    status?: 'planned' | 'completed';
    notes?: string;
  }
): Promise<{ data: CalendarEntry | null; error: string | null }> {
  const { data, error } = await supabase
    .from('calendar_entries')
    .insert({
      ...entry,
      user_id: userId,
      status: entry.status || 'completed',
    })
    .select()
    .single();

  return { data, error: error?.message || null };
}

/** 标记条目完成 */
export async function completeEntry(
  supabase: SupabaseClient,
  userId: string,
  entryId: string
): Promise<{ data: CalendarEntry | null; error: string | null }> {
  const { data, error } = await supabase
    .from('calendar_entries')
    .update({ status: 'completed' })
    .eq('id', entryId)
    .eq('user_id', userId)
    .select()
    .single();

  return { data, error: error?.message || null };
}

/** 上传日历照片 */
export async function uploadCalendarPhoto(
  supabase: SupabaseClient,
  userId: string,
  entryId: string,
  file: File
): Promise<{ data: CalendarPhoto | null; error: string | null }> {
  const ext = file.name.split('.').pop();
  const path = `${userId}/${entryId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('calendar-photos')
    .upload(path, file);

  if (uploadError) return { data: null, error: uploadError.message };

  const { data: photo, error: photoError } = await supabase
    .from('calendar_photos')
    .insert({ calendar_entry_id: entryId, storage_path: path })
    .select()
    .single();

  return { data: photo, error: photoError?.message || null };
}

/** 删除日历条目 */
export async function deleteCalendarEntry(
  supabase: SupabaseClient,
  userId: string,
  entryId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('calendar_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', userId);

  return { error: error?.message || null };
}
