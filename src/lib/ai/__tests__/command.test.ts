import { describe, it, expect, afterEach } from 'vitest';
import { renderMemoryBlock, hasLiveMemories } from '../memory-prompt';
import { applyMemoryVerdicts } from '../verdict';
import { applyProposal, validateProposal, type ConfirmedChange } from '@/lib/services/command';
import { undoCapture } from '@/lib/services/capture';
import { makeTestVault } from '@/lib/vault/__tests__/make-test-vault';
import type { Memory, RecommendedRecipe } from '@/types';

let vault: ReturnType<typeof makeTestVault>;
afterEach(() => vault?.cleanup());

function memory(patch: Partial<Memory> & { id: string; content: string }): Memory {
  return {
    fileName: `${patch.id}.md`,
    type: 'preference',
    scope: ['kitchen'],
    source: 'stated',
    confidence: 'high',
    enforcement: 'soft',
    created: '2026-01-01',
    expires: null,
    status: 'active',
    ...patch,
  };
}

describe('renderMemoryBlock', () => {
  it('没有活着的记忆时返回空串 —— 空区块比没有区块更糟', () => {
    expect(renderMemoryBlock([])).toBe('');
    expect(
      renderMemoryBlock([memory({ id: 'a', content: '不吃辣', status: 'archived' })])
    ).toBe('');
  });

  it('过期的记忆不进 prompt', () => {
    const expired = memory({ id: 'a', content: '这月少吃肉', type: 'goal', expires: '2026-07-31' });
    expect(renderMemoryBlock([expired], '2026-08-05')).toBe('');
    expect(renderMemoryBlock([expired], '2026-07-31')).toContain('这月少吃肉');
  });

  it('hard / soft 都只是渲染强度，代码不据此过滤', () => {
    const block = renderMemoryBlock([
      memory({ id: 'a', content: '花生过敏', type: 'constraint', enforcement: 'hard' }),
      memory({ id: 'b', content: '不太爱吃香菜', enforcement: 'soft' }),
    ]);
    // 两条都在 —— 没有任何一条被代码剔掉
    expect(block).toContain('花生过敏');
    expect(block).toContain('不太爱吃香菜');
    expect(block).toContain('【必须遵守】');
    expect(block).toContain('【倾向】');
  });

  it('推断来的记忆要标出来，模型才知道它没那么可信', () => {
    const block = renderMemoryBlock([memory({ id: 'a', content: '偏好清淡', source: 'inferred' })]);
    expect(block).toContain('这条是推断的');
  });

  it('提醒模型食材表不是配料表 —— 这是决策 ③ 的整个前提', () => {
    const block = renderMemoryBlock([memory({ id: 'a', content: '花生过敏' })]);
    expect(block).toContain('冰箱库存');
  });

  it('global 域的记忆也进厨房的 prompt', () => {
    expect(hasLiveMemories([memory({ id: 'a', content: '我是极简主义者', scope: ['global'] })])).toBe(
      true
    );
  });
});

describe('applyMemoryVerdicts', () => {
  const rec = (id: string): RecommendedRecipe => ({
    recipe: { id, name: id } as RecommendedRecipe['recipe'],
    tier: 'can_make_now',
    score: 1,
  });

  it('没有判定时原样返回', () => {
    const list = [rec('a'), rec('b')];
    expect(applyMemoryVerdicts(list, [])).toBe(list);
  });

  it('把理由写进 rec.reason —— buildReasons 的固定槽位就靠它', () => {
    const result = applyMemoryVerdicts(
      [rec('a')],
      [{ id: 'a', verdict: 'note', reason: '你说过爱吃清淡的' }]
    );
    expect(result[0].reason).toBe('你说过爱吃清淡的');
  });

  it('**下沉不删除** —— 判错了用户还能看见那道菜和理由', () => {
    const result = applyMemoryVerdicts(
      [rec('a'), rec('b'), rec('c')],
      [{ id: 'a', verdict: 'avoid', reason: '你说过不吃辣' }]
    );
    expect(result).toHaveLength(3);
    expect(result.map((item) => item.recipe.id)).toEqual(['b', 'c', 'a']);
    expect(result[2].reason).toBe('你说过不吃辣');
    expect(result[2].memoryAvoid).toBe(true);
  });

  it('下沉是稳定的：未受影响的那些相对顺序不变', () => {
    const result = applyMemoryVerdicts(
      [rec('a'), rec('b'), rec('c'), rec('d')],
      [
        { id: 'a', verdict: 'avoid', reason: 'x' },
        { id: 'c', verdict: 'avoid', reason: 'y' },
      ]
    );
    expect(result.map((item) => item.recipe.id)).toEqual(['b', 'd', 'a', 'c']);
  });
});

