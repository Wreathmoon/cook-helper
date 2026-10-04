/**
 * 把记忆渲染进 system prompt —— Task/10 明确留给 Task/12 的那一步。
 *
 * Task/10 交付了格式、存储、检索、管理页、免责声明，**但记忆至今不改变任何东西**。
 * 这个文件是那条线的最后一节。
 *
 * ⚠️ **代码不按 `enforcement` 分支**（Task/10 决策 ③④）。`hard` 和 `soft` 都只是
 * 渲染进 prompt 的强度提示，判断在模型那边。
 *
 * 这条曾经的反面写法——「hard 约束在 `tiering.ts` 里过滤掉，让模型根本看不到」——
 * 已于 2026-08-04 被实测推翻：代码过滤要成立，前提是数据能支撑判断，而**宫保鸡丁的
 * 食材表里没有花生**（食材表记的是冰箱库存，不是配料表）。于是「确定性代码过滤」
 * 在过敏这件事上，只会确定性地把宫保鸡丁推给花生过敏的用户。
 * 详见 DESIGN.md §6 #14 的纠正块。
 *
 * 代价已知并接受：**准确性靠模型，而模型不是 100% 可靠**，所以免责声明
 * （`MEMORY_DISCLAIMER`）是这条决策的必要配套，不是法务装饰。
 */
import type { Memory } from '@/types';
import { retrieveMemories } from '@/lib/memory/retrieve';

const TYPE_HINT: Record<Memory['type'], string> = {
  preference: '长期偏好',
  goal: '临时目标',
  constraint: '禁忌/过敏',
};

/**
 * 渲染「关于你」区块。没有活着的记忆时返回空串——
 * 空区块比没有区块更糟，它会让模型觉得「这里本该有点什么」。
 */
export function renderMemoryBlock(memories: Memory[], at?: string): string {
  const live = retrieveMemories(memories, { scope: 'kitchen', at });
  if (live.length === 0) return '';

  const lines = live.map((memory) => {
    const strength = memory.enforcement === 'hard' ? '【必须遵守】' : '【倾向】';
    const source = memory.source === 'inferred' ? '（这条是推断的，不确定）' : '';
    // 正文可能是多行的，压成一行——prompt 里的换行会让条目之间的边界变模糊
    const content = memory.content.replace(/\s+/g, ' ').trim();
    return `- ${strength}[${TYPE_HINT[memory.type]}] ${content}${source}`;
  });

  return [
    '<关于你正在服务的这个人>',
    ...lines,
    '</关于你正在服务的这个人>',
    '',
    '上面每一条都是这个人自己写下的。做任何推荐或判断时都要照顾到它们。',
    '⚠️ 涉及过敏和禁忌时：菜谱的食材表记的是**冰箱库存，不是完整配料表**——',
    '比如「宫保鸡丁」的食材表里不会写「花生」。所以判断一道菜含不含某样东西时，',
    '要用你自己对这道菜的常识，不要只看食材表。拿不准就明说拿不准，不要假装确定。',
  ].join('\n');
}

/** 有没有活着的记忆。UI 用它决定要不要显示「本次推荐已按你的记忆筛查过」 */
export function hasLiveMemories(memories: Memory[], at?: string): boolean {
  return retrieveMemories(memories, { scope: 'kitchen', at }).length > 0;
}
