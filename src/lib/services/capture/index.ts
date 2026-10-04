/**
 * Capture Service —— A 层。签名 `fn(vault, args)`，与其它 service 一致。
 *
 * 职责是**抽取结果 → 待确认提案 → 落库 → 可撤销**这条链上中间的三段。
 * 它不认识模型（`src/lib/ai/` 才认识），只认识 vault。
 *
 * 三条边界（Task/11 决策 ⑦⑧⑨）：
 *
 * 1. **提案不写库。** `buildXxxProposal` 是纯函数，不碰磁盘。用户没点确认之前，
 *    vault 里不该有任何变化——AI 批量写库存是破坏性操作，而库存质量就是推荐质量。
 * 2. **归一化在这里做，不在模型里做。** 模型只负责把名字读出来。
 * 3. **落库返回快照。** 快照是撤销的全部依据，即使中途失败也要把「已经做成的部分」
 *    还给调用方——否则用户会卡在一个改了一半、又撤不回去的状态里。
 */
import type { InventoryCategory, InventoryItem, StockLevel } from '@/types';
import {
  addInventoryItem,
  batchUpdateStockLevel,
  deleteInventoryItem,
  restoreInventoryState,
} from '@/lib/services/inventory';
import { addCalendarEntry, deleteCalendarEntry } from '@/lib/services/calendar';
import { normalizeIngredientName } from '@/lib/utils/normalize-name';
import type { Vault } from '@/lib/vault';
import { assertWritable, VaultError } from '@/lib/vault';

function toMessage(err: unknown): string {
  return err instanceof VaultError ? err.toDisplayString() : (err as Error).message;
}

// ---------------------------------------------------------------- 类型

export interface ProposedIngredient {
  /** 归一化后的关联键，等于 `InventoryItem.id` */
  id: string;
  /** 模型读出来的原文。和 `name` 不同时要显示给用户看——这是别名表在起作用的证据 */
  rawName: string;
  /** 归一化后的规范名 */
  name: string;
  category: InventoryCategory;
  /** 当前档位。`null` 表示库存里还没有这样食材 */
  currentLevel: StockLevel | null;
  /** 建议改成的档位 */
  suggestedLevel: StockLevel;
}

export interface InventoryProposal {
  /** 已经在库存里的：改档位 */
  existing: ProposedIngredient[];
  /** 库存里没有的：新增。**必须让用户确认分类**（决策 ⑧）*/
  fresh: ProposedIngredient[];
}

export interface CookedProposal {
  /** 模型读出来的菜名原文 */
  rawName: string;
  /** 匹配到的菜谱。`null` = 没匹配上，**让用户从 candidates 里选**，不猜（决策 ⑭）*/
  matched: { id: string; name: string } | null;
  /** 没匹配上时给的候选列表（全部菜谱）*/
  candidates: { id: string; name: string }[];
  /** 该菜谱的主要食材及当前档位 */
  ingredients: ProposedIngredient[];
}

/** 用户在确认界面上最终决定的一条 */
export interface CaptureDecision {
  id: string;
  name: string;
  category: InventoryCategory;
  stock_level: StockLevel;
  /** 是不是新增食材 */
  isNew: boolean;
}

/**
 * 撤销快照 —— 决策 ⑨。
 *
 * **只活在当前页面会话里**，不落盘、不做撤销栈。真正的后悔药是 vault 本身
 * （纯文本 + git，FUTURE.md §1.6 ①）；这里只是省掉一次「打开文件手动改回去」。
 */
export interface CaptureSnapshot {
  /**
   * 改过档位的食材的**旧值**，撤销时写回去。
   *
   * ⚠️ 必须连 `last_restocked_at` 一起存。只存 `stock_level` 的话，撤销会把补货日期
   * 盖成今天，让一样放了很久的食材**静默退出「清库存」推荐档**——
   * 详见 `restoreInventoryState()` 的注释。
   */
  restore: { id: string; stock_level: StockLevel; last_restocked_at: string | null }[];
  /** 新增的食材 id，撤销时删掉 */
  added: string[];
  /** 新增的日历条目 id，撤销时删掉 */
  calendarEntries: string[];
}

function emptySnapshot(): CaptureSnapshot {
  return { restore: [], added: [], calendarEntries: [] };
}