describe('validateProposal', () => {
  function setup() {
    vault = makeTestVault({
      inventory: [{ name: '牛肉', category: 'meat', stock_level: 'enough' }],
      recipes: [{ id: 'r1', name: '红烧牛肉', ingredients: [{ name: '牛肉', role: 'main' }] }],
      aliases: new Map([['番茄', '西红柿']]),
    });
    return vault;
  }

  it('模型编出来的菜谱 id 在给用户看之前就被挡下', () => {
    setup();
    const { valid, rejected } = validateProposal(vault, [
      { kind: 'calendar', date: '2026-08-06', recipe_id: '不存在', recipe_name: '幻觉菜', status: 'planned' },
    ]);
    expect(valid).toHaveLength(0);
    expect(rejected[0].why).toContain('不存在');
  });

  it('库存里没有的食材挡下 —— 命令栏不负责新增食材', () => {
    setup();
    const { valid, rejected } = validateProposal(vault, [
      { kind: 'stock', name: '芦笋', stock_level: 'out' },
    ]);
    expect(valid).toHaveLength(0);
    expect(rejected).toHaveLength(1);
  });

  it('日期格式不对挡下', () => {
    setup();
    const { rejected } = validateProposal(vault, [
      { kind: 'calendar', date: '下周三', recipe_id: 'r1', recipe_name: '红烧牛肉', status: 'planned' },
    ]);
    expect(rejected[0].why).toContain('格式');
  });

  it('合法的放行', () => {
    setup();
    const { valid, rejected } = validateProposal(vault, [
      { kind: 'calendar', date: '2026-08-06', recipe_id: 'r1', recipe_name: '红烧牛肉', status: 'planned' },
      { kind: 'stock', name: '牛肉', stock_level: 'low' },
    ]);
    expect(valid).toHaveLength(2);
    expect(rejected).toHaveLength(0);
  });
});

describe('applyProposal + undo', () => {
  function setup() {
    vault = makeTestVault({
      inventory: [
        { name: '牛肉', category: 'meat', stock_level: 'enough', last_restocked_at: '2026-07-28' },
      ],
      recipes: [{ id: 'r1', name: '红烧牛肉', ingredients: [{ name: '牛肉', role: 'main' }] }],
    });
    return vault;
  }

  const changes: ConfirmedChange[] = [
    { kind: 'calendar', date: '2026-08-06', recipe_id: 'r1', recipe_name: '红烧牛肉', status: 'planned' },
    { kind: 'stock', name: '牛肉', stock_level: 'low' },
  ];

  it('落库日历与档位，并给出快照', async () => {
    setup();
    const result = await applyProposal(vault, changes);

    expect(result.error).toBeNull();
    expect(vault.calendar).toHaveLength(1);
    expect(vault.inventory[0].stock_level).toBe('low');
    expect(result.data.calendarEntries).toHaveLength(1);
  });

  it('撤销走的是拍照录入那一套 —— 连 last_restocked_at 一起恢复', async () => {
    setup();
    const before = vault.inventory[0].last_restocked_at;
    const applied = await applyProposal(vault, changes);
    await undoCapture(vault, applied.data);

    expect(vault.calendar).toHaveLength(0);
    expect(vault.inventory[0].stock_level).toBe('enough');
    expect(vault.inventory[0].last_restocked_at).toBe(before);
  });

  it('中途失败也返回已完成部分的快照，否则用户会卡在改了一半又撤不回去的状态', async () => {
    setup();
    const result = await applyProposal(vault, [
      changes[0],
      { kind: 'stock', name: '根本没有这个', stock_level: 'out' },
    ]);

    expect(result.error).toContain('根本没有这个');
    // 日历那条已经写进去了，快照里必须有它
    expect(result.data.calendarEntries).toHaveLength(1);
    await undoCapture(vault, result.data);
    expect(vault.calendar).toHaveLength(0);
  });
});
