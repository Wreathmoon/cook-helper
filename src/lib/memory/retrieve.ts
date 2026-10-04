/**
 * 记忆检索 —— 纯函数，不碰文件系统。
 *
 * 明确**不上向量库**：量级是几十到几百条，关键词 + scope 过滤在这个规模上完胜
 * embedding，而且可调试（Task/10 harness ①，DESIGN.md §13 反模式 3）。
 *
 * ⚠️ `expires` 是**读取时过滤**，绝不回写用户的文件（Task/10 决策 ⑥）。
 * 起个定时任务去改用户的 markdown，等于半夜动别人的文件；ethos 是「那是你的文件夹」。
 */
import type { Memory, MemoryScope } from '@/types';

/** 今天，`YYYY-MM-DD`。抽出来是为了测试能把「今天」钉死 */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 过期判定：`expires` 那天当天仍然有效，第二天起失效 */
export function isExpired(memory: Memory, at: string = today()): boolean {
  return memory.expires !== null && memory.expires < at;
}

/** 还「活着」= 状态是 active 且没过期。注意：这**不代表它对推荐生效**，见 isEffective */
export function isLive(memory: Memory, at: string = today()): boolean {
  return memory.status === 'active' && !isExpired(memory, at);
}

/**
 * 检索：喂给模型的那一份。
 *
 * 命中当前域的 + `global` 的 + 活着的。**没有任何按 `enforcement` 分支的逻辑**——
 * `hard` / `soft` 都只是渲染进 prompt 的强度提示，判断在模型那边（决策 ③④）。
 */
export function retrieveMemories(
  memories: Memory[],
  options: { scope: MemoryScope; at?: string } = { scope: 'kitchen' }
): Memory[] {
  const at = options.at ?? today();
  return memories.filter(
    (memory) =>
      isLive(memory, at) &&
      (memory.scope.includes(options.scope) || memory.scope.includes('global'))
  );
}

export interface MemoryPartition {
  /** 生效中：活着，且 API key 已配置 */
  effective: Memory[];
  /** 未生效：活着，但没配 key —— 记忆写了也不会影响任何推荐（决策 ④⑤） */
  ineffective: Memory[];
  /** 已过期 / 已归档：文件原样留着，删不删由用户决定（决策 ⑥） */
  expired: Memory[];
}

/**
 * 管理页的三个分区。
 *
 * ⚠️ 没配 key 时 `effective` 恒为空、所有活着的记忆都落在 `ineffective`——这不是
 * 边界情况，是默认状态。**用户以为过敏记忆在保护自己、实际什么都没发生**，是本任务
 * 最不可接受的失败态（Task/10 风险第一条），所以「未生效」必须是一个独立分区，
 * 不能只做成角落里的一个小标记。
 */
export function partitionMemories(
  memories: Memory[],
  options: { aiConfigured: boolean; at?: string }
): MemoryPartition {
  const at = options.at ?? today();
  const partition: MemoryPartition = { effective: [], ineffective: [], expired: [] };

  for (const memory of memories) {
    if (!isLive(memory, at)) partition.expired.push(memory);
    else if (options.aiConfigured) partition.effective.push(memory);
    else partition.ineffective.push(memory);
  }

  return partition;
}
