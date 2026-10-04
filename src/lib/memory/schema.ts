/**
 * 记忆文件 frontmatter 的 Zod schema。规范见 docs/vault-format.md §3.9。
 *
 * 这里最重要的一条不是类型检查，是 `goal` 必须带 `expires` ——
 * 一条没有失效期的临时目标会**无声地**压着推荐半年，而且没有报错、没有征兆，
 * 等发现推荐变差时已经找不到原因（Task/10「三个字段是骨架」）。
 * 所以它是硬校验，不是提示。
 */
import { z } from 'zod';

const memoryType = z.enum(['preference', 'goal', 'constraint']);
const memoryScope = z.enum(['kitchen', 'global']);
const memorySource = z.enum(['stated', 'inferred']);
const memoryConfidence = z.enum(['high', 'medium', 'low']);
const memoryEnforcement = z.enum(['soft', 'hard']);
const memoryStatus = z.enum(['active', 'archived']);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期要写成 2026-08-05 这样的格式');

/** YAML 里 `created: 2026-08-05` 不带引号会被解析成 Date 对象，两种都收 */
const dateLike = z.preprocess(
  (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value),
  isoDate
);

export const memoryFrontmatterSchema = z
  .object({
    spec_version: z.union([z.string(), z.number()]).transform(String).optional(),
    // 与菜谱同样的口径：只要求非空唯一，不强制 ULID——手写一条记忆的人
    // 不该被要求现敲 26 位 ID。省略时用文件名兜底（docs/vault-format.md §5）
    id: z.string().min(1).optional(),
    type: memoryType,
    scope: z.array(memoryScope).nonempty('至少要写一个 scope（kitchen 或 global）'),
    source: memorySource.default('stated'),
    confidence: memoryConfidence.default('high'),
    enforcement: memoryEnforcement.default('soft'),
    created: dateLike,
    expires: dateLike.nullish(),
    status: memoryStatus.default('active'),
  })
  .refine((data) => data.type !== 'goal' || !!data.expires, {
    path: ['expires'],
    message:
      '`type: goal` 必须写 `expires`——临时目标没有失效期，就会一直悄悄影响推荐，而且不会报错。',
  });

export type MemoryFrontmatter = z.infer<typeof memoryFrontmatterSchema>;
