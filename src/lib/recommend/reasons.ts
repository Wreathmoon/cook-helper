/**
 * 「为什么推荐它」的那几行字。
 *
 * 从 `HeroCard.tsx` 里抽出来的纯函数——它现在有一条**必须成立的不变式**
 * （记忆理由必定可见），不变式就得能被测试钉住，不能藏在一个组件内部。
 *
 * ⚠️ 规则引擎不会被 LLM 取代，是被它增强（DESIGN.md §6 #3/#4）：
 * 下面前三条理由无需 API key 就能算出来，第四条（记忆）才需要。
 */
import type { RecommendedRecipe } from '@/types';

export type ReasonColor = 'g' | 'y' | 'o' | 'soft';

export interface Reason {
  color: ReasonColor;
  text: string;
}

/** 卡片上最多显示几条。改这个数之前先看下面那段关于「固定槽位」的说明 */
export const MAX_REASONS = 3;

/**
 * 记忆理由的**固定槽位**（Task/10 决策 ⑧）。
 *
 * 为什么需要一个槽位：现网实测，凉拌菠菜的三格已经被
 * 「菠菜已放多天 / 食材全齐 / 快手菜只需 10 分钟」占满，记忆理由排第四**必被切掉**
 * ——而且恰好是在最需要解释的清库存档上不可见。可解释性是记忆层的核心卖点，
 * 「大部分时候可见」等于没做。
 *
 * 做法：记忆命中时占**第一格**，并挤掉信息量最低的「快手菜」
 * （耗时在卡片的标签行上已另有显示，不会丢信息）。
 *
 * ⚠️ 本函数只负责**留出槽位**。往 `rec.reason` 里填什么由 Task/12 决定——
 * 在那之前没有任何代码会设置它，这里走的永远是无记忆分支。
 */
export function buildReasons(rec: RecommendedRecipe): Reason[] {
  const reasons: Reason[] = [];
  const r = rec.recipe;
  const memory = rec.reason?.trim();

  if (memory) reasons.push({ color: 'soft', text: memory });

  if (rec.clearStockIngredients?.length) {
    reasons.push({ color: 'o', text: `${rec.clearStockIngredients.join('、')} 已放多天，建议尽快吃` });
  }
  if (rec.missingIngredients?.length) {
    reasons.push({ color: 'y', text: `缺 ${rec.missingIngredients.join('、')}，买齐就能做` });
  } else {
    reasons.push({ color: 'g', text: '食材全齐，随时能做 ✓' });
  }
  // 记忆命中时让位给记忆：四条候选、三个格子，让掉的必须是信息量最低的那条
  if (!memory && r.cook_time_minutes && r.cook_time_minutes <= 15) {
    reasons.push({ color: 'g', text: `快手菜，只需 ${r.cook_time_minutes} 分钟` });
  }

  if (reasons.length === 0) reasons.push({ color: 'soft', text: '为你精选 ✨' });
  return reasons.slice(0, MAX_REASONS);
}
