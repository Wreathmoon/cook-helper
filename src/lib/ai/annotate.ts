/**
 * 拿记忆对推荐候选做一次筛查 —— 让 Task/10 留的那个槽位真的被填上。
 *
 * ## 它做什么，不做什么
 *
 * **规则引擎照常跑完**（分三档、档内评分），这一层只在**已经排好的结果**上做两件事：
 *
 * 1. 命中记忆的，给一句人话，写进 `rec.reason` —— 它会被 `buildReasons()` 放进第一格
 *    （Task/10 决策 ⑧ 留好的固定槽位）。
 * 2. 判定为「该避开」的，**下沉到列表末尾并附上理由**。
 *
 * ## 为什么是「下沉 + 说明」而不是「过滤掉」
 *
 * 过滤掉 = 用户永远不知道发生过什么。模型判断错了（它会错），用户只会觉得
 * 「这个应用怎么从来不推我爱吃的那道菜」，而且无从排查。下沉之后菜还在、
 * 理由写在卡片上，用户一眼能看出是记忆在起作用，也一眼能看出它判错了。
 *
 * 这和 Task/11 决策 ⑦（AI 写入一律要确认）是同一条原则的两种形态：
 * **AI 可以改变你看到什么，但不能背着你改变。**
 *
 * ## 为什么是「事后标注」而不是塞进推荐主流程
 *
 * 推荐页是这个应用的首屏。把一次模型调用放进它的加载路径，等于让每个配了 key 的人
 * 每次打开首页都多等一两秒——而且模型一挂，首页就白屏。
 * 所以规则引擎先秒出结果，标注随后异步到达（渐进增强）。
 * 顺带白拿一个保证：**没配 key 的人走的代码路径与 Task/10 之前逐字相同**。
 */
import { generateText, Output } from 'ai';
import { z } from 'zod';
import type { Memory } from '@/types';
import { ANNOTATE_LIMIT } from './limits';
import type { MemoryVerdict } from './verdict';
import { describeModelError, textModel } from './provider';
import { renderMemoryBlock } from './memory-prompt';
import { schemaInstruction } from './structured';

/** 喂给模型的候选：只给判断得上的字段，不给步骤正文（那是纯 token 浪费）*/
export interface AnnotateCandidate {
  id: string;
  name: string;
  spiciness?: string | null;
  diet_type?: string | null;
  cuisine?: string | null;
}

const VerdictSchema = z.object({
  verdicts: z.array(
    z.object({
      id: z.string().describe('菜谱 id，必须原样照抄候选列表里给的那个'),
      verdict: z
        .enum(['ok', 'note', 'avoid'])
        .describe(
          'ok = 与记忆无关，不用说什么；note = 命中记忆且是正面的（正好符合偏好）；avoid = 与记忆冲突，应该避开'
        ),
      reason: z
        .string()
        .describe(
          'verdict 为 note 或 avoid 时，一句给用户看的话，20 字以内，要点明是哪条记忆。verdict 为 ok 时给空串'
        ),
    })
  ),
});

const SYSTEM = [
  '你在帮一个人挑今天做什么菜。下面会给你他自己写下的偏好与禁忌，以及一份候选菜谱。',
  '逐道判断它与这些记忆的关系。',
  '',
  '判断规则：',
  '- 只有**真的**和某条记忆相关时才给 note 或 avoid。大部分菜应该是 ok——',
  '  硬找关联会让每张卡片都挂一句废话，用户很快就不看了。',
  '- reason 要点明是哪条记忆在起作用，例如「你说过不吃辣，这道是中辣」。',
  '- ⚠️ 食材表记的是**冰箱库存，不是完整配料表**。判断一道菜含不含某样东西，',
  '  要用你对这道菜本身的常识（「宫保鸡丁」含花生，即使食材表里没写）。',
  '- 拿不准就给 ok。宁可漏掉一条提示，也不要给出一条错的——',
  '  错的提示会让用户不再相信所有提示。',
].join('\n');

/**
 * 逐道判断候选菜与记忆的关系。
 *
 * **失败时返回空数组 + 错误文案，绝不抛**：这一层是增强不是必需，
 * 模型超时或返回不合 schema 的东西，都不该让推荐页出问题——
 * 那会把一个可选功能变成单点故障。
 */
export async function annotateWithMemory(
  memories: Memory[],
  candidates: AnnotateCandidate[]
): Promise<{ data: MemoryVerdict[]; error: string | null }> {
  const memoryBlock = renderMemoryBlock(memories);
  if (!memoryBlock || candidates.length === 0) return { data: [], error: null };

  try {
    const { output } = await generateText({
      model: textModel(),
      output: Output.object({ schema: VerdictSchema, name: 'memory_verdicts' }),
      abortSignal: AbortSignal.timeout(30_000),
      system: `${SYSTEM}\n\n${memoryBlock}${schemaInstruction(VerdictSchema)}`,
      prompt: `候选菜谱：\n${JSON.stringify(candidates.slice(0, ANNOTATE_LIMIT), null, 2)}`,
    });

    const known = new Set(candidates.map((item) => item.id));
    const data: MemoryVerdict[] = [];
    for (const item of output.verdicts) {
      // 模型偶尔会编一个不在候选里的 id，或者对 ok 也写理由——两种都丢掉
      if (item.verdict === 'ok' || !known.has(item.id) || !item.reason.trim()) continue;
      data.push({ id: item.id, verdict: item.verdict, reason: item.reason.trim() });
    }
    return { data, error: null };
  } catch (err) {
    return { data: [], error: describeModelError(err, { vision: false }) };
  }
}
