/**
 * 把 A 层纯函数包成 agent 的工具集 —— DESIGN.md §6 #5 那条决策的兑现。
 *
 * A 层签名统一为 `fn(vault, args)`，天生就能包成 tool。这是一期架构的回报。
 *
 * ## 最重要的一条：**写操作不在这里执行**
 *
 * 工具集里**没有任何会写盘的工具**。模型想改东西时，只能调 `propose_changes`——
 * 一个**故意不带 `execute` 的工具**。AI SDK 在「调用了没有 execute 的工具」时会
 * 停止循环并把这次调用交还给我们，于是提案原样浮到 UI 上等用户确认，
 * 真正的落库由确定性代码在另一个 action 里完成。
 *
 * 为什么这么做，而不是给每个写工具挂一个审批回调：
 *
 * - **写入根本没有进入循环**。不存在「审批逻辑写漏了一个分支」这种失败模式——
 *   循环里没有写能力，漏也漏不出来。
 * - 和 Task/11 的心智模型完全一致：提案 → 确认 → 落库 → 可撤销。
 *   用户在命令栏里看到的确认屏，和拍照录入那个是同一套东西。
 * - Server Action 是无状态的一来一回，多轮审批往返要自己维护会话状态，
 *   而那份状态一旦和模型的上下文对不上，就会出现「确认了 A 却执行了 B」。
 *
 * ## 逐个 opt-in
 *
 * 工具是**一个一个手写进来的**（DESIGN.md §6 #17），不是把 `services/` 反射一遍。
 * 反射式暴露意味着以后任何人新增一个 service 函数，都在无意中扩大了 agent 的权限面。
 */
import { tool } from 'ai';
import { z } from 'zod';
import { listInventory } from '@/lib/services/inventory';
import { listRecipes, getRecipeDetail } from '@/lib/services/recipe';
import { listUtensils } from '@/lib/services/utensil';
import { getCalendarEntries } from '@/lib/services/calendar';
import { generateShoppingList } from '@/lib/services/shopping';
import { composeRecommendations } from '@/lib/recommend/compose';
import type { Vault } from '@/lib/vault';
import { INVENTORY_CATEGORIES, STOCK_LEVELS } from './vocab';

/** 提案里的一条改动。**这是 agent 唯一能表达「我想改点什么」的形式** */
export const ProposedChangeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('calendar'),
    date: z.string().describe('YYYY-MM-DD'),
    recipe_id: z.string().describe('菜谱 id，必须来自你查到的真实菜谱'),
    recipe_name: z.string().describe('菜谱名，给用户看的'),
    status: z.enum(['planned', 'completed']),
  }),
  z.object({
    kind: z.literal('stock'),
    name: z.string().describe('食材名，必须来自你查到的真实库存'),
    stock_level: z.enum(STOCK_LEVELS),
  }),
]);

export type ProposedChange = z.infer<typeof ProposedChangeSchema>;

export const ProposalSchema = z.object({
  summary: z.string().describe('一句话说清你要做什么，给用户看的'),
  changes: z.array(ProposedChangeSchema).describe('具体改动。空数组表示你其实不需要改任何东西'),
});

export type Proposal = z.infer<typeof ProposalSchema>;

/**
 * 建工具集。闭包住 vault，所以工具签名对模型来说是干净的。
 *
 * @param readOnly 只读沙盒下连提案工具都不给——提了也落不了库，
 *   给了只会让模型走一遍白费的推理
 */
