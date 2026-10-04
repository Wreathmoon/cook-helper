/**
 * AI 相关的纯常量。
 *
 * ⚠️ **这个文件必须保持零 import。**
 *
 * 客户端组件要显示「最多 N 步」「只判断前 N 道菜」这类数字。如果直接从
 * `agent.ts` / `annotate.ts` 里拿，就会顺着 `agent → tools → services → vault`
 * 把 `node:fs` 拖进客户端 bundle——构建会直接失败（实测：
 * `the chunking context does not support external modules (request: node:fs)`）。
 *
 * 一个被 import 的**运行时值**会把它整条依赖链带过去，`import type` 才不会。
 */

/**
 * 单次命令最多几步工具调用。
 *
 * 「排一周的菜」实测 3–5 步够用（查库存 → 跑推荐 → 查日历 → 提案）。
 * 8 留了余量，同时保证一次跑飞的循环最多烧掉 8 次调用而不是无限次。
 */
export const MAX_STEPS = 8;

/**
 * 记忆标注最多送几道菜给模型。
 *
 * 首屏就一张主推卡 + 几张备选，判断第 30 名有没有踩到禁忌是纯浪费——
 * 用户根本看不到它。这个数直接决定那次调用的成本。
 */
export const ANNOTATE_LIMIT = 8;
