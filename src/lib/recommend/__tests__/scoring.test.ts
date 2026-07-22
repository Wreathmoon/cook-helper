import { describe, it, expect } from 'vitest';
import { scoreAndSort } from '../scoring';
import type { RecommendedRecipe, CalendarEntry, InventoryItem, Recipe } from '@/types';

const day = 86400000;

function makeRecipe(id: string, name: string, overrides: Partial<Recipe> = {}): Recipe {
  return {
    id,
    user_id: 'u1',
    name,
    steps: null,
    cook_time_minutes: null,
    difficulty: null,
    attributes: {},
    tips: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeTiered(recipe: Recipe, tier: RecommendedRecipe['tier'], extra: Partial<RecommendedRecipe> = {}): RecommendedRecipe {
  return { recipe, tier, score: 0, ...extra };
}

describe('scoreAndSort', () => {
  it('不重样：30 天没做的菜比昨天做的菜分高', () => {
    const r1 = makeRecipe('r1', '久未做的菜');
    const r2 = makeRecipe('r2', '昨天做的菜');

    const calendar: CalendarEntry[] = [
      { id: 'c1', user_id: 'u1', date: new Date(Date.now() - 30 * day).toISOString().split('T')[0], recipe_id: 'r1', status: 'completed', notes: null, created_at: '', updated_at: '' },
      { id: 'c2', user_id: 'u1', date: new Date(Date.now() - 1 * day).toISOString().split('T')[0], recipe_id: 'r2', status: 'completed', notes: null, created_at: '', updated_at: '' },
    ];

    const result = scoreAndSort({
      tieredRecipes: [makeTiered(r1, 'can_make_now'), makeTiered(r2, 'can_make_now')],
      calendarEntries: calendar,
      inventory: [],
      recipeIngredients: new Map(),
    });

    const scored1 = result.find(r => r.recipe.id === 'r1')!;
    const scored2 = result.find(r => r.recipe.id === 'r2')!;
    expect(scored1.score).toBeGreaterThan(scored2.score);
  });

  it('从没做过的菜给高分（高于做了 5 天的菜）', () => {
    const r1 = makeRecipe('r1', '新菜');
    const r2 = makeRecipe('r2', '做过几次');

    const calendar: CalendarEntry[] = [
      { id: 'c1', user_id: 'u1', date: new Date(Date.now() - 5 * day).toISOString().split('T')[0], recipe_id: 'r2', status: 'completed', notes: null, created_at: '', updated_at: '' },
    ];

    const result = scoreAndSort({
      tieredRecipes: [makeTiered(r1, 'can_make_now'), makeTiered(r2, 'can_make_now')],
      calendarEntries: calendar,
      inventory: [],
      recipeIngredients: new Map(),
    });

    const scored1 = result.find(r => r.recipe.id === 'r1')!;
    const scored2 = result.find(r => r.recipe.id === 'r2')!;
    expect(scored1.score).toBeGreaterThan(scored2.score);
  });

  it('清库存加分：含多个久放食材的菜比含 0 个的分高', () => {
    const r1 = makeRecipe('r1', '清库存菜');
    const r2 = makeRecipe('r2', '普通菜');

    // 给两道菜相同的近期日历记录，使 noRepeat 分相同
    // r1 有 clearStockIngredients，r2 没有
    // 由于加权平均归一化，没有 clearStock 维度的 r2 只靠 noRepeat=1 得到 1.0
    // 而 r1 有 noRepeat + clearStock 两个维度，如果 noRepeat 不是满分，加权后会更高
    const calendar: CalendarEntry[] = [
      { id: 'c1', user_id: 'u1', date: new Date(Date.now() - 15 * day).toISOString().split('T')[0], recipe_id: 'r1', status: 'completed', notes: null, created_at: '', updated_at: '' },
      { id: 'c2', user_id: 'u1', date: new Date(Date.now() - 15 * day).toISOString().split('T')[0], recipe_id: 'r2', status: 'completed', notes: null, created_at: '', updated_at: '' },
    ];

    const result = scoreAndSort({
      tieredRecipes: [
        makeTiered(r1, 'clear_stock', { clearStockIngredients: ['白菜', '土豆', '胡萝卜'] }),
        makeTiered(r2, 'clear_stock'),
      ],
      calendarEntries: calendar,
      inventory: [],
      recipeIngredients: new Map(),
    });

    const scored1 = result.find(r => r.recipe.id === 'r1')!;
    const scored2 = result.find(r => r.recipe.id === 'r2')!;
    // r1: noRepeat=0.5, clearStock=1.0 → (0.5*0.35+1.0*0.25)/(0.35+0.25) = 0.425/0.60 ≈ 0.708
    // r2: noRepeat=0.5 → 0.5*0.35/0.35 = 0.5
    expect(scored1.score).toBeGreaterThan(scored2.score);
  });

  it('营养搭配：近 3 天连续荤菜后，纯素菜比纯荤菜在营养维度有加分', () => {
    const rVeg = makeRecipe('rv', '纯素菜', { attributes: { diet_type: '纯素' } });
    const rMeat = makeRecipe('rm', '纯荤菜', { attributes: { diet_type: '纯荤' } });

    // 给两道菜相同的近期日历记录（noRepeat 分相同）
    const calendar: CalendarEntry[] = [
      { id: 'c0', user_id: 'u1', date: new Date(Date.now() - 10 * day).toISOString().split('T')[0], recipe_id: 'rv', status: 'completed', notes: null, created_at: '', updated_at: '' },
      { id: 'c0b', user_id: 'u1', date: new Date(Date.now() - 10 * day).toISOString().split('T')[0], recipe_id: 'rm', status: 'completed', notes: null, created_at: '', updated_at: '' },
      // 近 3 天做了其他菜，触发营养搭配维度
      { id: 'c1', user_id: 'u1', date: new Date(Date.now() - 1 * day).toISOString().split('T')[0], recipe_id: 'cx1', status: 'completed', notes: null, created_at: '', updated_at: '' },
      { id: 'c2', user_id: 'u1', date: new Date(Date.now() - 2 * day).toISOString().split('T')[0], recipe_id: 'cx2', status: 'completed', notes: null, created_at: '', updated_at: '' },
      { id: 'c3', user_id: 'u1', date: new Date(Date.now() - 3 * day).toISOString().split('T')[0], recipe_id: 'cx3', status: 'completed', notes: null, created_at: '', updated_at: '' },
    ];

    const result = scoreAndSort({
      tieredRecipes: [makeTiered(rVeg, 'can_make_now'), makeTiered(rMeat, 'can_make_now')],
      calendarEntries: calendar,
      inventory: [],
      recipeIngredients: new Map(),
    });

    const scoredVeg = result.find(r => r.recipe.id === 'rv')!;
    const scoredMeat = result.find(r => r.recipe.id === 'rm')!;
    // 纯素菜有营养搭配加分 0.8 * 0.20 权重，纯荤没有该维度
    // 两者 noRepeat 相同（都是 10/30），但素菜多了 nutritionBalance 维度
    expect(scoredVeg.score).toBeGreaterThan(scoredMeat.score);
  });

  it('硬过滤：maxCookTime=30，超过 30 分钟的菜被过滤', () => {
    const r1 = makeRecipe('r1', '快菜', { cook_time_minutes: 20 });
    const r2 = makeRecipe('r2', '慢菜', { cook_time_minutes: 60 });

    const result = scoreAndSort({
      tieredRecipes: [makeTiered(r1, 'can_make_now'), makeTiered(r2, 'can_make_now')],
      calendarEntries: [],
      inventory: [],
      recipeIngredients: new Map(),
      userFilters: { maxCookTime: 30 },
    });

    expect(result.find(r => r.recipe.id === 'r1')).toBeDefined();
    expect(result.find(r => r.recipe.id === 'r2')).toBeUndefined();
  });

  it('硬过滤：spiciness=不辣，微辣的菜被过滤', () => {
    const r1 = makeRecipe('r1', '不辣菜', { attributes: { spiciness: '不辣' } });
    const r2 = makeRecipe('r2', '微辣菜', { attributes: { spiciness: '微辣' } });

    const result = scoreAndSort({
      tieredRecipes: [makeTiered(r1, 'can_make_now'), makeTiered(r2, 'can_make_now')],
      calendarEntries: [],
      inventory: [],
      recipeIngredients: new Map(),
      userFilters: { spiciness: '不辣' },
    });

    expect(result.find(r => r.recipe.id === 'r1')).toBeDefined();
    expect(result.find(r => r.recipe.id === 'r2')).toBeUndefined();
  });

  it('缺失维度降级：菜谱没填某维度时不报错、不排除', () => {
    const r1 = makeRecipe('r1', '无属性菜'); // attributes 为空 {}

    const result = scoreAndSort({
      tieredRecipes: [makeTiered(r1, 'can_make_now')],
      calendarEntries: [],
      inventory: [],
      recipeIngredients: new Map(),
      userFilters: { spiciness: '不辣', maxCookTime: 30 },
    });

    // 没填 spiciness → 不被过滤（!r.recipe.attributes?.spiciness 为 true）
    expect(result).toHaveLength(1);
    expect(result[0].recipe.id).toBe('r1');
  });

  it('每档 Top N：结果中每档不超过 4 道', () => {
    const recipes: RecommendedRecipe[] = [];
    // 生成 6 道 can_make_now
    for (let i = 0; i < 6; i++) {
      recipes.push(makeTiered(makeRecipe(`rcn${i}`, `现在做${i}`), 'can_make_now'));
    }
    // 生成 5 道 need_shopping
    for (let i = 0; i < 5; i++) {
      recipes.push(makeTiered(makeRecipe(`rns${i}`, `购买${i}`), 'need_shopping'));
    }

    const result = scoreAndSort({
      tieredRecipes: recipes,
      calendarEntries: [],
      inventory: [],
      recipeIngredients: new Map(),
    });

    const canMakeNow = result.filter(r => r.tier === 'can_make_now');
    const needShopping = result.filter(r => r.tier === 'need_shopping');
    expect(canMakeNow.length).toBeLessThanOrEqual(4);
    expect(needShopping.length).toBeLessThanOrEqual(4);
  });
});
