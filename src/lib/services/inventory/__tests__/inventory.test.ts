import { describe, it, expect, vi } from 'vitest';
import { batchUpdateStockLevel, markRestocked, batchMarkRestocked, listInventory, addInventoryItem } from '../index';

// ── mock Supabase client ─────────────────────────────────
function createMockSupabase(responses: Record<string, any> = {}) {
  const mockChain: any = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'gte', 'lt', 'contains', 'ilike'];

  for (const method of methods) {
    mockChain[method] = vi.fn().mockReturnValue(mockChain);
  }

  mockChain.single = vi.fn().mockResolvedValue({ data: responses.single || null, error: null });

  // 正确的 thenable 实现 — 直接 resolve 数据，不要包在 Promise 里
  mockChain.then = vi.fn().mockImplementation((onFulfilled: any) => {
    const data = responses.many || [];
    onFulfilled({ data, error: null });
    return mockChain; // 返回 thenable 以支持链式 then 调用
  });

  return {
    from: vi.fn().mockReturnValue(mockChain),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }),
    },
    _chain: mockChain,
  } as any;
}

describe('listInventory', () => {
  it('正确调用 from("inventory") 并返回数据', async () => {
    const mockData = [
      { id: '1', user_id: 'u1', name: '西红柿', category: 'vegetable', stock_level: 'enough' },
    ];
    const supabase = createMockSupabase({ many: mockData });

    const result = await listInventory(supabase, 'u1');
    expect(supabase.from).toHaveBeenCalledWith('inventory');
    expect(result.data).toEqual(mockData);
    expect(result.error).toBeNull();
  });
});

describe('addInventoryItem', () => {
  it('插入食材并返回结果', async () => {
    const newItem = { id: 'new1', user_id: 'u1', name: '白菜', category: 'vegetable', stock_level: 'enough' };
    const supabase = createMockSupabase({ single: newItem });

    const result = await addInventoryItem(supabase, 'u1', { name: '白菜', category: 'vegetable' });
    expect(supabase.from).toHaveBeenCalledWith('inventory');
    expect(result.data).toEqual(newItem);
    expect(result.error).toBeNull();
  });
});

describe('batchUpdateStockLevel', () => {
  it('对每个 item 调用 update 并设置正确参数', async () => {
    const supabase = createMockSupabase();

    const items = [
      { id: 'i1', stock_level: 'low' as const },
      { id: 'i2', stock_level: 'enough' as const },
    ];

    const result = await batchUpdateStockLevel(supabase, 'u1', items);

    // 应该调用 from('inventory') 两次
    const fromCalls = supabase.from.mock.calls;
    expect(fromCalls.length).toBe(2);
    expect(fromCalls[0][0]).toBe('inventory');
    expect(fromCalls[1][0]).toBe('inventory');

    // update 应该被调用
    expect(supabase._chain.update).toHaveBeenCalledTimes(2);

    // 第二个 item stock_level=enough 应该设置 last_restocked_at
    const secondUpdateArg = supabase._chain.update.mock.calls[1][0];
    expect(secondUpdateArg.stock_level).toBe('enough');
    expect(secondUpdateArg.last_restocked_at).toBeDefined();

    expect(result.error).toBeNull();
  });

  it('stock_level 为 low 时不设置 last_restocked_at', async () => {
    const supabase = createMockSupabase();

    const result = await batchUpdateStockLevel(supabase, 'u1', [
      { id: 'i1', stock_level: 'low' },
    ]);

    const updateArg = supabase._chain.update.mock.calls[0][0];
    expect(updateArg.stock_level).toBe('low');
    expect(updateArg.last_restocked_at).toBeUndefined();
    expect(result.error).toBeNull();
  });
});

describe('markRestocked', () => {
  it('设置 stock_level=enough 和 last_restocked_at', async () => {
    const updatedItem = { id: 'i1', stock_level: 'enough', last_restocked_at: new Date().toISOString() };
    const supabase = createMockSupabase({ single: updatedItem });

    const result = await markRestocked(supabase, 'u1', 'i1');

    expect(supabase.from).toHaveBeenCalledWith('inventory');
    expect(supabase._chain.update).toHaveBeenCalled();

    const updateArg = supabase._chain.update.mock.calls[0][0];
    expect(updateArg.stock_level).toBe('enough');
    expect(updateArg.last_restocked_at).toBeDefined();
    expect(result.data).toEqual(updatedItem);
  });
});

describe('batchMarkRestocked', () => {
  it('对每个 id 调用 update 设置 enough', async () => {
    const supabase = createMockSupabase();

    const result = await batchMarkRestocked(supabase, 'u1', ['i1', 'i2', 'i3']);

    expect(supabase._chain.update).toHaveBeenCalledTimes(3);
    for (const call of supabase._chain.update.mock.calls) {
      expect(call[0].stock_level).toBe('enough');
      expect(call[0].last_restocked_at).toBeDefined();
    }
    expect(result.error).toBeNull();
  });

  it('空数组不调用 update', async () => {
    const supabase = createMockSupabase();
    const result = await batchMarkRestocked(supabase, 'u1', []);
    expect(supabase._chain.update).not.toHaveBeenCalled();
    expect(result.error).toBeNull();
  });
});
