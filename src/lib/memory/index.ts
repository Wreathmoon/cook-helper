/**
 * 记忆层 —— 「不吃辣」「这月少吃肉」这类跨域偏好。
 *
 * 边界（Task/10 决策 ③④ 的直接后果）：本模块只负责记忆的**格式、读取、检索、
 * 展示**。**没有任何让记忆影响推荐的代码**——那部分需要 LLM，随 Task/12 落地。
 * 在此之前，记忆能写能看，但不改变任何推荐结果，且这一点必须在 UI 上明示。
 */
export { loadMemories } from './reader';
export { memoryFrontmatterSchema } from './schema';
export type { MemoryFrontmatter } from './schema';
export {
  isExpired,
  isLive,
  partitionMemories,
  retrieveMemories,
  today,
} from './retrieve';
export type { MemoryPartition } from './retrieve';
export { deleteMemoryFile } from './writer';
export { MEMORY_DISCLAIMER, MEMORY_INEFFECTIVE_LABEL, MEMORY_TYPE_LABEL } from './text';