export function buildTools(vault: Vault, options: { readOnly?: boolean } = {}) {
  const readTools = {
    list_inventory: tool({
      description: '查看全部食材库存及其档位（enough 充足 / low 不多了 / out 没了）。',
      inputSchema: z.object({
        category: z.enum(INVENTORY_CATEGORIES).optional().describe('只看某一类，不填看全部'),
      }),
      execute: async ({ category }) => {
        const res = await listInventory(vault, category);
        return res.data.map((item) => ({
          name: item.name,
          category: item.category,
          stock_level: item.stock_level,
          last_restocked_at: item.last_restocked_at,
        }));
      },
    }),

    list_recipes: tool({
      description:
        '列出全部菜谱的名称、id、耗时与口味属性。**不含做法步骤**，需要步骤时再调 get_recipe_detail。',
      inputSchema: z.object({}),
      execute: async () => {
        const res = await listRecipes(vault);
        return res.data.map((item) => ({
          id: item.id,
          name: item.name,
          cook_time_minutes: item.cook_time_minutes,
          difficulty: item.difficulty,
          attributes: item.attributes,
        }));
      },
    }),

    get_recipe_detail: tool({
      description: '看一道菜的详情：食材、厨具、步骤。',
      inputSchema: z.object({ recipe_id: z.string() }),
      execute: async ({ recipe_id }) => {
        const res = await getRecipeDetail(vault, recipe_id);
        return res.data ?? { error: '菜谱不存在' };
      },
    }),

    list_utensils: tool({
      description: '查看厨具清单。',
      inputSchema: z.object({}),
      execute: async () => (await listUtensils(vault)).data.map((item) => item.name),
    }),

    get_calendar: tool({
      description: '查看某个月的烹饪日历（做过什么、计划做什么）。用来避开最近吃过的菜。',
      inputSchema: z.object({
        year: z.number(),
        month: z.number().describe('1-12'),
      }),
      execute: async ({ year, month }) => {
        const res = await getCalendarEntries(vault, year, month);
        return res.data.map((entry) => ({
          date: entry.date,
          status: entry.status,
          recipe: entry.recipe?.name ?? '',
        }));
      },
    }),

    get_recommendations: tool({
      description:
        '跑一遍**规则推荐引擎**，拿到分好档的结果：clear_stock（该清库存的）、' +
        'can_make_now（食材全齐）、need_shopping（要买菜）。' +
        '排菜、挑菜时**优先用它**，不要自己从菜谱列表里凭感觉挑——' +
        '它已经算好了库存匹配、食材陈旧度和最近吃过什么。',
      inputSchema: z.object({
        max_cook_time: z.number().optional().describe('只要耗时不超过这个分钟数的'),
      }),
      execute: async ({ max_cook_time }) => {
        const now = new Date();
        const [inventory, recipes, utensils, calendar] = await Promise.all([
          listInventory(vault),
          listRecipes(vault),
          listUtensils(vault),
          getCalendarEntries(vault, now.getFullYear(), now.getMonth() + 1),
        ]);

        const scored = composeRecommendations(vault, {
          inventory: inventory.data,
          recipes: recipes.data,
          utensils: utensils.data,
          calendarEntries: calendar.data,
          filters: max_cook_time ? { maxCookTime: max_cook_time } : undefined,
        });

        // 只回前 20 条：全量几十条塞进上下文，除了烧 token 没有别的作用
        return scored.slice(0, 20).map((item) => ({
          id: item.recipe.id,
          name: item.recipe.name,
          tier: item.tier,
          cook_time_minutes: item.recipe.cook_time_minutes,
          missing_ingredients: item.missingIngredients ?? [],
          clear_stock_ingredients: item.clearStockIngredients ?? [],
        }));
      },
    }),

    generate_shopping_list: tool({
      description: '给一组菜谱算出要买什么。',
      inputSchema: z.object({ recipe_ids: z.array(z.string()) }),
      execute: async ({ recipe_ids }) => {
        const res = await generateShoppingList(vault, recipe_ids, false);
        return res.data.map((item) => ({ name: item.name, category: item.category }));
      },
    }),
  };

  if (options.readOnly) return readTools;

  return {
    ...readTools,

    /**
     * ⚠️ **故意不带 `execute`。**
     *
     * AI SDK 在「调用了没有 execute 的工具」时会停止循环，把这次调用交还给我们。
     * 这正是我们要的：提案浮到 UI 等用户确认，**写入永远不在循环里发生**。
     * 给它加上 `execute` 就等于把这个功能最重要的安全性质删掉了。
     */
    propose_changes: tool({
      description:
        '当你需要**改动**日历或库存时调这个。它不会立刻生效——会先给用户看一眼、由他确认。' +
        '一次把所有改动放在一起提出来，不要分好几次调。',
      inputSchema: ProposalSchema,
    }),
  };
}

export type CookTools = ReturnType<typeof buildTools>;
