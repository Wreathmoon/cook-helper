import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * ⚠️ **这个文件里不会发出任何真实的模型请求。** `ai` 模块整个被 mock 掉了。
 *
 * 单测能证明的是「形状对不对」——schema、角色回落、重试、报错文案。
 * 它证明不了「你的 key 和端点是通的」，那件事只有真实请求能证明，
 * 所以另有 `scripts/verify-ai.ts`。两者不能互相替代。
 */

const generateText = vi.hoisted(() => vi.fn());
vi.mock('ai', () => ({
  generateText,
  Output: { object: (options: unknown) => options },
}));

import { describeMissing, isAiConfigured, readAiConfig } from '../config';
import { describeModelError } from '../provider';
import { schemaInstruction } from '../structured';
import { IngredientCaptureSchema, TextCaptureSchema, extractFromText } from '../extract';

const ENV_KEYS = [
  'AI_BASE_URL',
  'AI_API_KEY',
  'AI_MODEL',
  'AI_VISION_MODEL',
  'AI_VISION_BASE_URL',
  'AI_VISION_API_KEY',
] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  generateText.mockReset();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

function configure(extra: Partial<Record<(typeof ENV_KEYS)[number], string>> = {}) {
  process.env.AI_BASE_URL = 'https://example.test/v1';
  process.env.AI_API_KEY = 'sk-test';
  process.env.AI_MODEL = 'some-model';
  Object.assign(process.env, extra);
}

describe('readAiConfig', () => {
  it('什么都没配时报出全部缺失项', () => {
    const { config, missing } = readAiConfig();
    expect(config).toBeNull();
    expect(missing).toEqual(['AI_BASE_URL', 'AI_API_KEY', 'AI_MODEL']);
  });

  it('只配了 key 依然算没配好 —— 没有端点和模型名一样发不出请求', () => {
    process.env.AI_API_KEY = 'sk-test';
    expect(isAiConfigured()).toBe(false);
    expect(readAiConfig().missing).toEqual(['AI_BASE_URL', 'AI_MODEL']);
  });

  it('视觉模型没单独配时继承默认模型', () => {
    configure();
    expect(readAiConfig().config).toMatchObject({
      model: 'some-model',
      visionModel: 'some-model',
    });
  });

  it('视觉模型单独配了就用它 —— 默认模型不是多模态时的出路', () => {
    configure({ AI_VISION_MODEL: 'some-vision-model' });
    expect(readAiConfig().config).toMatchObject({
      model: 'some-model',
      visionModel: 'some-vision-model',
    });
  });

  it('视觉端点没单独配时继承默认端点与 key', () => {
    configure({ AI_VISION_MODEL: 'some-vision-model' });
    expect(readAiConfig().config).toMatchObject({
      visionBaseUrl: 'https://example.test/v1',
      visionApiKey: 'sk-test',
    });
  });

  /**
   * 这条守着决策 ③ 修订的那个洞：视觉角色必须能整体挪到**另一台机器**上。
   * 「DeepSeek 官方 API（不是多模态）+ 本机 Ollama 上的视觉模型」是这个配置
   * 最典型的形态，而它需要的是两个端点、两个 key——只换模型名换不过去。
   */
  it('视觉端点可以整体指到另一个端点 —— 云端文本模型 + 本机视觉模型', () => {
    configure({
      AI_VISION_BASE_URL: 'http://localhost:11434/v1',
      AI_VISION_API_KEY: 'ollama',
      AI_VISION_MODEL: 'qwen2.5vl:7b',
    });
    expect(readAiConfig().config).toMatchObject({
      baseUrl: 'https://example.test/v1',
      apiKey: 'sk-test',
      model: 'some-model',
      visionBaseUrl: 'http://localhost:11434/v1',
      visionApiKey: 'ollama',
      visionModel: 'qwen2.5vl:7b',
    });
  });

  it('视觉三件套各自独立回落 —— 只换端点不换 key 也是合法配法', () => {
    configure({ AI_VISION_BASE_URL: 'http://localhost:11434/v1' });
    expect(readAiConfig().config).toMatchObject({
      visionBaseUrl: 'http://localhost:11434/v1',
      visionApiKey: 'sk-test',
      visionModel: 'some-model',
    });
  });

  it('视觉那三个都是可选的 —— 单端点用户不受影响', () => {
    configure();
    expect(isAiConfigured()).toBe(true);
    expect(readAiConfig().missing).toEqual([]);
  });

  it('只有空白的值等于没配', () => {
    configure({ AI_MODEL: '   ' });
    expect(isAiConfigured()).toBe(false);
  });

  it('缺失文案要指名道姓，「AI 不可用」这种话没人能照着做', () => {
    const message = describeMissing(['AI_MODEL']);
    expect(message).toContain('AI_MODEL');
    expect(message).toContain('默认模型');
  });
});

