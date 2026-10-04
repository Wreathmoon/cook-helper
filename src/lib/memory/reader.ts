/**
 * 从 `vault/memory/` 把记忆读进内存。
 *
 * ⚠️ **不维护索引文件。** Task/10 的格式草案里画了一份 `vault/memory/index.md`
 * 「一行一条」，本实现**不做**，改为直接扫目录——理由见 docs/vault-format.md §3.9
 * 的更正块：决策 ⑦ 让用户自己手写记忆文件，而一份需要人手同步的索引，一旦漏更就
 * 变成「文件在那儿但系统看不见」——正是本任务最不可接受的失败态那一族。
 * 几十到几百个文件，目录扫描是毫秒级的。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { Memory } from '@/types';
import { VaultError } from '@/lib/vault/errors';
import { parseFrontmatter } from '@/lib/vault/frontmatter';
import { parseOrThrow } from '@/lib/vault/schema';
import { relativeToVault, vaultPaths } from '@/lib/vault/paths';
import { memoryFrontmatterSchema } from './schema';

export function loadMemories(root: string): Memory[] {
  const dir = vaultPaths.memoryDir(root);
  // 没有 memory/ 目录不是错误——旧 vault、或者根本没用过记忆的人
  if (!existsSync(dir)) return [];

  const fileNames = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort();

  const memories: Memory[] = [];
  const seenIds = new Map<string, string>();

  for (const fileName of fileNames) {
    const absolutePath = path.join(dir, fileName);
    const file = relativeToVault(root, absolutePath);

    let content: string;
    try {
      content = readFileSync(absolutePath, 'utf8');
    } catch (err) {
      throw new VaultError('io', `读不了这个文件：${(err as Error).message}`, { file, cause: err });
    }

    const { frontmatter, body } = parseFrontmatter(content, file);
    const data = parseOrThrow(memoryFrontmatterSchema, frontmatter, file);

    const id = data.id ?? fileName.replace(/\.md$/, '');
    const previous = seenIds.get(id);
    if (previous) {
      throw new VaultError('schema', `记忆 id「${id}」与 ${previous} 里的一条重复。`, {
        file,
        hint: '给其中一条换个 id，或者把文件改名（省略 id 时用文件名兜底）。',
      });
    }
    seenIds.set(id, file);

    memories.push({
      id,
      fileName,
      type: data.type,
      scope: [...data.scope],
      source: data.source,
      confidence: data.confidence,
      enforcement: data.enforcement,
      created: data.created,
      expires: data.expires ?? null,
      status: data.status,
      content: body.trim(),
    });
  }

  // 新的排前面：记忆列表是用来「看看系统记住了什么」的，最近写的最值得先看见
  memories.sort((a, b) => b.created.localeCompare(a.created) || a.id.localeCompare(b.id));
  return memories;
}
