/**
 * 只读沙盒的服务端保证。
 *
 * 客户端那层拦截只是 UX，真正的边界在这里：`READ_ONLY=1` 时任何写入都必须
 * **被拒绝且不落盘**，同时给出的是引导文案而不是一坨异常。
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { existsSync } from 'node:fs';
import { addInventoryItem, batchUpdateStockLevel } from '@/lib/services/inventory';
import { addUtensil } from '@/lib/services/utensil';
import { createRecipe } from '@/lib/services/recipe';
import { makeTestVault } from './make-test-vault';
import { vaultPaths } from '../paths';

let vault: ReturnType<typeof makeTestVault>;

beforeEach(() => {
  process.env.READ_ONLY = '1';
  vault = makeTestVault({
    inventory: [{ name: '西红柿', category: 'vegetable', stock_level: 'enough' }],
  });
});

afterEach(() => {
  delete process.env.READ_ONLY;
  vault?.cleanup();
});

describe('READ_ONLY 下的写入', () => {
  it('添加食材被拒绝，且不写文件', async () => {
    const result = await addInventoryItem(vault, { name: '白菜', category: 'vegetable' });

    expect(result.data).toBeNull();
    expect(result.error).toContain('只读');
    expect(existsSync(vaultPaths.inventoryFile(vault.root, 'vegetable'))).toBe(false);
  });

  it('拒绝时给的是引导而不是堆栈', async () => {
    const result = await addUtensil(vault, { name: '烤箱' });
    expect(result.error).toMatch(/clone|本地/);
    expect(result.error).not.toContain('Error:');
  });

  it('批量改档位被拒绝，内存里的数据也没被改脏', async () => {
    const result = await batchUpdateStockLevel(vault, [{ id: '西红柿', stock_level: 'out' }]);

    expect(result.error).toContain('只读');
    expect(vault.inventory[0].stock_level).toBe('enough');
  });

  it('新建菜谱被拒绝', async () => {
    const result = await createRecipe(vault, { name: '番茄炒蛋' });
    expect(result.data).toBeNull();
    expect(result.error).toContain('只读');
    expect(vault.recipes).toHaveLength(0);
  });
});

describe('没有 READ_ONLY 时', () => {
  it('同样的写入是允许的 —— 证明上面拦住的是开关而不是别的毛病', async () => {
    delete process.env.READ_ONLY;

    const result = await addInventoryItem(vault, { name: '白菜', category: 'vegetable' });
    expect(result.error).toBeNull();
    expect(existsSync(vaultPaths.inventoryFile(vault.root, 'vegetable'))).toBe(true);
  });
});
