// 规则引擎配置。二期 LLM 增强而非替换本层——规则引擎保留为基线，
// 无 API key 时产品完全可用。见 DESIGN.md §1.3 / §3。
export const RECOMMEND_CONFIG = {
  // 每档推荐数量
  topPerTier: 4,

  // 清库存阈值（天数）- enough 放置超过 N 天才进"清库存"档
  clearStockThreshold: {
    vegetable: 3,
    meat: 7,
    egg_dairy_bean: 5,
    // staple 和 seasoning 不提醒
  } as Record<string, number>,

  // 档内评分权重
  weights: {
    noRepeat: 0.35, // 不重样（距上次做天数）
    clearStock: 0.25, // 清库存（含久放食材数量）
    timeMatch: 0.20, // 耗时匹配
    nutritionBalance: 0.20, // 营养搭配
  },

  // "需额外购买"档：缺几样以内才推荐
  maxMissingForShopping: 3,
};
