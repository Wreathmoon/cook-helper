/**
 * vault 文件的 Zod schema —— 从 `src/types/index.ts` 逐字段翻译，
 * 删掉 `user_id` / `created_at` / `updated_at`，外键改名称引用。
 *
 * 存在的意义只有一个：用户手改坏了文件时，给出**指向具体字段**的报错，
 * 而不是让一个 undefined 一路飘进推荐引擎。
 */
import { z } from 'zod';
import { VaultError } from './errors';

// ── 枚举（与 src/types/index.ts 保持一致）─────────────────
const stockLevel = z.enum(['enough', 'low', 'out']);
const difficulty = z.enum(['easy', 'medium', 'hard']);
const ingredientRole = z.enum(['main', 'auxiliary', 'seasoning']);
const calendarStatus = z.enum(['planned', 'completed']);
const cookingMethod = z.enum(['炒', '炖', '蒸', '煮', '烤', '凉拌', '炸']);
const spiciness = z.enum(['不辣', '微辣', '中辣', '重辣']);
const greasiness = z.enum(['清爽', '适中', '重油']);
const flavor = z.enum(['咸鲜', '清淡', '带甜']);
const dietType = z.enum(['纯荤', '荤素搭配', '纯素']);
const nutrition = z.enum(['高蛋白', '高碳水主食', '多蔬菜纤维', '汤水']);
const scene = z.enum(['工作日快手', '周末慢做', '宴客硬菜', '夜宵']);
const cuisine = z.enum(['川', '粤', '鲁', '家常', '其他']);

export const inventoryCategories = [
  'vegetable',
  'meat',
  'egg_dairy_bean',
  'staple',
  'seasoning',
] as const;

/** YAML 里 `0.1` 不带引号会被解析成数字，两种都收 */
const specVersion = z.union([z.string(), z.number()]).transform(String);

export const recipeAttributesSchema = z
  .object({
    method: z.array(cookingMethod).optional(),
    spiciness: spiciness.optional(),
    greasiness: greasiness.optional(),
    flavor: flavor.optional(),
    diet_type: dietType.optional(),
    nutrition: z.array(nutrition).optional(),
    scene: z.array(scene).optional(),
    cuisine: cuisine.optional(),
  })
  .strict();

export const recipeFrontmatterSchema = z.object({
  spec_version: specVersion.optional(),
  // id 只要求「非空且唯一」，不强制 ULID 格式：手写一道新菜谱的人不该被要求
  // 现敲 26 位 ULID，缺了就用菜谱名兜底（日历本来就按名称引用菜谱，
  // 见 docs/vault-format.md §3.4）。ULID 是**我们生成**时用的方案，不是校验门槛。
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  cook_time_minutes: z.number().int().positive().nullish(),
  difficulty: difficulty.nullish(),
  attributes: recipeAttributesSchema.default({}),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1),
        role: ingredientRole.default('main'),
        amount: z.string().nullish(),
      })
    )
    .default([]),
  utensils: z.array(z.string()).default([]),
  photos: z.array(z.string()).default([]),
});

export const inventoryFileSchema = z.array(
  z.object({
    name: z.string().min(1),
    total_amount: z.string().nullish(),
    stock_level: stockLevel.default('enough'),
    unit: z.string().nullish(),
    last_restocked_at: z.string().nullish(),
    note: z.string().nullish(),
    price: z.number().nonnegative().nullish(),
  })
);

export const utensilsFileSchema = z.array(
  z.object({
    name: z.string().min(1),
    category: z.string().nullish(),
    note: z.string().nullish(),
  })
);

export const calendarFileSchema = z.array(
  z.object({
    id: z.string().min(1).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期要写成 2026-07-26 这样的格式'),
    recipe_name: z.string().min(1),
    status: calendarStatus.default('planned'),
    notes: z.string().nullish(),
    photos: z.array(z.string()).default([]),
  })
);

export const configFileSchema = z.object({
  topPerTier: z.number().int().positive().default(4),
  maxMissingForShopping: z.number().int().nonnegative().default(3),
  clearStockThreshold: z.record(z.string(), z.number()).default({}),
  weights: z
    .object({
      noRepeat: z.number(),
      clearStock: z.number(),
      timeMatch: z.number(),
      nutritionBalance: z.number(),
    })
    .partial()
    .default({}),
});

export const aliasesFileSchema = z.record(z.string(), z.array(z.string()));

/**
 * 把 Zod 的报错翻译成指向具体文件与字段的 VaultError。
 *
 * Zod 的原文（"Invalid enum value. Expected..."）对着一个手改 YAML 的人是天书，
 * 所以这里只保留「哪个字段 + 什么问题」，并把合法值列出来。
 */
export function parseOrThrow<T extends z.ZodType>(
  schema: T,
  data: unknown,
  file: string
): z.infer<T> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  const field = issue.path.length > 0 ? formatPath(issue.path) : undefined;

  throw new VaultError('schema', translateIssue(issue), {
    file,
    field,
    hint: '改完保存，刷新页面即可；其它字段不受影响。',
  });
}

function formatPath(path: PropertyKey[]): string {
  return path
    .map((segment) => (typeof segment === 'number' ? `[第 ${segment + 1} 条]` : `.${String(segment)}`))
    .join('')
    .replace(/^\./, '');
}

function translateIssue(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case 'invalid_value':
      return `值不在允许范围内。允许的值：${issue.values.map((v) => `\`${String(v)}\``).join(' / ')}`;
    case 'invalid_type':
      return issue.input === undefined
        ? '这个字段是必填的，但文件里没有。'
        : `类型不对：需要 ${issue.expected}。`;
    case 'unrecognized_keys':
      return `出现了不认识的字段：${issue.keys.join(' / ')}。检查一下有没有拼错。`;
    default:
      return issue.message;
  }
}
