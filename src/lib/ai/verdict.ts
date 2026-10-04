/**
 * 记忆判定的**纯数据部分** —— 类型 + 一个把判定应用到列表上的纯函数。
 *
 * ⚠️ 和 `limits.ts` 同一个理由：推荐页（客户端组件）要调 `applyMemoryVerdicts`，
 * 而它不能因此把 `ai` SDK 和整条 vault 依赖链拖进客户端 bundle。
 * 所以这里**只 import 类型**，模型调用留在 `annotate.ts`（只在服务端跑）。
 */
import type { RecommendedRecipe } from '@/types';

export interface MemoryVerdict {
  id: string;
  /** `note` = 命中且正面；`avoid` = 与记忆冲突 */
  verdict: 'note' | 'avoid';
  reason: string;
}

export interface AnnotatedRecommendation extends RecommendedRecipe {
  /** 模型判定该避开。UI 用它决定要不要打警示色 */
  memoryAvoid?: boolean;
}

/**
 * 把判定应用到已排好序的推荐列表上。
 *
 * 两件事：写理由、把 `avoid` 的整体下沉到末尾。**不删任何一条**——
 * 过滤掉等于用户永远不知道发生过什么，模型判错了也无从排查。
 * 下沉之后菜还在、理由写在卡片上，一眼能看出是记忆在起作用，也一眼能看出它判错了。
 */
export function applyMemoryVerdicts(
  recommendations: RecommendedRecipe[],
  verdicts: MemoryVerdict[]
): AnnotatedRecommendation[] {
  if (verdicts.length === 0) return recommendations;

  const byId = new Map(verdicts.map((item) => [item.id, item]));
  const annotated: AnnotatedRecommendation[] = recommendations.map((item) => {
    const verdict = byId.get(item.recipe.id);
    if (!verdict) return item;
    return { ...item, reason: verdict.reason, memoryAvoid: verdict.verdict === 'avoid' };
  });

  // 稳定下沉：两个分组内部的相对顺序都保持不变，只是 avoid 整体挪到后面
  return [
    ...annotated.filter((item) => !item.memoryAvoid),
    ...annotated.filter((item) => item.memoryAvoid),
  ];
}
