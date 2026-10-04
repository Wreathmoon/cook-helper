/**
 * 抽取层 —— 把「一张照片」或「一句话」变成**结构化的候选**。
 *
 * 三条贯穿本文件的规矩（Task/11 决策 ⑥⑧⑬）：
 *
 * 1. **只用结构化输出，不解析自由文本。** 没有任何「从模型的散文里抠 JSON」的代码。
 *    schema 校验不过就是失败，报错让用户重来——不做「尽力猜」。
 *    自由文本解析是这类功能第一大 bug 来源，且失败方式无穷无尽。
 * 2. **模型不做归一化。** 它只负责把名字读出来，归一化是 Task/06 那套确定性规则的活
 *    （`normalizeIngredientName` + 别名表）。让模型重做一遍，它做得不稳定，
 *    而且绕过了别名表——「西红柿」和「番茄」会重新变成两种食材。
 * 3. **这里只抽取，不写库。** 本文件不认识 vault，不 import 任何 service。
 *    抽取 → 提案 → 用户确认 → 落库，是四件事，中间那两道正是安全边界。
 */
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { INVENTORY_CATEGORIES, STOCK_LEVELS } from '@/lib/ai/vocab';
import { describeModelError, textModel, visionModel } from './provider';
import { schemaInstruction } from './structured';

/** 单次请求的墙钟上限。视觉请求慢，但也不该慢到让人以为页面挂了 */
const TIMEOUT_MS = 90_000;

// ---------------------------------------------------------------- schema

const CapturedIngredient = z.object({
  name: z
    .string()
    .describe('食材名称，用中文最常用的叫法。不要写品牌、规格、重量，例如写「番茄」不写「寿光有机番茄 500g」'),
  category: z.enum(INVENTORY_CATEGORIES).describe('这个食材属于哪一类'),
});

export const IngredientCaptureSchema = z.object({
  items: z.array(CapturedIngredient).describe('识别到的全部食材。看不清或不确定的不要写进来'),
});
export type IngredientCapture = z.infer<typeof IngredientCaptureSchema>;

export const TextCaptureSchema = z.object({
  intent: z
    .enum(['cooked', 'stock_change', 'unknown'])
    .describe(
      'cooked = 用户说自己做了某道菜；stock_change = 用户在说某些食材的库存变化；unknown = 两者都不是'
    ),
  recipe_name: z
    .string()
    .nullable()
    .describe('intent 为 cooked 时，用户说的菜名，原样照抄不要改写。其它情况为 null'),
  items: z
    .array(
      z.object({
        name: z.string().describe('食材名称，中文常用叫法'),
        category: z.enum(INVENTORY_CATEGORIES).describe('这个食材属于哪一类'),
        stock_level: z
          .enum(STOCK_LEVELS)
          .describe('enough = 充足/刚买；low = 不多了/快没了；out = 没了/用完了'),
      })
    )
    .describe('intent 为 stock_change 时的食材列表。其它情况为空数组'),
});
export type TextCapture = z.infer<typeof TextCaptureSchema>;

// ---------------------------------------------------------------- prompt

const IMAGE_PROMPT: Record<'photo' | 'receipt', string> = {
  photo: [
    '这是一张食材照片（购物袋、冰箱内部或台面）。',
    '列出你能**看清**的食材。',
    '规则：',
    '- 看不清、被遮挡、只露一角认不出的，**不要写**。漏掉一样，用户补一下就行；写错一样，会污染他的库存和推荐。',
    '- 同一种食材只写一条，不要因为有好几个就写好几遍。',
    '- 用中文最常用的叫法，不带品牌、规格、重量。',
    '- 不是食材的东西（袋子、餐具、包装盒）不要写。',
  ].join('\n'),
  receipt: [
    '这是一张超市小票。',
    '列出上面的**食材类**商品。',
    '规则：',
    '- 只要食材。塑料袋、积分、优惠、抹零、日用品这些行**跳过**。',
    '- 商品名常常带品牌和规格，请还原成中文常用的食材名：「XX牌五花肉 500g」→「五花肉」。',
    '- 认不出是什么食材的行，**跳过**，不要硬猜。',
    '- 同一种食材买了多份也只写一条。',
  ].join('\n'),
};

const TEXT_PROMPT = [
  '用户在用一句话记录他厨房里发生的事。判断他的意图并抽取信息。',
  '',
  '两种意图：',
  '- 「我做完了红烧肉」「今天做了宫保鸡丁」→ intent = cooked，recipe_name = 菜名（原样照抄）',
  '- 「西红柿没了」「鸡蛋不多了」「买了一堆青菜」→ intent = stock_change，items 填食材和档位',
  '',
  '规则：',
  '- **菜名原样照抄**，不要改写、不要补全、不要翻译。「红烧肉」就是「红烧肉」，别写成「红烧五花肉」。',
  '- 两种都不像，intent = unknown，其余留空。**不要硬套**——猜错了会往用户的日历里写一条假记录。',
].join('\n');

// ---------------------------------------------------------------- 调用

/**
 * 跑一次，失败重跑一次，就这样。
 *
 * **刻意不做重试循环**（决策 ⑬）：本任务是「一次输入 → 一次抽取 → 一次确认」，
 * 不是 agent。多轮工具调用与预算上限属于 Task/12。一次重试用来吸收
 * 「模型偶尔吐出不合 schema 的东西」，再多就是在烧用户的钱换边际收益。
 */
async function withOneRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch {
    return await run();
  }
}

/**
 * 图片 → 食材候选。
 *
 * @param file 已在客户端缩过图的图片（复用 `src/lib/utils/compress-image.ts`——
 *   Server Action 的 body 默认上限是 1MB，手机原图必定超；顺带也省了图像 token）
 * @param kind `photo` = 购物袋/冰箱照，`receipt` = 超市小票。只影响提示词
 */
export async function extractFromImage(
  file: File,
  kind: 'photo' | 'receipt'
): Promise<IngredientCapture> {
  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const { output } = await withOneRetry(() =>
      generateText({
        model: visionModel(),
        output: Output.object({ schema: IngredientCaptureSchema, name: 'ingredient_capture' }),
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        messages: [
          {
            role: 'user',
            content: [
              // 单次一张图（决策 ⑬）——多图会让 token 成本随手翻几倍，而收益是零：
              // 用户可以拍第二张再录一次，确认层本来就支持连续录入
              // `{type:'image'}` 在 AI SDK v7 里已弃用（运行时会打 DeprecationWarning），
              // 现在的形状是带 `mediaType` 的 file part
              { type: 'file', data: bytes, mediaType: file.type || 'image/jpeg' },
              // schema 跟着提示词走，不能只靠 Output.object——多数 OpenAI 兼容端点
              // 不支持严格模式，那条路上 schema 会被静默丢掉（见 structured.ts）
              { type: 'text', text: IMAGE_PROMPT[kind] + schemaInstruction(IngredientCaptureSchema) },
            ],
          },
        ],
      })
    );
    return output;
  } catch (err) {
    throw new Error(describeModelError(err, { vision: true }));
  }
}

/** 一句话 → 意图 + 候选 */
export async function extractFromText(input: string): Promise<TextCapture> {
  try {
    const { output } = await withOneRetry(() =>
      generateText({
        model: textModel(),
        output: Output.object({ schema: TextCaptureSchema, name: 'text_capture' }),
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        system: TEXT_PROMPT + schemaInstruction(TextCaptureSchema),
        prompt: input,
      })
    );
    return output;
  } catch (err) {
    throw new Error(describeModelError(err, { vision: false }));
  }
}
