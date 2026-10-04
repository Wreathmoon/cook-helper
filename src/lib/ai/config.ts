/**
 * AI 配置读取 —— **provider 中立的 BYOK**（Task/11 决策 ②③）。
 *
 * 这个项目不代管任何人的 key，也不内置任何默认 key，**更不绑定任何一家厂商的 SDK**。
 * 接入协议是 OpenAI 兼容的 `baseURL + apiKey`——官方 API、中转站、Ollama、vLLM
 * 都说这个方言，用户给什么 key、指哪个模型，我们就用哪个。
 *
 * 「你的数据是你的」这句话，如果配套的是一个写死了厂商的客户端，那它只兑现了一半。
 *
 * ## 模型角色（model roles）
 *
 * 两个角色，不多不少：
 *
 * | 变量 | 角色 | 缺省 |
 * |------|------|------|
 * | `AI_MODEL` | 默认模型，干所有文本活 | 必填 |
 * | `AI_VISION_MODEL` | 看图的模型 | 不填 = `AI_MODEL` |
 * | `AI_VISION_BASE_URL` | 视觉角色的端点 | 不填 = `AI_BASE_URL` |
 * | `AI_VISION_API_KEY` | 视觉角色的 key | 不填 = `AI_API_KEY` |
 *
 * **为什么视觉要能单独指**：用户的默认模型可能压根不是多模态的（DeepSeek 这类），
 * 那时拍照录入要能指到另一个模型上，而不是整个功能塌掉。
 *
 * ⚠️ **角色是「端点 + key + 模型名」三件套，不只是模型名**（决策 ③ 修订，2026-08-05）。
 * 原先视觉角色只能换模型名、端点与 key 跟着默认角色走——那默认了「另一个模型就在
 * 同一个端点上」。而决策 ③ 自己举的例子（DeepSeek 不是多模态）恰恰最常配成
 * 「DeepSeek 官方 API + 本机 Ollama 上的 Qwen VL」：两个端点、两个 key。
 * 换模型名换不到另一台机器上去，于是那条出路在它最该生效的场景里是堵死的。
 *
 * 三个变量全部可选且各自独立回落，所以**单端点用户逐字无感**。
 *
 * **为什么只有两个角色**：现在只有两种活（文本抽取、图像抽取）。三个以上的角色
 * 是为想象中的需求造机制——Task/12 真需要「便宜模型跑分类、贵模型跑编排」时再加，
 * 那时的成本很低。参照 Continue 的 `roles:` 字段，那是这件事的完整形态。
 *
 * ⚠️ 一期全部功能（库存、菜谱、日历、规则推荐）仍然无 key 可用。
 * 「无 key 也完全能用」这条原则的**范围被限定，不是被推翻**（DESIGN.md §6 #21）。
 */

/** 一份完整可用的 AI 配置。拿到这个对象就意味着每个字段都非空 */
export interface AiConfig {
  /** OpenAI 兼容端点，例：`https://api.openai.com/v1` */
  baseUrl: string;
  apiKey: string;
  /** 默认模型（文本角色）*/
  model: string;
  /** 视觉角色的端点。没单独配时等于 {@link AiConfig.baseUrl} */
  visionBaseUrl: string;
  /** 视觉角色的 key。没单独配时等于 {@link AiConfig.apiKey} */
  visionApiKey: string;
  /** 视觉角色。没单独配时等于 {@link AiConfig.model} */
  visionModel: string;
}

/** 配置项的元信息 —— UI 上要能告诉用户「缺的那个到底是干什么的」 */
export const AI_ENV_VARS = [
  { name: 'AI_BASE_URL', required: true, purpose: 'OpenAI 兼容端点，例：https://api.openai.com/v1' },
  { name: 'AI_API_KEY', required: true, purpose: '你自己的 key，只存在服务端' },
  { name: 'AI_MODEL', required: true, purpose: '默认模型，例：gpt-4o' },
  { name: 'AI_VISION_MODEL', required: false, purpose: '看图的模型。不填就用 AI_MODEL' },
  {
    name: 'AI_VISION_BASE_URL',
    required: false,
    purpose: '视觉模型在另一个端点上时填，例：http://localhost:11434/v1。不填就用 AI_BASE_URL',
  },
  {
    name: 'AI_VISION_API_KEY',
    required: false,
    purpose: '视觉端点的 key。不填就用 AI_API_KEY（本机 Ollama 这类不校验 key，随便填个非空值）',
  },
] as const;

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? '';
}

/**
 * 读配置，并**明确报出缺了哪几个**。
 *
 * 缺什么要能一路传到 UI 上——「AI 功能不可用」是个没用的提示，
 * 「缺 `AI_MODEL`」才是用户能立刻动手解决的提示。
 */
export function readAiConfig(): { config: AiConfig | null; missing: string[] } {
  const baseUrl = readEnv('AI_BASE_URL');
  const apiKey = readEnv('AI_API_KEY');
  const model = readEnv('AI_MODEL');
  const visionBaseUrl = readEnv('AI_VISION_BASE_URL');
  const visionApiKey = readEnv('AI_VISION_API_KEY');
  const visionModel = readEnv('AI_VISION_MODEL');

  const missing = AI_ENV_VARS.filter((item) => item.required && !readEnv(item.name)).map(
    (item) => item.name
  );
  if (missing.length > 0) return { config: null, missing };

  // 视觉角色的三件套各自独立回落到默认角色（决策 ③ 及其 2026-08-05 修订）。
  // **独立**是要点：只换端点不换 key（同一家的另一个网关）、只换模型名不换端点
  // （中转站同时供两个模型）都是真实存在的配法，绑成一组会逼用户重复填。
  return {
    config: {
      baseUrl,
      apiKey,
      model,
      visionBaseUrl: visionBaseUrl || baseUrl,
      visionApiKey: visionApiKey || apiKey,
      visionModel: visionModel || model,
    },
    missing: [],
  };
}

/**
 * 配齐了没有。
 *
 * ⚠️ **语义比 Task/10 时期更严了**：原先只看 `AI_API_KEY` 有没有值。
 * 但光有 key 是发不出请求的——没有端点和模型名，一样什么都做不了。
 * 让 UI 在「其实还不能用」的状态下显示「已生效」，正是 Task/10 决策 ⑤
 * 要避免的那个失败态（用户以为过敏记忆在保护自己，实际什么都没发生）。
 *
 * 这里依然**不校验 key 有没有效**——那要等真正发请求时才知道。
 */
export function isAiConfigured(): boolean {
  return readAiConfig().config !== null;
}

/** 拿配置，缺了就抛。给「已经确认配好了」的调用路径用 */
export function getAiConfig(): AiConfig {
  const { config, missing } = readAiConfig();
  if (!config) throw new Error(describeMissing(missing));
  return config;
}

/** 把「缺哪几个」拼成一句用户能照着做的话 */
export function describeMissing(missing: string[]): string {
  const detail = AI_ENV_VARS.filter((item) => missing.includes(item.name))
    .map((item) => `${item.name}（${item.purpose}）`)
    .join('、');
  return `AI 功能还没配好，缺：${detail}。配好后重启服务即可。`;
}
