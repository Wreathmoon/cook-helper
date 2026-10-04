// 规则引擎。**保留为基线，被 LLM 增强而不是取代**——无 API key 时本层完整可用
// （DESIGN.md §6 #3/#4）。记忆类偏好由 LLM 判断，不进本层，见 Task/10 决策 ③④。
export { tierRecipes } from './tiering';
export { scoreAndSort } from './scoring';
export { RECOMMEND_CONFIG } from './config';
export { buildReasons, MAX_REASONS } from './reasons';
export type { Reason, ReasonColor } from './reasons';
