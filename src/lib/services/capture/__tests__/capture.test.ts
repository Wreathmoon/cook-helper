import { describe, it, expect, afterEach } from 'vitest';
import {
  applyCooked,
  applyInventoryDecisions,
  buildCookedProposal,
  buildInventoryProposal,
  undoCapture,
  type CaptureDecision,
} from '../index';
import { makeTestVault } from '@/lib/vault/__tests__/make-test-vault';

let vault: ReturnType<typeof makeTestVault>;

afterEach(() => vault?.cleanup());

const EIGHT_DAYS_AGO = '2026-07-28';

function setup() {
  vault = makeTestVault({
    inventory: [
      // 放了 8 天的青菜——它现在在「清库存」档里，这一点是下面撤销测试的靶心
      {
        name: '西红柿',
        category: 'vegetable',
        stock_level: 'enough',
        last_restocked_at: EIGHT_DAYS_AGO,
      },
      { name: '牛肉', category: 'meat', stock_level: 'out', last_restocked_at: null },
      { name: '鸡蛋', category: 'egg_dairy_bean', stock_level: 'low', last_restocked_at: null },
    ],
    recipes: [
      {
        id: 'r1',
        name: '西红柿炒蛋',
        ingredients: [
          { name: '西红柿', role: 'main' },
          { name: '鸡蛋', role: 'main' },
          { name: '盐', role: 'seasoning' },
        ],
      },
      { id: 'r2', name: '红烧牛肉', ingredients: [{ name: '牛肉', role: 'main' }] },
    ],
    aliases: new Map([['番茄', '西红柿']]),
  });
  return vault;
}

describe('buildInventoryProposal', () => {
  it('按「库存里有没有」分成两组', () => {
    setup();
    const proposal = buildInventoryProposal(vault, [
      { name: '西红柿', category: 'vegetable' },
      { name: '土豆', category: 'vegetable' },
    ]);

    expect(proposal.existing.map((i) => i.name)).toEqual(['西红柿']);
    expect(proposal.fresh.map((i) => i.name)).toEqual(['土豆']);
    expect(proposal.fresh[0].currentLevel).toBeNull();
  });

  it('走别名表归一化，「番茄」认得出是已有的「西红柿」', () => {
    setup();
    const proposal = buildInventoryProposal(vault, [{ name: '番茄', category: 'vegetable' }]);

    expect(proposal.fresh).toHaveLength(0);
    expect(proposal.existing).toHaveLength(1);
    // 原文要留着——它是别名表在起作用的证据，UI 上要让用户看见
    expect(proposal.existing[0].rawName).toBe('番茄');
    expect(proposal.existing[0].name).toBe('西红柿');
  });

  it('归一化后重复的只留一条（模型把同一样东西写了两遍）', () => {
    setup();
    const proposal = buildInventoryProposal(vault, [
      { name: '番茄', category: 'vegetable' },
      { name: '西红柿', category: 'vegetable' },
    ]);
    expect(proposal.existing).toHaveLength(1);
  });

  it('已在库存里的，分类以库存为准——不让模型的一次猜测改掉用户分好的类', () => {
    setup();
    const proposal = buildInventoryProposal(vault, [{ name: '牛肉', category: 'staple' }]);
    expect(proposal.existing[0].category).toBe('meat');
  });

  it('空名字丢掉，它当不了关联键', () => {
    setup();
    const proposal = buildInventoryProposal(vault, [
      { name: '   ', category: 'vegetable' },
      { name: '土豆', category: 'vegetable' },
    ]);
    expect(proposal.existing).toHaveLength(0);
    expect(proposal.fresh).toHaveLength(1);
  });
});

