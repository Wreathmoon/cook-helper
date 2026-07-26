import { describe, it, expect, afterEach } from 'vitest';
import { generateShoppingList, checkoutShoppingList } from '../index';
import { makeTestVault } from '@/lib/vault/__tests__/make-test-vault';

let vault: ReturnType<typeof makeTestVault>;

afterEach(() => vault?.cleanup());

describe('generateShoppingList', () => {
  it('stock_level=out 的食材出现在购物清单', async () => {
    vault = makeTestVault({
      inventory: [
        { name: '西红柿', category: 'vegetable', stock_level: 'enough' },
        { name: '牛肉', category: 'meat', stock_level: 'out' },
      ],
      recipes: [
        {
          id: 'r1',
          name: '番茄炒牛肉',
          ingredients: [
            { name: '西红柿', amount: '2个' },
            { name: '牛肉', amount: '300g' },
          ],
        },
      ],
    });

    const result = await generateShoppingList(vault, ['r1']);

    const beef = result.data.find((i) => i.name === '牛肉');
    expect(beef).toBeDefined();
    expect(beef?.category).toBe('meat');
    expect(beef?.inventoryId).toBe('牛肉');
    expect(beef?.source).toBe('番茄炒牛肉');
    expect(beef?.suggestedAmount).toBe('300g');
    // enough 的不该进清单
    expect(result.data.find((i) => i.name === '西红柿')).toBeUndefined();
  });

  it('low/out 的调料/主食/蛋奶自动添加，蔬菜不自动添加', async () => {
    vault = makeTestVault({
      inventory: [
        { name: '盐', category: 'seasoning', stock_level: 'low' },
        { name: '大米', category: 'staple', stock_level: 'out' },
        { name: '鸡蛋', category: 'egg_dairy_bean', stock_level: 'low' },
        { name: '西红柿', category: 'vegetable', stock_level: 'low' },
      ],
    });

    const result = await generateShoppingList(vault, []);

    expect(result.data.find((i) => i.name === '盐')).toBeDefined();
    expect(result.data.find((i) => i.name === '大米')).toBeDefined();
    expect(result.data.find((i) => i.name === '鸡蛋')).toBeDefined();
    expect(result.data.find((i) => i.name === '西红柿')).toBeUndefined();
  });

  it('同一样食材不重复出现', async () => {
    vault = makeTestVault({
      inventory: [{ name: '盐', category: 'seasoning', stock_level: 'out' }],
      recipes: [{ id: 'r1', name: '炒菜', ingredients: [{ name: '盐', role: 'seasoning' }] }],
    });

    const result = await generateShoppingList(vault, ['r1']);
    expect(result.data.filter((i) => i.name === '盐')).toHaveLength(1);
  });

  it('菜谱要用但没有的厨具也进清单', async () => {
    vault = makeTestVault({
      inventory: [{ name: '鸡蛋', category: 'egg_dairy_bean', stock_level: 'enough' }],
      utensils: ['炒锅'],
      recipes: [
        { id: 'r1', name: '蒸蛋羹', ingredients: [{ name: '鸡蛋' }], utensils: ['蒸锅', '炒锅'] },
      ],
    });

    const result = await generateShoppingList(vault, ['r1']);
    expect(result.data.map((i) => i.name)).toContain('蒸锅');
    expect(result.data.map((i) => i.name)).not.toContain('炒锅');
  });

  it('库存里根本没有的食材，用菜谱里的名字进清单', async () => {
    vault = makeTestVault({
      inventory: [],
      recipes: [{ id: 'r1', name: '啤酒鸭', ingredients: [{ name: '鸭' }] }],
    });

    const result = await generateShoppingList(vault, ['r1']);
    expect(result.data.map((i) => i.name)).toContain('鸭');
  });

  it('别名会被归一：菜谱写「番茄」也能对上库存里的「西红柿」', async () => {
    vault = makeTestVault({
      aliases: new Map([['番茄', '西红柿']]),
      inventory: [{ name: '西红柿', category: 'vegetable', stock_level: 'out' }],
      recipes: [{ id: 'r1', name: '番茄炒蛋', ingredients: [{ name: '番茄' }] }],
    });

    const result = await generateShoppingList(vault, ['r1']);
    const items = result.data.filter((i) => i.inventoryId === '西红柿');
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('西红柿');
  });

  it('includePlannedRecipes 会把日历上计划中的菜也算进来', async () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    vault = makeTestVault({
      inventory: [{ name: '牛肉', category: 'meat', stock_level: 'out' }],
      recipes: [{ id: 'r1', name: '红烧牛肉', ingredients: [{ name: '牛肉' }] }],
      calendar: [{ id: 'c1', date: tomorrow, recipe_id: 'r1', status: 'planned' }],
    });

    const without = await generateShoppingList(vault, [], false);
    expect(without.data.find((i) => i.name === '牛肉')).toBeUndefined();

    const with_ = await generateShoppingList(vault, [], true);
    expect(with_.data.find((i) => i.name === '牛肉')?.source).toBe('计划: 红烧牛肉');
  });
});

describe('checkoutShoppingList', () => {
  it('勾选的食材被回填为 enough', async () => {
    vault = makeTestVault({
      inventory: [
        { name: '盐', category: 'seasoning', stock_level: 'out' },
        { name: '大米', category: 'staple', stock_level: 'low' },
      ],
    });

    const result = await checkoutShoppingList(vault, ['盐', '大米']);
    expect(result.error).toBeNull();
    expect(vault.inventory.every((i) => i.stock_level === 'enough')).toBe(true);
  });

  it('空列表直接返回成功', async () => {
    vault = makeTestVault({ inventory: [] });
    const result = await checkoutShoppingList(vault, []);
    expect(result.error).toBeNull();
  });
});
