/**
 * 命令层的 agent 循环。
 *
 * 定位是**加速器，不是替代层**（DESIGN.md §1.3、§13 反模式 1）：
 * 浏览菜谱瀑布流吊打聊天框，一眼看库存吊打问 bot。对话只在
 * **模糊的、多步的、低频的**意图上赢，比如：
 *
 * > 「帮我排一周的菜，避开我最近吃过的，用掉那块快坏的猪肉，周三要快手」
 *
 * 这个需求用现有筛选器表达不出来——它同时涉及日历历史、库存陈旧度、
 * 时长偏好和跨天规划。而这正是 LLM 擅长的编排。
 *
 * ## 三条硬约束
 *
 * 1. **写入不在循环里发生。** 见 `tools.ts` 的说明。
 * 2. **步数封顶。** 没有上限的 agent 循环就是一台连着用户钱包的永动机。
 * 3. **规则引擎是基线。** `get_recommendations` 工具让模型去调规则引擎，
 *    而不是自己凭菜谱列表挑——LLM 增强规则引擎，不取代它（DESIGN.md §6 #3/#4）。
 */
import { generateText, stepCountIs } from 'ai';
import type { Vault } from '@/lib/vault';
import { getMemoriesForPrompt } from '@/lib/services/memory';
import { describeModelError, textModel } from './provider';
import { renderMemoryBlock } from './memory-prompt';
import { buildTools, type Proposal } from './tools';
import { MAX_STEPS } from './limits';

// ⚠️ 刻意**不**从这里再导出 MAX_STEPS。客户端组件要用就直接 import `./limits`——
// 从本文件拿会把 agent → tools → services → vault → node:fs 整条链拖进客户端 bundle，
// 构建直接失败。这个坑已经踩过一次了。

const SYSTEM = [
  '你是一个厨房助手，帮用户查东西和安排做饭。',
  '',
  '工作方式：',
  '- **挑菜、排菜一律先调 `get_recommendations`**，它已经算好了库存匹配、食材陈旧度和最近吃过什么。',
  '  不要自己从 `list_recipes` 里凭感觉挑——那样会推出用户上周刚吃过、或者食材根本不齐的菜。',
  '- 需要改日历或库存时，调 `propose_changes` 一次性提出全部改动。**你不能直接修改任何东西**，',
  '  提案会先给用户过目。',
  '- 引用菜谱时必须用你查到的真实 id 和名称，**不要编**。',
  '- 回答简短。用户在一个命令栏里看你的输出，不是在读文档。',
].join('\n');

export interface AgentTurn {
  /** 给用户看的回答 */
  text: string;
  /** 模型提出的改动。`null` = 这次没有要改的东西 */
  proposal: Proposal | null;
  /** 调过哪些工具，按顺序。UI 拿它显示「它干了什么」 */
  steps: string[];
}

/**
 * 跑一轮。
 *
 * @param readOnly 只读沙盒：不给提案工具，模型只能查
 */
export async function runAgent(
  vault: Vault,
  input: string,
  options: { readOnly?: boolean } = {}
): Promise<{ data: AgentTurn | null; error: string | null }> {
  const memoryBlock = renderMemoryBlock(getMemoriesForPrompt(vault));
  const system = memoryBlock ? `${SYSTEM}\n\n${memoryBlock}` : SYSTEM;

  try {
    const result = await generateText({
      model: textModel(),
      system,
      prompt: input,
      tools: buildTools(vault, { readOnly: options.readOnly }),
      // 循环预算。到点就停，不会无限转下去
      stopWhen: stepCountIs(MAX_STEPS),
      abortSignal: AbortSignal.timeout(120_000),
    });

    // `propose_changes` 没有 execute，所以它的调用会原样留在 toolCalls 里
    const proposalCall = result.toolCalls.find((call) => call.toolName === 'propose_changes');
    const proposal = (proposalCall?.input as Proposal | undefined) ?? null;

    const steps = result.toolCalls.map((call) => call.toolName);

    return {
      data: {
        text: result.text.trim(),
        // 空改动的提案等于没提案——别让 UI 弹一个「确认 0 项改动」的确认屏
        proposal: proposal && proposal.changes.length > 0 ? proposal : null,
        steps,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: describeModelError(err, { vision: false }) };
  }
}
