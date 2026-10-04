/**
 * 记忆层的固定文案。
 *
 * 免责声明不是法务装饰，是**产品的一部分**：决策 ③ 把过敏与禁忌的判断交给了 LLM，
 * 而提示词遵从性永远不是 100%。这条限制现在是**对用户明示的已知限制**，
 * 而不是一个假装被代码解决掉的问题（Task/10 决策 ③ 纠正块）。删掉这段文案，
 * 整个决策 ③ 就不再成立。
 */
import type { MemoryType } from '@/types';

export const MEMORY_DISCLAIMER = {
  title: '关于过敏与禁忌，请务必看一眼',
  /** ⚠️ 纯文本，不带 markdown 标记——它会被原样渲染进页面，也被验收测试逐字匹配 */
  body:
    '记忆里的过敏、禁忌由 AI 模型在推荐时判断，不保证准确——'
    + '菜谱的食材表记的是冰箱库存，不是配料表（比如宫保鸡丁的食材表里就没有「花生油」）。'
    + '涉及过敏、医疗禁忌时，请自行核对成分，不要依赖本应用的筛查结果。',
} as const;

/** 没配 key 时的状态标记。别改软——用户误以为记忆在保护自己是本任务最不可接受的失败态 */
export const MEMORY_INEFFECTIVE_LABEL = '未生效 —— 需配置模型（见 README）';

export const MEMORY_TYPE_LABEL: Record<MemoryType, string> = {
  preference: '长期偏好',
  goal: '临时目标',
  constraint: '禁忌 / 过敏',
};
