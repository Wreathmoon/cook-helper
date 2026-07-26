import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import {
  listInventory,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  batchUpdateStockLevel,
  markRestocked,
  batchMarkRestocked,
} from '../index';
import { makeTestVault } from '@/lib/vault/__tests__/make-test-vault';
import { vaultPaths } from '@/lib/vault';

let vault: ReturnType<typeof makeTestVault>;

afterEach(() => vault?.cleanup());

function setup() {
  vault = makeTestVault({
    inventory: [
      { name: '西红柿', category: 'vegetable', stock_level: 'enough' },
      { name: '牛肉', category: 'meat', stock_level: 'out' },
      { name: '盐', category: 'seasoning', stock_level: 'low' },
    ],
  });
  return vault;
}

/** 读回落盘的 yaml —— 服务层写没写对，看文件最实在 */
function readCategoryFile(category: string): Record<string, unknown>[] {
  return parseYaml(readFileSync(vaultPaths.inventoryFile(vault.root, category), 'utf8')) ?? [];
}

describe('listInventory', () => {
  it('返回全部食材，按分类和名称排序', async () => {
    setup();
    const result = await listInventory(vault);
    expect(result.error).toBeNull();
    expect(result.data.map((i) => i.name)).toEqual(['牛肉', '盐', '西红柿']);
  });

  it('按分类筛选', async () => {
    setup();
    const result = await listInventory(vault, 'meat');
    expect(result.data.map((i) => i.name)).toEqual(['牛肉']);
  });
});

describe('addInventoryItem', () => {
  it('新增食材并写进对应分类文件', async () => {
    setup();
    const result = await addInventoryItem(vault, { name: '白菜', category: 'vegetable' });

    expect(result.error).toBeNull();
    expect(result.data?.name).toBe('白菜');
    expect(readCategoryFile('vegetable').map((row) => row.name)).toEqual(['白菜', '西红柿']);
  });

  it('id 用归一化后的名称 —— 这是 vault 的关联键', async () => {
    setup();
    const result = await addInventoryItem(vault, { name: '  土豆 ', category: 'vegetable' });
    expect(result.data?.id).toBe('土豆');
  });

  it('默认 enough 时记一笔补货日期', async () => {
    setup();
    const result = await addInventoryItem(vault, { name: '黄瓜', category: 'vegetable' });
    expect(result.data?.stock_level).toBe('enough');
    expect(result.data?.last_restocked_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('out / low 不记补货日期', async () => {
    setup();
    const result = await addInventoryItem(vault, {
      name: '黄瓜',
      category: 'vegetable',
      stock_level: 'out',
    });
    expect(result.data?.last_restocked_at).toBeNull();
  });

  it('重名被拒绝', async () => {
    setup();
    const result = await addInventoryItem(vault, { name: '西红柿', category: 'vegetable' });
    expect(result.data).toBeNull();
    expect(result.error).toContain('已经在库存里');
  });
});

describe('updateInventoryItem', () => {
  it('改成 enough 时刷新补货日期', async () => {
    setup();
    const result = await updateInventoryItem(vault, '牛肉', { stock_level: 'enough' });
    expect(result.data?.stock_level).toBe('enough');
    expect(result.data?.last_restocked_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('改名时 id 跟着走', async () => {
    setup();
    const result = await updateInventoryItem(vault, '牛肉', { name: '牛腩' });
    expect(result.data?.id).toBe('牛腩');
  });

  it('换分类会同时重写两个分类文件', async () => {
    setup();
    await updateInventoryItem(vault, '牛肉', { category: 'staple' });
    expect(readCategoryFile('meat')).toEqual([]);
    expect(readCategoryFile('staple').map((row) => row.name)).toEqual(['牛肉']);
  });

  it('食材不存在时报错而不是静默成功', async () => {
    setup();
    const result = await updateInventoryItem(vault, '不存在的食材', { stock_level: 'low' });
    expect(result.error).toBe('食材不存在');
  });
});

describe('deleteInventoryItem', () => {
  it('删掉后文件里也没有了', async () => {
    setup();
    const result = await deleteInventoryItem(vault, '西红柿');
    expect(result.error).toBeNull();
    expect(vault.inventory.map((i) => i.name)).not.toContain('西红柿');
    expect(readCategoryFile('vegetable')).toEqual([]);
  });
});

describe('batchUpdateStockLevel', () => {
  it('批量改档位，enough 的那条记补货日期，low 的不记', async () => {
    setup();
    await batchUpdateStockLevel(vault, [
      { id: '西红柿', stock_level: 'low' },
      { id: '牛肉', stock_level: 'enough' },
    ]);

    const tomato = vault.inventory.find((i) => i.id === '西红柿')!;
    const beef = vault.inventory.find((i) => i.id === '牛肉')!;
    expect(tomato.stock_level).toBe('low');
    expect(tomato.last_restocked_at).toBeNull();
    expect(beef.stock_level).toBe('enough');
    expect(beef.last_restocked_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('id 对不上的条目跳过，不影响其它条目', async () => {
    setup();
    const result = await batchUpdateStockLevel(vault, [
      { id: '查无此物', stock_level: 'low' },
      { id: '盐', stock_level: 'enough' },
    ]);
    expect(result.error).toBeNull();
    expect(vault.inventory.find((i) => i.id === '盐')!.stock_level).toBe('enough');
  });
});

describe('markRestocked / batchMarkRestocked', () => {
  it('markRestocked 把单条置为 enough', async () => {
    setup();
    const result = await markRestocked(vault, '牛肉');
    expect(result.data?.stock_level).toBe('enough');
    expect(result.data?.last_restocked_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('batchMarkRestocked 把多条置为 enough', async () => {
    setup();
    await batchMarkRestocked(vault, ['牛肉', '盐']);
    expect(vault.inventory.every((i) => i.stock_level === 'enough')).toBe(true);
  });

  it('空数组直接返回成功，不碰文件', async () => {
    setup();
    const result = await batchMarkRestocked(vault, []);
    expect(result.error).toBeNull();
  });
});
