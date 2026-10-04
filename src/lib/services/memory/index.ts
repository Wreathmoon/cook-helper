/**
 * Memory Service —— A 层。签名 `fn(vault, args)`，与其它 service 一致。
 * 数据落在 `vault/memory/*.md`。
 *
 * 只有「列」和「删」两个动作（Task/10 决策 ⑦）：新增与编辑引导用户直接改文件。
 */
import type { Memory } from '@/types';
import { isAiConfigured } from '@/lib/ai/config';
import { deleteMemoryFile, partitionMemories, type MemoryPartition } from '@/lib/memory';
import type { Vault } from '@/lib/vault';
import { VaultError, markVaultWritten } from '@/lib/vault';

function toMessage(err: unknown): string {
  return err instanceof VaultError ? err.toDisplayString() : (err as Error).message;
}

export interface MemoryOverview extends MemoryPartition {
  /** 配了 API key 没有。没配的话 `effective` 恒为空——这不是 bug，见 partitionMemories */
  aiConfigured: boolean;
  /** 记忆文件夹的绝对路径，展示给用户去自己新增 / 编辑（决策 ⑦）*/
  memoryDir: string;
}

/** 管理页要的全部数据：三个分区 + 「记忆到底生不生效」的真实状态 */
export async function listMemories(
  vault: Vault
): Promise<{ data: MemoryOverview; error: string | null }> {
  const aiConfigured = isAiConfigured();
  return {
    data: {
      ...partitionMemories(vault.memories, { aiConfigured }),
      aiConfigured,
      memoryDir: 'memory/',
    },
    error: null,
  };
}

/**
 * 检索面：给模型用的那一份。
 *
 * 调用方（Task/12）：`annotateRecommendationsAction`（推荐页标注）与
 * `runCommandAction`（命令栏 agent）。两边都把结果交给 `renderMemoryBlock()`
 * 渲染成 system prompt 里的「关于你」区块。
 */
export function getMemoriesForPrompt(vault: Vault): Memory[] {
  // 这里刻意不做「没配 key 就返回空」——那是调用方的判断，本函数只回答「哪些记忆活着」
  return vault.memories;
}

/** 删除一条记忆。删的是磁盘上的文件，不做归档、不留墓碑 */
export async function deleteMemory(
  vault: Vault,
  id: string
): Promise<{ error: string | null }> {
  try {
    const memory = vault.memories.find((item) => item.id === id);
    if (!memory) return { error: '这条记忆不存在，可能已经被删掉了。' };

    deleteMemoryFile(vault.root, memory.fileName);

    const index = vault.memories.indexOf(memory);
    if (index !== -1) vault.memories.splice(index, 1);
    markVaultWritten();

    return { error: null };
  } catch (err) {
    return { error: toMessage(err) };
  }
}
