/**
 * 记忆的写入面 —— **只有删除**。
 *
 * 没有新增、没有编辑（Task/10 决策 ⑦）：信任来自「文件是你的」，不是「我给你做了个
 * 好用的编辑器」。但删除必须在系统里能做——看到一条记错的记忆，当场就要能否掉它。
 */
import { existsSync, unlinkSync } from 'node:fs';
import { VaultError } from '@/lib/vault/errors';
import { relativeToVault, vaultPaths } from '@/lib/vault/paths';
import { assertWritable } from '@/lib/vault/writer';

/**
 * 删掉一个记忆文件。
 *
 * `fileName` 来自 `loadMemories()` 读出来的文件名，这里仍然要挡一次路径穿越——
 * 它一路从客户端的删除按钮传下来，不能假设它没被人改过。
 */
export function deleteMemoryFile(root: string, fileName: string): void {
  assertWritable('删除记忆');

  if (!/^[^/\\]+\.md$/.test(fileName) || fileName.includes('..')) {
    throw new VaultError('schema', `不是一个合法的记忆文件名：${fileName}`);
  }

  const absolutePath = vaultPaths.memoryFile(root, fileName);
  const file = relativeToVault(root, absolutePath);

  if (!existsSync(absolutePath)) {
    throw new VaultError('io', '这条记忆的文件已经不在了。', {
      file,
      hint: '可能刚刚在编辑器里删掉了。刷新一下页面即可。',
    });
  }

  try {
    unlinkSync(absolutePath);
  } catch (err) {
    throw new VaultError('io', `删除失败：${(err as Error).message}`, {
      file,
      cause: err,
      hint: '检查一下这个文件是不是被别的程序占用、目录有没有写权限。',
    });
  }
}