// ---------------------------------------------------------------- 提案

/**
 * 食材候选 → 提案。**纯函数，不写盘。**
 *
 * 做三件事：归一化、去重、按「库存里有没有」分成两组。
 */
export function buildInventoryProposal(
  vault: Vault,
  captures: { name: string; category: InventoryCategory }[],
  options: { suggestedLevel?: StockLevel } = {}
): InventoryProposal {
  const suggestedLevel = options.suggestedLevel ?? 'enough';
  const byId = new Map<string, ProposedIngredient>();

  for (const capture of captures) {
    const name = normalizeIngredientName(capture.name, vault.aliases);
    // 归一化后是空的（模型吐了个空串或纯空白）就丢掉——它没法做关联键
    if (!name) continue;

    // 去重：模型可能把同一样东西写两遍，别名表也可能把两个不同的原文归到同一个键上
    // （「西红柿」和「番茄」）。**先到的那条赢**，后面的直接跳过
    if (byId.has(name)) continue;

    const existing = vault.inventory.find((item) => item.id === name);
    byId.set(name, {
      id: name,
      rawName: capture.name,
      name,
      // 已在库存里的，**分类以库存为准**——用户当初分好的类，不该被模型的一次猜测改掉
      category: existing?.category ?? capture.category,
      currentLevel: existing?.stock_level ?? null,
      suggestedLevel,
    });
  }

  const all = [...byId.values()];
  return {
    existing: all.filter((item) => item.currentLevel !== null),
    fresh: all.filter((item) => item.currentLevel === null),
  };
}

/**
 * 菜名 → 菜谱匹配 + 该菜的主要食材。
 *
 * 匹配只做两步：**原样精确**，再**字面归一化后精确**（全角转半角、空格合并）。
 * 到此为止——**不做模糊匹配**（决策 ⑭）。「红烧肉」在有「红烧肉」和「红烧排骨」时
 * 猜错，代价是往日历里写一条假记录，而日历历史正是「不重样」推荐的输入。
 *
 * ⚠️ 归一化时**不传别名表**：别名表是给食材用的，拿它去套菜名会制造离奇的错配。
 */
export function buildCookedProposal(vault: Vault, rawName: string): CookedProposal {
  const candidates = vault.recipes.map((item) => ({ id: item.id, name: item.name }));

  const exact = vault.recipes.find((item) => item.name === rawName);
  const normalized = normalizeIngredientName(rawName);
  const loose = exact ?? vault.recipes.find((item) => normalizeIngredientName(item.name) === normalized);

  if (!loose) return { rawName, matched: null, candidates, ingredients: [] };

  return {
    rawName,
    matched: { id: loose.id, name: loose.name },
    candidates,
    ingredients: mainIngredientsOf(vault, loose.id),
  };
}

/**
 * 某道菜的主要食材 + 当前档位。
 *
 * **只取 `role === 'main'`**，与手动路径（`src/app/calendar/page.tsx`
 * 的 `handleFetchDoneIngredients`）保持一致——两条路径给出不一样的食材列表，
 * 会让用户觉得 AI 那条「漏了东西」。
 *
 * ⚠️ **建议档位就是当前档位，不猜下降。** 做过一顿饭不代表食材就少了一档
 * （2kg 米做一次饭还是 enough），而一个经常是错的建议会训练用户无视确认屏——
 * 那比不给建议更糟。这一场景 AI 省掉的是「开弹窗、选日期、搜菜谱、标完成」，
 * 不是「替你决定还剩多少」。
 */
export function mainIngredientsOf(vault: Vault, recipeId: string): ProposedIngredient[] {
  const links = vault.recipeIngredients.get(recipeId) ?? [];
  const result: ProposedIngredient[] = [];

  for (const link of links) {
    if (link.role !== 'main') continue;
    const item = vault.inventory.find((existing) => existing.id === link.inventory_id);
    // 库存里没有这样食材（菜谱引用了一个没入库的东西）——跳过，
    // 「做完饭」不该顺手替用户新增食材，那是拍照录入的活
    if (!item) continue;

    result.push({
      id: item.id,
      rawName: item.name,
      name: item.name,
      category: item.category,
      currentLevel: item.stock_level,
      suggestedLevel: item.stock_level,
    });
  }

  return result;
}

// ---------------------------------------------------------------- 落库

