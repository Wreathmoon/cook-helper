/**
 * 交给模型的枚举值 —— 和 `src/types/index.ts` 里的联合类型是**同一套值**。
 *
 * 为什么要单独一份：zod 的 `z.enum()` 要的是运行时的字符串元组，而 `InventoryCategory`
 * 只是编译期类型，取不到值。两边一旦漂移，模型会吐出一个类型上合法、
 * 但 `writeInventoryCategory` 写不进去的分类。
 *
 * 下面两个 `satisfies` 是**编译期的同步检查**：类型里加了新分类而这里没加，
 * 或者这里写了类型里没有的值，`npm run build` 直接报错。
 */
import type { InventoryCategory, StockLevel } from '@/types';

export const INVENTORY_CATEGORIES = [
  'vegetable',
  'meat',
  'egg_dairy_bean',
  'staple',
  'seasoning',
] as const satisfies readonly InventoryCategory[];

export const STOCK_LEVELS = ['enough', 'low', 'out'] as const satisfies readonly StockLevel[];

// 反向检查：类型里有、这里漏了的话，这一行报错（漏一个就少一个可选值）
type _CategoriesAreExhaustive = Exclude<
  InventoryCategory,
  (typeof INVENTORY_CATEGORIES)[number]
> extends never
  ? true
  : ['缺少分类', Exclude<InventoryCategory, (typeof INVENTORY_CATEGORIES)[number]>];
type _LevelsAreExhaustive = Exclude<StockLevel, (typeof STOCK_LEVELS)[number]> extends never
  ? true
  : ['缺少档位', Exclude<StockLevel, (typeof STOCK_LEVELS)[number]>];

// 只是把上面两个类型「用掉」，让它们参与检查
export type VocabIsInSync = [_CategoriesAreExhaustive, _LevelsAreExhaustive];
