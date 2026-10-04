/**
 * 命令层提案的落库 —— A 层，签名 `fn(vault, args)`。
 *
 * **撤销复用 Task/11 的 `CaptureSnapshot` 与 `undoCapture()`，不另写一份。**
 * 理由不只是省代码：撤销的正确性有一条很容易漏的性质（回滚必须连
 * `last_restocked_at` 一起恢复，否则食材会静默退出「清库存」档），
 * 这种性质**只要存在第二份实现，就一定会有一份是错的**。
 *
 * 于是命令栏和拍照录入在用户眼里也是同一套东西：提案 → 确认 → 落库 → 可撤销。
 */
import type { StockLevel } from '@/types';
import { batchUpdateStockLevel } from '@/lib/services/inventory';
import { addCalendarEntry } from '@/lib/services/calendar';
import type { CaptureSnapshot } from '@/lib/services/capture';
import { normalizeIngredientName } from '@/lib/utils/normalize-name';
import type { Vault } from '@/lib/vault';
import { assertWritable, VaultError } from '@/lib/vault';

function toMessage(err: unknown): string {
  return err instanceof VaultError ? err.toDisplayString() : (err as Error).message;
}

/** 模型提出的一条改动，已经过用户确认 */
export type ConfirmedChange =
  | { kind: 'calendar'; date: string; recipe_id: string; recipe_name: string; status: 'planned' | 'completed' }
  | { kind: 'stock'; name: string; stock_level: StockLevel };

/**
 * 落库一份确认过的提案。
 *
 * 和 `applyInventoryDecisions` 一样：**中途失败也返回快照**，
 * 已经写进去的部分必须可撤销。
 */
export async function applyProposal(
  vault: Vault,
  changes: ConfirmedChange[]
): Promise<{ data: CaptureSnapshot; error: string | null }> {
  const snapshot: CaptureSnapshot = { restore: [], added: [], calendarEntries: [] };

  try {
    assertWritable('执行改动');

    for (const change of changes) {
      if (change.kind === 'calendar') {
        const result = await addCalendarEntry(vault, {
          date: change.date,
          recipe_id: change.recipe_id,
          status: change.status,
        });
        if (result.error) return { data: snapshot, error: result.error };
        if (result.data) snapshot.calendarEntries.push(result.data.id);
        continue;
      }

      // 模型给的是名字，落库要的是归一化后的关联键（走别名表）
      const id = normalizeIngredientName(change.name, vault.aliases);
      const item = vault.inventory.find((existing) => existing.id === id);
      // **库存里没有的不新增**——命令栏是「加速已有操作」，凭一句话往库存里
      // 添新食材是 Task/11 拍照录入那条路径的活，那里有专门的分类确认
      if (!item) {
        return { data: snapshot, error: `库存里没有「${change.name}」，先去食材页或用 AI 录入添加` };
      }

      snapshot.restore.push({
        id: item.id,
        stock_level: item.stock_level,
        last_restocked_at: item.last_restocked_at,
      });
      const result = await batchUpdateStockLevel(vault, [
        { id: item.id, stock_level: change.stock_level },
      ]);
      if (result.error) return { data: snapshot, error: result.error };
    }

    return { data: snapshot, error: null };
  } catch (err) {
    return { data: snapshot, error: toMessage(err) };
  }
}

/**
 * 校验模型的提案：菜谱 id 存在吗、食材在库存里吗。
 *
 * **在给用户看之前就查**。让一条引用了不存在菜谱的提案走到确认屏，
 * 用户点了确认才报错——那是把模型的幻觉转嫁成用户的挫败感。
 */
export function validateProposal(
  vault: Vault,
  changes: ConfirmedChange[]
): { valid: ConfirmedChange[]; rejected: { change: ConfirmedChange; why: string }[] } {
  const valid: ConfirmedChange[] = [];
  const rejected: { change: ConfirmedChange; why: string }[] = [];

  for (const change of changes) {
    if (change.kind === 'calendar') {
      if (!vault.recipes.some((item) => item.id === change.recipe_id)) {
        rejected.push({ change, why: `菜谱「${change.recipe_name}」不存在（模型可能编了 id）` });
        continue;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(change.date)) {
        rejected.push({ change, why: `日期「${change.date}」格式不对` });
        continue;
      }
    } else {
      const id = normalizeIngredientName(change.name, vault.aliases);
      if (!vault.inventory.some((item) => item.id === id)) {
        rejected.push({ change, why: `库存里没有「${change.name}」` });
        continue;
      }
    }
    valid.push(change);
  }

  return { valid, rejected };
}
