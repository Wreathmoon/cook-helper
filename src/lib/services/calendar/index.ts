/**
 * Calendar Service — A 层核心纯函数
 * 签名 fn(vault, args)。数据落在 `kitchen/calendar/{YYYY}-{MM}.yaml`，一月一份。
 *
 * 按月分片是为了在粗暴同步（iCloud / Dropbox / git）下少冲突：
 * 改今天的记录不会碰到上个月的文件。
 */
import type { CalendarEntry } from '@/types';
import type { Vault } from '@/lib/vault';
import { assertWritable, generateUlid, monthOf, VaultError, writeCalendarMonth } from '@/lib/vault';

function toMessage(err: unknown): string {
  return err instanceof VaultError ? err.toDisplayString() : (err as Error).message;
}

/** 获取月视图日历条目 */
export async function getCalendarEntries(
  vault: Vault,
  year: number,
  month: number // 1-12
): Promise<{
  data: (CalendarEntry & { recipe?: { name: string } })[];
  error: string | null;
}> {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;

  const data = vault.calendar
    .filter((entry) => entry.date.startsWith(prefix))
    .map((entry) => ({
      ...entry,
      recipe: { name: vault.calendarRecipeNames.get(entry.id) ?? '' },
    }));

  return { data, error: null };
}

/** 新增日历条目 */
export async function addCalendarEntry(
  vault: Vault,
  entry: {
    date: string;
    recipe_id: string;
    status?: 'planned' | 'completed';
    notes?: string;
  }
): Promise<{ data: CalendarEntry | null; error: string | null }> {
  try {
    assertWritable('记录日历');

    const recipe = vault.recipes.find((item) => item.id === entry.recipe_id);
    if (!recipe) return { data: null, error: '菜谱不存在' };

    const now = new Date().toISOString();
    const created: CalendarEntry = {
      id: generateUlid(),
      date: entry.date,
      recipe_id: entry.recipe_id,
      status: entry.status || 'completed',
      notes: entry.notes ?? null,
      created_at: now,
      updated_at: now,
    };

    vault.calendar.push(created);
    vault.calendar.sort((a, b) => a.date.localeCompare(b.date));
    // 文件里按名称引用菜谱，不是 id —— 名称是纯文本世界的关联键
    vault.calendarRecipeNames.set(created.id, recipe.name);

    writeCalendarMonth(vault, monthOf(created.date));
    return { data: created, error: null };
  } catch (err) {
    return { data: null, error: toMessage(err) };
  }
}

/** 标记条目完成 */
export async function completeEntry(
  vault: Vault,
  entryId: string
): Promise<{ data: CalendarEntry | null; error: string | null }> {
  try {
    assertWritable('更新日历');

    const entry = vault.calendar.find((item) => item.id === entryId);
    if (!entry) return { data: null, error: '日历条目不存在' };

    entry.status = 'completed';
    entry.updated_at = new Date().toISOString();

    writeCalendarMonth(vault, monthOf(entry.date));
    return { data: entry, error: null };
  } catch (err) {
    return { data: null, error: toMessage(err) };
  }
}

/** 删除日历条目 */
export async function deleteCalendarEntry(
  vault: Vault,
  entryId: string
): Promise<{ error: string | null }> {
  try {
    assertWritable('删除日历记录');

    const index = vault.calendar.findIndex((item) => item.id === entryId);
    if (index === -1) return { error: '日历条目不存在' };

    const [removed] = vault.calendar.splice(index, 1);
    vault.calendarRecipeNames.delete(removed.id);

    writeCalendarMonth(vault, monthOf(removed.date));
    return { error: null };
  } catch (err) {
    return { error: toMessage(err) };
  }
}