describe('buildCookedProposal', () => {
  it('精确匹配到菜谱，并给出主要食材的当前档位', () => {
    setup();
    const proposal = buildCookedProposal(vault, '西红柿炒蛋');

    expect(proposal.matched?.id).toBe('r1');
    // 只取 main，调料不进来——与手动路径一致
    expect(proposal.ingredients.map((i) => i.name)).toEqual(['西红柿', '鸡蛋']);
    // 建议档位 = 当前档位，不猜下降
    expect(proposal.ingredients.map((i) => i.suggestedLevel)).toEqual(['enough', 'low']);
  });

  it('匹配不上就给候选列表让用户选，绝不模糊匹配', () => {
    setup();
    const proposal = buildCookedProposal(vault, '红烧肉'); // 库里只有「红烧牛肉」

    expect(proposal.matched).toBeNull();
    expect(proposal.candidates.map((c) => c.name)).toEqual(['西红柿炒蛋', '红烧牛肉']);
  });

  it('菜名不套食材别名表——别名是给食材用的', () => {
    setup();
    // 「番茄」是「西红柿」的食材别名，但没有叫「番茄」的菜谱，不能因此匹配到「西红柿炒蛋」
    expect(buildCookedProposal(vault, '番茄').matched).toBeNull();
  });
});

describe('applyInventoryDecisions + undoCapture', () => {
  const decisions = (): CaptureDecision[] => [
    { id: '土豆', name: '土豆', category: 'vegetable', stock_level: 'enough', isNew: true },
    { id: '牛肉', name: '牛肉', category: 'meat', stock_level: 'enough', isNew: false },
  ];

  it('新增 + 改档位都落库，并返回可用的快照', async () => {
    setup();
    const result = await applyInventoryDecisions(vault, decisions());

    expect(result.error).toBeNull();
    expect(result.data.added).toEqual(['土豆']);
    expect(vault.inventory.find((i) => i.id === '土豆')?.stock_level).toBe('enough');
    expect(vault.inventory.find((i) => i.id === '牛肉')?.stock_level).toBe('enough');
    // 快照存的是**旧**值
    expect(result.data.restore).toEqual([
      { id: '牛肉', stock_level: 'out', last_restocked_at: null },
    ]);
  });

  it('撤销把世界恢复原样：新增的删掉，档位写回', async () => {
    setup();
    const applied = await applyInventoryDecisions(vault, decisions());
    const undo = await undoCapture(vault, applied.data);

    expect(undo.error).toBeNull();
    expect(vault.inventory.find((i) => i.id === '土豆')).toBeUndefined();
    expect(vault.inventory.find((i) => i.id === '牛肉')?.stock_level).toBe('out');
  });

  it('撤销不能把 last_restocked_at 盖成今天——那会让食材静默退出「清库存」档', async () => {
    setup();
    const before = vault.inventory.find((i) => i.id === '西红柿')!.last_restocked_at;
    expect(before).toBe(EIGHT_DAYS_AGO);

    // 误把一样放了 8 天的东西又标成「刚买的」
    const applied = await applyInventoryDecisions(vault, [
      { id: '西红柿', name: '西红柿', category: 'vegetable', stock_level: 'enough', isNew: false },
    ]);
    // 落库时按补货规则盖了今天，这是对的
    expect(vault.inventory.find((i) => i.id === '西红柿')!.last_restocked_at).not.toBe(before);

    await undoCapture(vault, applied.data);

    // 撤销后必须回到 8 天前，否则推荐引擎再也不会把它算成待清库存
    expect(vault.inventory.find((i) => i.id === '西红柿')!.last_restocked_at).toBe(before);
  });
});

describe('applyCooked', () => {
  it('写一条 completed 日历 + 改档位，且可整体撤销', async () => {
    setup();
    const applied = await applyCooked(vault, {
      recipeId: 'r1',
      date: '2026-08-05',
      decisions: [
        { id: '鸡蛋', name: '鸡蛋', category: 'egg_dairy_bean', stock_level: 'out', isNew: false },
      ],
    });

    expect(applied.error).toBeNull();
    expect(vault.calendar).toHaveLength(1);
    expect(vault.calendar[0].status).toBe('completed');
    expect(vault.inventory.find((i) => i.id === '鸡蛋')?.stock_level).toBe('out');

    await undoCapture(vault, applied.data);

    expect(vault.calendar).toHaveLength(0);
    expect(vault.inventory.find((i) => i.id === '鸡蛋')?.stock_level).toBe('low');
  });

  it('菜谱不存在时报错，且不留下半条日历', async () => {
    setup();
    const applied = await applyCooked(vault, {
      recipeId: '不存在',
      date: '2026-08-05',
      decisions: [],
    });

    expect(applied.error).toBe('菜谱不存在');
    expect(vault.calendar).toHaveLength(0);
    expect(applied.data.calendarEntries).toEqual([]);
  });
});
