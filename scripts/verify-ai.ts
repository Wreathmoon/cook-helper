/**
 * AI 配置冒烟测试 —— 在写任何 UI 之前，先确认「你的 key + 你的模型」真的能跑通。
 *
 * 用法：
 *   npx tsx --env-file=.env.local scripts/verify-ai.ts             # 只验文本
 *   npx tsx --env-file=.env.local scripts/verify-ai.ts 某张图.jpg   # 顺便验视觉
 *
 * ⚠️ **`--env-file` 不能省**：`next dev` 会自动读 `.env.local`，但 `tsx` 不会。
 * 漏掉它得到的是一句「三个变量全缺」——那是假阴性，会让人以为自己 key 填错了。
 * （需要 Node 20.6+；环境变量已经在 shell 里导出过的话，这个 flag 可以不加。）
 *
 * 需要的环境变量见 README 的「可选配置」。这个脚本**会真的发请求、真的花钱**
 * （两次很小的请求，成本可以忽略），这正是它存在的意义：单测里模型调用全是
 * mock 的，跑再绿也证明不了你的 key 和端点是通的。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describeMissing, readAiConfig } from '../src/lib/ai/config';
import { extractFromImage, extractFromText } from '../src/lib/ai/extract';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

async function main() {
  const { config, missing } = readAiConfig();
  if (!config) {
    console.error(`✗ ${describeMissing(missing)}`);
    process.exit(1);
  }

  const sameEndpoint = config.visionBaseUrl === config.baseUrl;

  console.log('配置：');
  console.log(`  端点      ${config.baseUrl}`);
  console.log(`  默认模型  ${config.model}`);
  console.log(`  key       ${config.apiKey.slice(0, 6)}…（只在服务端）`);
  // 视觉端点单独打一行：两个角色跑在不同端点上时，「图片到底发去了哪」
  // 是排查的第一个问题，不该等报错才知道
  console.log(
    `  视觉模型  ${config.visionModel}${config.visionModel === config.model ? '（继承默认模型）' : ''}`
  );
  console.log(`  视觉端点  ${config.visionBaseUrl}${sameEndpoint ? '（继承默认端点）' : ''}\n`);

  // --- 文本 ---
  console.log('① 文本抽取：「我做完了宫保鸡丁」');
  const cooked = await extractFromText('我做完了宫保鸡丁');
  console.log(`   → ${JSON.stringify(cooked)}`);
  if (cooked.intent !== 'cooked') {
    console.warn('   ⚠️ 意图不是 cooked——这个模型可能撑不住结构化输出，换一个试试');
  }

  console.log('\n② 文本抽取：「西红柿没了，鸡蛋不多了」');
  const stock = await extractFromText('西红柿没了，鸡蛋不多了');
  console.log(`   → ${JSON.stringify(stock)}`);

  // --- 视觉（可选）---
  const imagePath = process.argv[2];
  if (!imagePath) {
    console.log('\n（没给图片路径，跳过视觉验证。想验的话：npx tsx scripts/verify-ai.ts 冰箱.jpg）');
    console.log('\n✓ 文本管线通了');
    return;
  }

  const ext = path.extname(imagePath).toLowerCase();
  const type = MIME[ext];
  if (!type) {
    console.error(`✗ 不支持的图片格式：${ext}`);
    process.exit(1);
  }

  console.log(`\n③ 视觉抽取：${imagePath}`);
  const bytes = readFileSync(imagePath);
  const file = new File([new Uint8Array(bytes)], path.basename(imagePath), { type });
  const seen = await extractFromImage(file, 'photo');
  console.log(`   → 识别到 ${seen.items.length} 样：`);
  for (const item of seen.items) console.log(`     · ${item.name}（${item.category}）`);

  console.log('\n✓ 文本 + 视觉都通了');
}

main().catch((err) => {
  console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