/**
 * 这一组守着一个**只有真实端点才会暴露、单测很容易漏掉**的性质：
 * 多数 OpenAI 兼容端点不支持严格结构化输出，SDK 在那条路上会把 schema
 * 静默丢掉，于是约束力**只剩提示词里这段文字**。见 `structured.ts` 的头注释。
 */
describe('schemaInstruction', () => {
  it('必须出现字面量 JSON —— DeepSeek 在 json_object 下硬性要求，否则整个请求 400', () => {
    expect(schemaInstruction(TextCaptureSchema)).toContain('JSON');
  });

  it('字段名要进提示词 —— 端点丢掉 schema 之后，这是模型唯一的依据', () => {
    const text = schemaInstruction(TextCaptureSchema);
    expect(text).toContain('intent');
    expect(text).toContain('recipe_name');
    expect(text).toContain('stock_level');
  });

  it('枚举的取值也要带上，不能只给类型', () => {
    const text = schemaInstruction(IngredientCaptureSchema);
    expect(text).toContain('vegetable');
  });

  it('schema 上的 .describe() 说明会带进去 —— 语义只写一处', () => {
    expect(schemaInstruction(TextCaptureSchema)).toContain('原样照抄');
  });
});

describe('describeModelError', () => {
  it('原始报错一个字不吞', () => {
    configure();
    expect(describeModelError(new Error('418 teapot'), { vision: false })).toContain('418 teapot');
  });

  /**
   * 视觉报错**必须报出端点**。配错视觉角色最常见的一种是「换了模型名但没换端点」，
   * 而它的原始报错（`model not found`）长得跟「模型名拼错了」一模一样——
   * 不把端点写出来，用户会在模型名上反复试，永远试不出问题其实在端点。
   */
  it('视觉报错报出实际用的端点，而不只是模型名', () => {
    configure({ AI_VISION_MODEL: 'qwen2.5vl:7b' });
    const message = describeModelError(new Error('model not found'), { vision: true });
    expect(message).toContain('qwen2.5vl:7b');
    expect(message).toContain('https://example.test/v1');
    expect(message).toContain('AI_VISION_BASE_URL');
  });

  it('视觉端点单独配过时，报的是那个端点', () => {
    configure({ AI_VISION_BASE_URL: 'http://localhost:11434/v1', AI_VISION_MODEL: 'qwen2.5vl:7b' });
    expect(describeModelError(new Error('boom'), { vision: true })).toContain(
      'http://localhost:11434/v1'
    );
  });
});

describe('schema', () => {
  it('食材抽取：分类必须是库存里真有的那五个之一', () => {
    expect(
      IngredientCaptureSchema.safeParse({ items: [{ name: '西红柿', category: 'vegetable' }] }).success
    ).toBe(true);
    expect(
      IngredientCaptureSchema.safeParse({ items: [{ name: '西红柿', category: '蔬菜' }] }).success
    ).toBe(false);
  });

  it('文本抽取：三种意图之外的一律不收', () => {
    const base = { recipe_name: null, items: [] };
    expect(TextCaptureSchema.safeParse({ ...base, intent: 'cooked' }).success).toBe(true);
    expect(TextCaptureSchema.safeParse({ ...base, intent: 'unknown' }).success).toBe(true);
    expect(TextCaptureSchema.safeParse({ ...base, intent: 'buy_something' }).success).toBe(false);
  });

  it('文本抽取：档位只认那三档', () => {
    const bad = {
      intent: 'stock_change',
      recipe_name: null,
      items: [{ name: '鸡蛋', category: 'egg_dairy_bean', stock_level: '半满' }],
    };
    expect(TextCaptureSchema.safeParse(bad).success).toBe(false);
  });
});

describe('extractFromText', () => {
  it('正常返回时原样交出结构化结果', async () => {
    configure();
    const output = { intent: 'cooked', recipe_name: '红烧肉', items: [] };
    generateText.mockResolvedValueOnce({ output });

    await expect(extractFromText('我做完了红烧肉')).resolves.toEqual(output);
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it('第一次失败会重试一次 —— 吸收模型偶尔吐出不合 schema 的东西', async () => {
    configure();
    generateText
      .mockRejectedValueOnce(new Error('schema 校验失败'))
      .mockResolvedValueOnce({ output: { intent: 'unknown', recipe_name: null, items: [] } });

    await expect(extractFromText('随便说点什么')).resolves.toMatchObject({ intent: 'unknown' });
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it('**只重试一次**，不做重试循环——多了就是在烧用户的钱', async () => {
    configure();
    generateText.mockRejectedValue(new Error('一直失败'));

    await expect(extractFromText('...')).rejects.toThrow();
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it('没配好时抛出的是「缺什么」，不是一句看不懂的 SDK 报错', async () => {
    generateText.mockResolvedValue({ output: {} });
    await expect(extractFromText('...')).rejects.toThrow(/AI_BASE_URL/);
  });
});
