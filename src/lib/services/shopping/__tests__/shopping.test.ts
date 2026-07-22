import { describe, it, expect, vi } from 'vitest';
import { generateShoppingList, checkoutShoppingList } from '../index';

// ── mock Supabase client（支持多表查询）────────────────────
function createMockSupabase(tableResponses: Record<string, any> = {}) {
  const mockChain: any = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'gte', 'lt', 'contains', 'ilike'];

  for (const method of methods) {
    mockChain[method] = vi.fn().mockReturnValue(mockChain);
  }

  // single() 和 thenable 根据表名返回不同数据
  mockChain.single = vi.fn().mockImplementation(() => {
    return Promise.resolve({ data: null, error: null });
  });

  // 使其可 await — 根据最近 from() 调用的表名返回数据
  let currentTable = '';
  const originalFrom = vi.fn().mockImplementation((table: string) => {
    currentTable = table;
    return mockChain;
  });

  // then 使其可 await — 直接 resolve 数据
  mockChain.then = vi.fn().mockImplementation((onFulfilled: any) => {
    const data = tableResponses[currentTable] || [];
    onFulfilled({ data, error: null });
    return mockChain;
  });

  return {
    from: originalFrom,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }),
    },
    _chain: mockChain,
    _tableResponses: tableResponses,
  } as any;
}

describe('generateShoppingList', () => {
  it('stock_level=out 的食材出现在购物清单', async () => {
    const inventoryData = [
      { id: 'i1', name: '西红柿', category: 'vegetable', stock_level: 'enough' },
      { id: 'i2', name: '牛肉', category: 'meat', stock_level: 'out' },
    ];
    const recipeIngredientsData = [
      { inventory_id: 'i1', amount: '2个', recipes: { name: '番茄炒蛋' } },
      { inventory_id: 'i2', amount: '300g', recipes: { name: '番茄炒蛋' } },
    ];

    const supabase = createMockSupabase({
      inventory: inventoryData,
      recipe_ingredients: recipeIngredientsData,
      recipe_utensils: [],
      utensils: [],
      calendar_entries: [],
    });

    const result = await generateShoppingList(supabase, 'u1', ['r1']);

    // 牛肉 stock_level=out 应该出现在清单中
    const beefItem = result.data.find(i => i.name === '牛肉');
    expect(beefItem).toBeDefined();
    expect(beefItem?.category).toBe('meat');
    expect(beefItem?.inventoryId).toBe('i2');
  });

  it('low/out 的调料/主食/蛋奶自动添加到清单', async () => {
    const inventoryData = [
      { id: 'i1', name: '盐', category: 'seasoning', stock_level: 'low' },
      { id: 'i2', name: '大米', category: 'staple', stock_level: 'out' },
      { id: 'i3', name: '鸡蛋', category: 'egg_dairy_bean', stock_level: 'low' },
      { id: 'i4', name: '西红柿', category: 'vegetable', stock_level: 'low' }, // 蔬菜不自动添加
    ];

    const supabase = createMockSupabase({
      inventory: inventoryData,
      recipe_ingredients: [],
      recipe_utensils: [],
      utensils: [],
    });

    const result = await generateShoppingList(supabase, 'u1', []);

    // 调料/主食/蛋奶 low/out 应出现
    expect(result.data.find(i => i.name === '盐')).toBeDefined();
    expect(result.data.find(i => i.name === '大米')).toBeDefined();
    expect(result.data.find(i => i.name === '鸡蛋')).toBeDefined();
    // 蔬菜 low 不应自动出现（没有选中菜谱需要它）
    expect(result.data.find(i => i.name === '西红柿')).toBeUndefined();
  });

  it('不重复添加已有 inventoryId 的项', async () => {
    const inventoryData = [
      { id: 'i1', name: '盐', category: 'seasoning', stock_level: 'out' },
    ];
    // recipe_ingredients 里也引用了 i1（盐），且 stock_level=out
    const recipeIngredientsData = [
      { inventory_id: 'i1', amount: '适量', recipes: { name: '炒菜' } },
    ];

    const supabase = createMockSupabase({
      inventory: inventoryData,
      recipe_ingredients: recipeIngredientsData,
      recipe_utensils: [],
      utensils: [],
    });

    const result = await generateShoppingList(supabase, 'u1', ['r1']);

    // 盐只应出现一次
    const saltItems = result.data.filter(i => i.name === '盐');
    expect(saltItems.length).toBe(1);
  });
});

describe('checkoutShoppingList', () => {
  it('调用 batchMarkRestocked 进行回填', async () => {
    const supabase = createMockSupabase();

    const result = await checkoutShoppingList(supabase, 'u1', ['i1', 'i2']);

    // checkoutShoppingList 内部调用 batchMarkRestocked
    // batchMarkRestocked 对每个 id 调用 update
    expect(supabase.from).toHaveBeenCalledWith('inventory');
    expect(result.error).toBeNull();
  });

  it('空列表直接返回成功', async () => {
    const supabase = createMockSupabase();

    const result = await checkoutShoppingList(supabase, 'u1', []);

    expect(result.error).toBeNull();
    // 不应调用任何数据库操作
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
