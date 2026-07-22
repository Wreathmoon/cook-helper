import { describe, it, expect } from 'vitest';
import { tierRecipes } from '../tiering';
import type { Recipe, InventoryItem, Utensil, CalendarEntry } from '@/types';

// ── helpers ──────────────────────────────────────────────
function makeInventory(overrides: Partial<InventoryItem> & { id: string; name: string; category: InventoryItem['category'] }): InventoryItem {
  return {
    user_id: 'u1',
    total_amount: null,
    stock_level: 'enough',
    unit: null,
    last_restocked_at: new Date().toISOString(),
    note: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeRecipe(id: string, name: string, cookTime: number | null = null): Recipe {
  return {
    id,
    user_id: 'u1',
    name,
    steps: null,
    cook_time_minutes: cookTime,
    difficulty: null,
    attributes: {},
    tips: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

const day = 86400000;

// ── tests ────────────────────────────────────────────────
describe('tierRecipes', () => {
  it('所有食材 enough + 厨具齐全 → can_make_now', () => {
    const recipe = makeRecipe('r1', '番茄炒蛋');
    const inv1 = makeInventory({ id: 'i1', name: '西红柿', category: 'vegetable', stock_level: 'enough' });
    const inv2 = makeInventory({ id: 'i2', name: '鸡蛋', category: 'egg_dairy_bean', stock_level: 'enough' });

    const result = tierRecipes({
      recipes: [recipe],
      inventory: [inv1, inv2],
      utensils: [{ id: 'ut1', user_id: 'u1', name: '炒锅', note: null, created_at: '', updated_at: '' }],
      calendarEntries: [],
      recipeIngredients: new Map([['r1', [{ inventory_id: 'i1', role: 'main' }, { inventory_id: 'i2', role: 'main' }]]]),
      recipeUtensils: new Map([['r1', ['炒锅']]]),
    });

    expect(result).toHaveLength(1);
    expect(result[0].tier).toBe('can_make_now');
  });

  it('缺 1-3 样食材 → need_shopping', () => {
    const recipe = makeRecipe('r1', '番茄炒蛋');
    const inv1 = makeInventory({ id: 'i1', name: '西红柿', category: 'vegetable', stock_level: 'enough' });
    const inv2 = makeInventory({ id: 'i2', name: '鸡蛋', category: 'egg_dairy_bean', stock_level: 'out' });

    const result = tierRecipes({
      recipes: [recipe],
      inventory: [inv1, inv2],
      utensils: [],
      calendarEntries: [],
      recipeIngredients: new Map([['r1', [{ inventory_id: 'i1', role: 'main' }, { inventory_id: 'i2', role: 'main' }]]]),
      recipeUtensils: new Map(),
    });

    expect(result).toHaveLength(1);
    expect(result[0].tier).toBe('need_shopping');
    expect(result[0].missingIngredients).toContain('鸡蛋');
  });

  it('缺厨具 → need_shopping', () => {
    const recipe = makeRecipe('r1', '蒸鸡蛋羹');
    const inv1 = makeInventory({ id: 'i1', name: '鸡蛋', category: 'egg_dairy_bean', stock_level: 'enough' });

    const result = tierRecipes({
      recipes: [recipe],
      inventory: [inv1],
      utensils: [], // 没有蒸锅
      calendarEntries: [],
      recipeIngredients: new Map([['r1', [{ inventory_id: 'i1', role: 'main' }]]]),
      recipeUtensils: new Map([['r1', ['蒸锅']]]),
    });

    expect(result).toHaveLength(1);
    expect(result[0].tier).toBe('need_shopping');
    expect(result[0].missingUtensils).toContain('蒸锅');
  });

  it('食材 enough 但 last_restocked_at 超过阈值 → clear_stock', () => {
    const recipe = makeRecipe('r1', '炒青菜');
    // 蔬菜 4 天前补货，阈值 3 天
    const inv1 = makeInventory({
      id: 'i1', name: '白菜', category: 'vegetable', stock_level: 'enough',
      last_restocked_at: new Date(Date.now() - 4 * day).toISOString(),
    });

    const result = tierRecipes({
      recipes: [recipe],
      inventory: [inv1],
      utensils: [],
      calendarEntries: [],
      recipeIngredients: new Map([['r1', [{ inventory_id: 'i1', role: 'main' }]]]),
      recipeUtensils: new Map(),
    });

    expect(result).toHaveLength(1);
    expect(result[0].tier).toBe('clear_stock');
    expect(result[0].clearStockIngredients).toContain('白菜');
  });

  it('缺太多食材（>6 且厨具 >2）→ 不出现在结果中', () => {
    const recipe = makeRecipe('r1', '大杂烩');
    // 7 样食材全部 out
    const inventory: InventoryItem[] = [];
    const ingredients: { inventory_id: string; role: string }[] = [];
    for (let i = 0; i < 7; i++) {
      inventory.push(makeInventory({ id: `i${i}`, name: `食材${i}`, category: 'vegetable', stock_level: 'out' }));
      ingredients.push({ inventory_id: `i${i}`, role: 'main' });
    }

    const result = tierRecipes({
      recipes: [recipe],
      inventory,
      utensils: [],
      calendarEntries: [],
      recipeIngredients: new Map([['r1', ingredients]]),
      recipeUtensils: new Map([['r1', ['炒锅', '蒸锅', '煮锅']]]), // 3 个厨具也缺
    });

    expect(result).toHaveLength(0);
  });

  it('边界：蔬菜 >3 天触发清库存', () => {
    const recipe = makeRecipe('r1', '蔬菜');
    const inv = makeInventory({
      id: 'i1', name: '菠菜', category: 'vegetable', stock_level: 'enough',
      last_restocked_at: new Date(Date.now() - 4 * day).toISOString(),
    });
    const result = tierRecipes({
      recipes: [recipe],
      inventory: [inv],
      utensils: [],
      calendarEntries: [],
      recipeIngredients: new Map([['r1', [{ inventory_id: 'i1', role: 'main' }]]]),
      recipeUtensils: new Map(),
    });
    expect(result[0].tier).toBe('clear_stock');
  });

  it('边界：肉类 >7 天触发清库存', () => {
    const recipe = makeRecipe('r1', '肉');
    const inv = makeInventory({
      id: 'i1', name: '猪肉', category: 'meat', stock_level: 'enough',
      last_restocked_at: new Date(Date.now() - 8 * day).toISOString(),
    });
    const result = tierRecipes({
      recipes: [recipe],
      inventory: [inv],
      utensils: [],
      calendarEntries: [],
      recipeIngredients: new Map([['r1', [{ inventory_id: 'i1', role: 'main' }]]]),
      recipeUtensils: new Map(),
    });
    expect(result[0].tier).toBe('clear_stock');
  });

  it('边界：蛋奶 >5 天触发清库存', () => {
    const recipe = makeRecipe('r1', '蛋');
    const inv = makeInventory({
      id: 'i1', name: '鸡蛋', category: 'egg_dairy_bean', stock_level: 'enough',
      last_restocked_at: new Date(Date.now() - 6 * day).toISOString(),
    });
    const result = tierRecipes({
      recipes: [recipe],
      inventory: [inv],
      utensils: [],
      calendarEntries: [],
      recipeIngredients: new Map([['r1', [{ inventory_id: 'i1', role: 'main' }]]]),
      recipeUtensils: new Map(),
    });
    expect(result[0].tier).toBe('clear_stock');
  });

  it('边界：主食和调料不触发清库存', () => {
    const recipe = makeRecipe('r1', '米饭');
    const invStaple = makeInventory({
      id: 'i1', name: '大米', category: 'staple', stock_level: 'enough',
      last_restocked_at: new Date(Date.now() - 30 * day).toISOString(),
    });
    const invSeason = makeInventory({
      id: 'i2', name: '盐', category: 'seasoning', stock_level: 'enough',
      last_restocked_at: new Date(Date.now() - 30 * day).toISOString(),
    });
    const result = tierRecipes({
      recipes: [recipe],
      inventory: [invStaple, invSeason],
      utensils: [],
      calendarEntries: [],
      recipeIngredients: new Map([['r1', [{ inventory_id: 'i1', role: 'main' }, { inventory_id: 'i2', role: 'seasoning' }]]]),
      recipeUtensils: new Map(),
    });
    expect(result).toHaveLength(1);
    expect(result[0].tier).toBe('can_make_now');
    expect(result[0].clearStockIngredients).toBeUndefined();
  });

  it('边界：stock_level 为 low 的食材视为缺失', () => {
    const recipe = makeRecipe('r1', '番茄炒蛋');
    const inv1 = makeInventory({ id: 'i1', name: '西红柿', category: 'vegetable', stock_level: 'low' });
    const inv2 = makeInventory({ id: 'i2', name: '鸡蛋', category: 'egg_dairy_bean', stock_level: 'enough' });

    const result = tierRecipes({
      recipes: [recipe],
      inventory: [inv1, inv2],
      utensils: [],
      calendarEntries: [],
      recipeIngredients: new Map([['r1', [{ inventory_id: 'i1', role: 'main' }, { inventory_id: 'i2', role: 'main' }]]]),
      recipeUtensils: new Map(),
    });

    expect(result).toHaveLength(1);
    expect(result[0].tier).toBe('need_shopping');
    expect(result[0].missingIngredients).toContain('西红柿');
  });
});
