/**
 * 模型实例的构造 —— 唯一一处知道「我们在跟哪个 provider 说话」的地方。
 *
 * 用 `@ai-sdk/openai-compatible`，因为它的设计目标就是**不绑厂商**（Task/11 决策 ②）。
 * 上层（`extract.ts`）只拿 `LanguageModel`，不知道背后是 OpenAI、DeepSeek 还是本机 Ollama。
 *
 * ⚠️ **不要在这里加「能力探测」**（决策 ③）：OpenAI 兼容协议里问不出「这个模型支不支持图片」。
 * 猜错了降级，会把一个清晰的配置问题（该配 `AI_VISION_MODEL`）变成一个玄学问题
 * （「为什么它没读我的照片」）。让模型自己报错，我们原样透出。
 */
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { getAiConfig, readAiConfig } from './config';

function providerOf(baseUrl: string, apiKey: string) {
  return createOpenAICompatible({
    // 这个 name 只用于 provider metadata 与错误信息，不参与路由
    name: 'cook-helper-byok',
    baseURL: baseUrl,
    apiKey,
  });
}

/** 默认模型（文本角色）*/
export function textModel(): LanguageModel {
  const { baseUrl, apiKey, model } = getAiConfig();
  return providerOf(baseUrl, apiKey)(model);
}

/**
 * 视觉角色。没单独配时逐项回落到默认角色。
 *
 * ⚠️ **端点和 key 也要跟着走，不能只换模型名**（决策 ③ 修订，2026-08-05）。
 * 「默认模型不是多模态」最常见的解法是 DeepSeek 官方 API + 本机 Ollama 上的
 * 视觉模型——**两个端点**。原先这里复用了默认角色的 `baseUrl`/`apiKey`，
 * 于是图片请求还是发去了那个看不了图的端点，而报错里只字不提端点，
 * 用户会一直以为是模型名填错了。
 */
export function visionModel(): LanguageModel {
  const { visionBaseUrl, visionApiKey, visionModel: name } = getAiConfig();
  return providerOf(visionBaseUrl, visionApiKey)(name);
}

/**
 * 把模型返回的错误翻成人话。
 *
 * 最值得单独处理的是**「默认模型其实不支持图片」**：用户看到的原始报错通常是
 * 一句上下文全无的 400，而正确的下一步动作（去配 `AI_VISION_MODEL`）跟那句话
 * 完全对不上号。这里不猜、不吞——原样透出，再补一句该往哪走。
 */
export function describeModelError(err: unknown, opts: { vision: boolean }): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (!opts.vision) return `模型调用失败：${raw}`;

  // ⚠️ 这里必须用 readAiConfig 而不是 getAiConfig：配置缺失时后者会**抛**，
  // 而我们正身处一个 catch 块里——那会把用户真正该看到的原始错误吞掉，
  // 换成一个由错误处理代码自己制造的新错误
  const { config } = readAiConfig();
  if (!config) return `模型调用失败：${raw}`;

  const { model, baseUrl, visionModel: vision, visionBaseUrl } = config;
  const sameModel = model === vision;

  // 端点必须报出来。视觉角色配错时最常见的一种是「换了模型名但没换端点」——
  // 比如模型名填了本机 Ollama 上的 qwen2.5vl，请求却还是发去了 DeepSeek。
  // 那时的原始报错通常是一句「model not found」，而它长得跟「模型名拼错了」
  // 一模一样，用户会在模型名上反复试，永远试不出问题其实在端点。
  const sameEndpoint = baseUrl === visionBaseUrl;
  const where = `\n本次看图用的是「${vision}」@ ${visionBaseUrl}${sameEndpoint ? '（沿用 AI_BASE_URL）' : '（AI_VISION_BASE_URL）'}。`;

  const hint = sameModel
    ? `${where}\n如果它不是多模态模型，就读不了图片——配 AI_VISION_MODEL 指向一个能看图的模型；那个模型若不在同一个端点上（比如本机 Ollama），还要一并配 AI_VISION_BASE_URL。`
    : `${where}\n如果它不支持图片输入就换一个；如果它压根不在这个端点上，配 AI_VISION_BASE_URL（本机 Ollama 例：http://localhost:11434/v1）。`;

  return `模型调用失败：${raw}${hint}`;
}
