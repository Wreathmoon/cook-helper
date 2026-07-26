/**
 * 种子 vault 的质量守门。
 *
 * 守的是「下载下来一打开就好看」这个承诺——它是自托管项目最容易挂掉的一步。
 * 前身是 `services/seed/__tests__/initUser.test.ts` 的 6 个种子数据质量测试，
 * 数据源从 `seed-data.ts` 换成了 `seed/` vault（那 3 个 hash 档位分配测试随
 * `initUser.ts` 一起删了——现在种子档位是手工调的，没有 hash 可测）。
 */
import { describe, it, expect } from 'vitest';
import { loadVault } from '@/lib/vault';
import { tierRecipes } from '@/lib/recommend/tiering';
import { normalizeIngredientName } from '@/lib/utils/normalize-name';

const vault = loadVault('seed');

describe('种子 vault 数据质量', () => {
  it('覆盖了所有 5 个分类', () => {
    const categories = new Set(vault.inventory.map((item) => item.category));
    expect(categories).toEqual(
      new Set(['vegetable', 'meat', 'egg_dairy_bean', 'staple', 'seasoning'])
    );
  });

  it('数量充足（食材 ≥30、菜谱 ≥30、合计 >80）', () => {
    expect(vault.inventory.length).toBeGreaterThanOrEqual(30);
    expect(vault.recipes.length).toBeGreaterThanOrEqual(30);
    expect(vault.inventory.length + vault.recipes.length).toBeGreaterThan(80);
  });

  it('每道菜的食材名都能匹配到库存（归一化 + 别名之后 100%）', () => {
    const known = new Set(vault.inventory.map((item) => item.id));
    const missing: string[] = [];
    let total = 0;

    for (const recipe of vault.recipes) {
      for (const ing of vault.recipeIngredients.get(recipe.id) ?? []) {
        total++;
        if (!known.has(normalizeIngredientName(ing.inventory_id, vault.aliases))) {
          missing.push(`${recipe.name} -> ${ing.inventory_id}`);
        }
      }
    }

    expect(total).toBeGreaterThan(300);
    expect(missing).toEqual([]);
  });

  it('每道菜都有 attributes', () => {
    for (const recipe of vault.recipes) {
      expect(recipe.attributes).toBeDefined();
      expect(typeof recipe.attributes).toBe('object');
    }
  });

  it('每道菜都有至少一个食材和至少一个步骤', () => {
    for (const recipe of vault.recipes) {
      expect(vault.recipeIngredients.get(recipe.id)?.length ?? 0).toBeGreaterThan(0);
      expect(recipe.steps?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('调料 ≥10 种、主食 ≥3 种', () => {
    const count = (category: string) =>
      vault.inventory.filter((item) => item.category === category).length;
    expect(count('seasoning')).toBeGreaterThanOrEqual(10);
    expect(count('staple')).toBeGreaterThanOrEqual(3);
  });

  it('菜谱要用的厨具都在厨具清单里 —— 别让首屏被厨具挡住', () => {
    const owned = new Set(vault.utensils.map((item) => item.name));
    const missing = [...vault.recipeUtensils.values()]
      .flat()
      .filter((name) => !owned.has(name));
    expect([...new Set(missing)]).toEqual([]);
  });
});

describe('首屏推荐质量 —— 三档都必须有内容', () => {
  const tiered = tierRecipes({
    recipes: vault.recipes,
    inventory: vault.inventory,
    utensils: vault.utensils,
    calendarEntries: vault.calendar,
    recipeIngredients: vault.recipeIngredients,
    recipeUtensils: vault.recipeUtensils,
  });

  const countOf = (tier: string) => tiered.filter((item) => item.tier === tier).length;

  it('「现在就能做」至少 4 道', () => {
    expect(countOf('can_make_now')).toBeGreaterThanOrEqual(4);
  });

  it('「该清库存了」至少 4 道 —— 靠固定的老补货日期，不会随时间失效', () => {
    expect(countOf('clear_stock')).toBeGreaterThanOrEqual(4);
  });

  it('「差一点」至少 4 道', () => {
    expect(countOf('need_shopping')).toBeGreaterThanOrEqual(4);
  });

  it('没有一道菜提示「未知食材」—— 缺料提示必须能直接抄进购物清单', () => {
    const unknown = tiered.filter((item) => item.missingIngredients?.includes('未知食材'));
    expect(unknown.map((item) => item.recipe.name)).toEqual([]);
  });
});
