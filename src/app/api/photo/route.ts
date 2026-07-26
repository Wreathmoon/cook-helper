/**
 * 菜谱照片的读取端点。
 *
 * 照片是 vault 里的普通文件（`kitchen/recipes/{菜谱名}/xxx.jpg`），不在 public/ 下，
 * 所以要有一个地方把它读出来。**唯一需要小心的是路径越界**：query 里的 path
 * 来自浏览器，必须确认解析后仍落在 vault 内，否则就是一个任意文件读取漏洞。
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import type { ReadableOptions } from 'node:stream';
import { getVault } from '@/lib/vault';

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get('path');
  if (!requested) return new Response('缺少 path 参数', { status: 400 });

  const root = getVault().root;
  const absolutePath = path.resolve(root, requested);

  // 越界检查：`..` 拼出来的路径必须挡掉
  const relative = path.relative(root, absolutePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return new Response('路径越界', { status: 403 });
  }

  const ext = path.extname(absolutePath).toLowerCase();
  if (!CONTENT_TYPES[ext]) return new Response('不支持的文件类型', { status: 415 });
  if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
    return new Response('照片不存在', { status: 404 });
  }

  return new Response(toWebStream(absolutePath), {
    headers: {
      'Content-Type': CONTENT_TYPES[ext],
      'Content-Length': String(statSync(absolutePath).size),
      // 本地文件，改了就是新文件名，可以放心缓存
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

function toWebStream(absolutePath: string, options?: ReadableOptions): ReadableStream<Uint8Array> {
  const nodeStream = createReadStream(absolutePath, options);
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk) => controller.enqueue(new Uint8Array(chunk as Buffer)));
      nodeStream.on('end', () => controller.close());
      nodeStream.on('error', (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}