/**
 * 应用用户确认过的决定，返回撤销快照。
 *
 * ⚠️ **中途失败也返回快照**：已经写进去的那部分必须可撤销。返回
 * `{ data: 到目前为止做了什么, error: 哪一步炸了 }`，UI 两个都要用。
 */
export async function applyInventoryDecisions(
  vault: Vault,
  decisions: CaptureDecision[]
): Promise<{ data: CaptureSnapshot; error: string | null }> {
  const snapshot = emptySnapshot();

  try {
    assertWritable('录入食材');

    for (const decision of decisions.filter((item) => item.isNew)) {
      const result = await addInventoryItem(vault, {
        name: decision.name,
        category: decision.category,
        stock_level: decision.stock_level,
      });
      if (result.error) return { data: snapshot, error: result.error };
      if (result.data) snapshot.added.push(result.data.id);
    }

    const updates = decisions.filter((item) => !item.isNew);
    // 先记旧值再改——顺序反了快照里存的就是新值，撤销等于没撤
    snapshot.restore.push(...levelsOf(vault, updates.map((item) => item.id)));

    if (updates.length > 0) {
      const result = await batchUpdateStockLevel(
        vault,
        updates.map((item) => ({ id: item.id, stock_level: item.stock_level }))
      );
      if (result.error) return { data: snapshot, error: result.error };
    }

    return { data: snapshot, error: null };
  } catch (err) {
    return { data: snapshot, error: toMessage(err) };
  }
}

/** 「我做完了 X」：写一条 completed 日历 + 改主要食材档位 */
export async function applyCooked(
  vault: Vault,
  args: { recipeId: string; date: string; decisions: CaptureDecision[] }
): Promise<{ data: CaptureSnapshot; error: string | null }> {
  const snapshot = emptySnapshot();

  try {
    assertWritable('记录烹饪');

    const entry = await addCalendarEntry(vault, {
      date: args.date,
      recipe_id: args.recipeId,
      status: 'completed',
    });
    if (entry.error) return { data: snapshot, error: entry.error };
    if (entry.data) snapshot.calendarEntries.push(entry.data.id);

    const updates = args.decisions.filter((item) => !item.isNew);
    snapshot.restore.push(...levelsOf(vault, updates.map((item) => item.id)));

    if (updates.length > 0) {
      const result = await batchUpdateStockLevel(
        vault,
        updates.map((item) => ({ id: item.id, stock_level: item.stock_level }))
      );
      if (result.error) return { data: snapshot, error: result.error };
    }

    return { data: snapshot, error: null };
  } catch (err) {
    return { data: snapshot, error: toMessage(err) };
  }
}

/** 撤销一次录入。逆操作表见 {@link CaptureSnapshot} */
export async function undoCapture(
  vault: Vault,
  snapshot: CaptureSnapshot
): Promise<{ error: string | null }> {
  try {
    assertWritable('撤销录入');

    for (const id of snapshot.calendarEntries) {
      const result = await deleteCalendarEntry(vault, id);
      if (result.error) return result;
    }

    // 先删新增的，再回滚档位。反过来的话，回滚里若含新增项（不会，但别依赖这点）
    // 会写一次没意义的盘
    for (const id of snapshot.added) {
      const result = await deleteInventoryItem(vault, id);
      if (result.error) return result;
    }

    // 走 restoreInventoryState 而不是 batchUpdateStockLevel——后者会把
    // last_restocked_at 盖成今天，那不是「撤销」，那是又改了一次
    if (snapshot.restore.length > 0) {
      const result = await restoreInventoryState(vault, snapshot.restore);
      if (result.error) return result;
    }

    return { error: null };
  } catch (err) {
    return { error: toMessage(err) };
  }
}

/** 取这些 id 当前的完整状态，用作撤销快照。**连 `last_restocked_at` 一起取** */
function levelsOf(vault: Vault, ids: string[]): CaptureSnapshot['restore'] {
  const result: CaptureSnapshot['restore'] = [];
  for (const id of ids) {
    const item: InventoryItem | undefined = vault.inventory.find((existing) => existing.id === id);
    if (item) {
      result.push({
        id,
        stock_level: item.stock_level,
        last_restocked_at: item.last_restocked_at,
      });
    }
  }
  return result;
}
