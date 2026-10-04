/**
 * 「为什么推荐它」的记忆固定槽位（Task/10 决策 ⑧）。
 *
 * 现网实测的失败态：凉拌菠菜的三格已被「菠菜已放多天 / 食材全齐 / 快手菜只需10分钟」
 * 占满，记忆理由排第四**必被切掉**——而且恰好在最需要解释的清库存档上不可见。
 * 可解释性是记忆层的核心卖点，「大部分时候可见」等于没做。
 */
import { describe, it, expect } from 'vitest';
import type { Recipe, RecommendedRecipe } from '@/types';
import { buildReasons, MAX_REASONS } from '../reasons';

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'r1',
    name: '凉拌菠菜',
    steps: null,
    cook_time_minutes: 10,
    difficulty: 'easy',
    attributes: {},
    tips: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  } as Recipe;
}

/** 三格被占满的那个真实用例：清库存 + 食材全齐 + 快手菜 */
function crowded(overrides: Partial<RecommendedRecipe> = {}): RecommendedRecipe {
  return {
    recipe: recipe(),
    tier: 'clear_stock',
    score: 0.8,
    clearStockIngredients: ['菠菜'],
    ...overrides,
  };
}

describe('buildReasons', () => {
  it('没有记忆时，行为与改造前一致：清库存 / 全齐 / 快手菜', () => {
    const reasons = buildReasons(crowded());

    expect(reasons.map((r) => r.text)).toEqual([
      '菠菜 已放多天，建议尽快吃',
      '食材全齐，随时能做 ✓',
      '快手菜，只需 10 分钟',
    ]);
  });

  it('⚠️ 三格被占满时，记忆理由必定出现在 3 条内，并占第一格', () => {
    const reasons = buildReasons(crowded({ reason: '你说过不吃辣，已避开川辣类' }));

    expect(reasons).toHaveLength(MAX_REASONS);
    expect(reasons[0].text).toBe('你说过不吃辣，已避开川辣类');
    expect(reasons.map((r) => r.text)).toContain('你说过不吃辣，已避开川辣类');
  });

  it('让位的是「快手菜」，清库存与缺料不受影响', () => {
    const texts = buildReasons(crowded({ reason: '记忆理由' })).map((r) => r.text);

    expect(texts).not.toContain('快手菜，只需 10 分钟');
    expect(texts).toContain('菠菜 已放多天，建议尽快吃');
  });

  it('缺料档也一样：记忆在第一格，缺料提示还在', () => {
    const reasons = buildReasons({
      recipe: recipe({ name: '番茄炒蛋' }),
      tier: 'need_shopping',
      score: 0.5,
      missingIngredients: ['西红柿', '鸡蛋'],
      clearStockIngredients: ['葱'],
      reason: '你这周说过想少吃肉',
    });

    expect(reasons[0].text).toBe('你这周说过想少吃肉');
    expect(reasons.map((r) => r.text)).toContain('缺 西红柿、鸡蛋，买齐就能做');
  });

  it('空白的 reason 不占槽位', () => {
    const reasons = buildReasons(crowded({ reason: '   ' }));
    expect(reasons.map((r) => r.text)).toContain('快手菜，只需 10 分钟');
  });

  it('永远不超过 3 条', () => {
    expect(buildReasons(crowded({ reason: 'x', missingIngredients: ['a'] })).length)
      .toBeLessThanOrEqual(MAX_REASONS);
  });
});
