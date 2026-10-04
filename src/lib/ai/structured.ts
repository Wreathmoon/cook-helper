/**
 * 结构化输出的**可移植实现** —— 把 schema 写进提示词，而不是指望端点支持严格模式。
 *
 * ## 为什么需要这个文件（2026-08-05，作者实配时暴露）
 *
 * Task/11 决策 ⑥ 说「用结构化输出 + zod schema 拿结果」。它的第一版实现是
 * `generateText({ output: Output.object({ schema }) })`，然后就撒手了——
 * 默认了「端点会把 schema 当回事」。**BYOK 恰恰不能默认这一条。**
 *
 * 实测（curl 直接问两边的服务器）：
 *
 * | 端点 | `response_format: json_schema` |
 * |------|-------------------------------|
 * | DeepSeek `deepseek-v4-flash` | ❌ `This response_format type is unavailable now` |
 * | Ollama `qwen3.6:35b` | ✅ |
 *
 * 而 `@ai-sdk/openai-compatible` 的 `supportsStructuredOutputs` **默认 false**
 * （`dist/index.js:435`），于是它对**所有**端点都走降级：发 `json_object`，
 * 并把 schema 整个丢掉，只推一条 warning（`:525`）。再核 `ai` v7 的 `Output.object`
 * （`dist/index.js:3500`）：它只设 responseFormat + 事后用 zod 校验，
 * **不往提示词里写 schema**。
 *
 * 两件事叠起来 = **模型压根不知道要哪些字段**。DeepSeek 那句
 * 「Prompt must contain the word 'json'」其实是在替我们挡住一个更糟的结果：
 * 就算把「json」塞进提示词绕过它，回来的也只是一个字段名全靠猜的 JSON。
 *
 * ## 修法：schema 自己渲染进提示词（决策 ⑥ 修订，选项 A）
 *
 * 一套代码打通所有 OpenAI 兼容端点，零新增配置——这和决策 ②「provider 中立」
 * 是同一件事：**不能假设端点的私有能力，正如不能假设厂商的私有 SDK**。
 *
 * 代价说清楚：放弃了 Ollama 那边本来能用的严格模式，约束力从「协议层保证」
 * 降到「提示词 + 事后校验」。这个代价是可接受的，因为决策 ⑥ 的兜底本来就是
 * **zod 校验不过就是失败**（`Output.object` 仍在原位做这件事），加上一次重试。
 * 反过来，为「端点支不支持严格模式」加一个开关，等于把刚刚踩的这个坑
 * （配错了不报错、只是结果变差）重新交给用户踩一遍。
 *
 * ⚠️ **不要为了省 token 把 schema 从提示词里拿掉。** 它就是这里唯一的约束力来源。
 *
 * ℹ️ 服务端日志里那句 `The feature "responseFormat" is not supported` 是**预期内的**——
 * 它正是 SDK 在报「我把 schema 丢了」，而这个文件就是为了接住那件事。不用去修它，
 * 也**不要**用 `AI_SDK_LOG_WARNINGS=false` 一把关掉：那会连真正有用的 warning 一起埋掉。
 */
import { z } from 'zod';

/**
 * 把 zod schema 渲染成一段提示词，追加在任务描述之后。
 *
 * ⚠️ **必须包含字面量「JSON」**：DeepSeek 在 `response_format: json_object` 下
 * 硬性要求提示词里出现这个词，否则整个请求 400。这不是风格问题，是协议要求。
 *
 * `.describe()` 写的说明会被 `z.toJSONSchema()` 带进 `description` 字段，
 * 所以字段语义不用在这里重复一遍——写在 schema 上，两处共用。
 */
export function schemaInstruction(schema: z.ZodType): string {
  const json = JSON.stringify(z.toJSONSchema(schema), null, 2);
  return [
    '',
    '只输出一个 JSON 对象，不要有任何解释、前言或 markdown 代码块围栏。',
    '输出必须严格符合下面这份 JSON Schema（字段名逐字一致，不要增删字段）：',
    '',
    json,
  ].join('\n');
}
