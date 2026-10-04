'use server';

/**
 * AI 录入的 Server Actions。
 *
 * **抽取和落库是分开的两个 action，这是刻意的**（Task/11 决策 ⑦）：
 * `captureXxx` 只读不写，产出一份提案；`applyXxx` 才写库。中间隔着的那一步——
 * 用户过目——是这个功能唯一的安全带。把两件事合成一个 action 会让「确认」
 * 变成一个可以被绕过的 UI 装饰。
 *
 * ⚠️ 每个 action 都要自己检查前置条件。Server Action 是**公开的 POST 端点**
 * （Next 文档：`node_modules/next/dist/docs/01-app/02-guides/server-actions.md` §Security），
 * UI 上按钮灰着不代表这个函数调不到。
 */
import { revalidatePath } from 'next/cache';
import { describeMissing, readAiConfig } from '@/lib/ai/config';
import { extractFromImage, extractFromText } from '@/lib/ai/extract';
import {
  applyCooked,
  applyInventoryDecisions,
  buildCookedProposal,
  buildInventoryProposal,
  mainIngredientsOf,
  undoCapture,
  type CaptureDecision,
  type CaptureSnapshot,
  type CookedProposal,
  type InventoryProposal,
} from '@/lib/services/capture';
import { guardData, guardResult } from '@/lib/utils/error';
import { getVault, isReadOnly } from '@/lib/vault';
import { READ_ONLY_MESSAGE } from '@/lib/ai/text';

const EMPTY_PROPOSAL: InventoryProposal = { existing: [], fresh: [] };

/**
 * 跑模型之前的两道闸。
 *
 * 只读沙盒那道**必须挡在发请求之前**（决策 ⑪）：让用户在演示站上传照片、
 * 真的烧掉一次 token、然后在落库那一步才被拒——那是花钱买一条错误提示。
 */
function blockedReason(): string | null {
  if (isReadOnly()) return READ_ONLY_MESSAGE;
  const { missing } = readAiConfig();
  if (missing.length > 0) return describeMissing(missing);
  return null;
}

// ---------------------------------------------------------------- 抽取（只读）

/** 图片 → 食材提案。**不写库** */
export async function captureFromImageAction(
  formData: FormData
): Promise<{ data: InventoryProposal; error: string | null }> {
  const blocked = blockedReason();
  if (blocked) return { data: EMPTY_PROPOSAL, error: blocked };

  const file = formData.get('image');
  if (!(file instanceof File)) return { data: EMPTY_PROPOSAL, error: '没有收到图片' };

  const kind = formData.get('kind') === 'receipt' ? 'receipt' : 'photo';

  return guardData(EMPTY_PROPOSAL, async () => {
    const captured = await extractFromImage(file, kind);
    if (captured.items.length === 0) {
      return {
        data: EMPTY_PROPOSAL,
        error: '没从这张图里认出任何食材。换个角度、光线好一点再拍一张试试。',
      };
    }
    // 刚买回来 / 冰箱里看得见 —— 建议档位一律 enough，用户可逐条改
    return {
      data: buildInventoryProposal(getVault(), captured.items, { suggestedLevel: 'enough' }),
      error: null,
    };
  });
}

export type TextCaptureResult =
  | { kind: 'cooked'; cooked: CookedProposal }
  | { kind: 'stock'; inventory: InventoryProposal }
  | { kind: 'unknown' };

const EMPTY_TEXT: TextCaptureResult = { kind: 'unknown' };

/** 一句话 → 提案。**不写库** */
export async function captureFromTextAction(
  input: string
): Promise<{ data: TextCaptureResult; error: string | null }> {
  const blocked = blockedReason();
  if (blocked) return { data: EMPTY_TEXT, error: blocked };

  const text = input.trim();
  if (!text) return { data: EMPTY_TEXT, error: '说点什么吧' };

  return guardData(EMPTY_TEXT, async () => {
    const captured = await extractFromText(text);
    const vault = getVault();

    if (captured.intent === 'cooked' && captured.recipe_name) {
      return { data: { kind: 'cooked', cooked: buildCookedProposal(vault, captured.recipe_name) }, error: null };
    }

    if (captured.intent === 'stock_change' && captured.items.length > 0) {
      // 这一支里档位是**用户自己说的**（「西红柿没了」），不是模型猜的，
      // 所以逐条沿用抽取结果，而不是统一给一个建议值
      const proposal = buildInventoryProposal(vault, captured.items);
      const levelOf = new Map(captured.items.map((item) => [item.name, item.stock_level]));
      for (const item of [...proposal.existing, ...proposal.fresh]) {
        item.suggestedLevel = levelOf.get(item.rawName) ?? item.suggestedLevel;
      }
      return { data: { kind: 'stock', inventory: proposal }, error: null };
    }

    return {
      data: EMPTY_TEXT,
      error: '没听懂这句话。试试「我做完了红烧肉」或者「西红柿没了」。',
    };
  });
}

/** 用户在候选列表里选了一个菜谱之后，重新取它的主要食材 */
export async function ingredientsForRecipeAction(recipeId: string) {
  return guardData([] as CookedProposal['ingredients'], async () => ({
    data: mainIngredientsOf(getVault(), recipeId),
    error: null,
  }));
}

// ---------------------------------------------------------------- 落库

export async function applyInventoryCaptureAction(decisions: CaptureDecision[]) {
  const result = await guardResult(() => applyInventoryDecisions(getVault(), decisions), {
    data: { restore: [], added: [], calendarEntries: [] } as CaptureSnapshot,
  });
  revalidatePath('/inventory');
  revalidatePath('/recommend');
  return result;
}

export async function applyCookedCaptureAction(args: {
  recipeId: string;
  date: string;
  decisions: CaptureDecision[];
}) {
  const result = await guardResult(() => applyCooked(getVault(), args), {
    data: { restore: [], added: [], calendarEntries: [] } as CaptureSnapshot,
  });
  revalidatePath('/inventory');
  revalidatePath('/calendar');
  revalidatePath('/recommend');
  return result;
}

export async function undoCaptureAction(snapshot: CaptureSnapshot) {
  const result = await guardResult(() => undoCapture(getVault(), snapshot));
  revalidatePath('/inventory');
  revalidatePath('/calendar');
  revalidatePath('/recommend');
  return result;
}

/** 给 UI 用的开关状态：能不能用、不能用的话缺什么 */
export async function aiCaptureStatusAction(): Promise<{ enabled: boolean; reason: string | null }> {
  const reason = blockedReason();
  return { enabled: reason === null, reason };
}
