/**
 * 首次启动：把随仓库发布的 `seed/` 整个复制成 `data/`。
 *
 * 自托管项目最大的流失点是 onboarding：空库 → 推荐全空 → 「这玩意儿没用」。
 * 所以 `git clone && npm install && npm run dev` 之后，第一眼看到的必须是
 * 一个有内容、可操作的应用（DESIGN.md §1.5）。
 */
import { cpSync, existsSync } from 'node:fs';
import path from 'node:path';
import { VaultError } from './errors';
import { isReadOnly, SEED_DIR, getVaultRoot } from './paths';

/**
 * @returns 实际使用的 vault 根目录。只读模式下直接用 `seed/`——
 *          Vercel 的文件系统是只读的，复制这一步既做不到也没必要。
 */
export function ensureVaultInitialized(): string {
  if (isReadOnly()) {
    if (!existsSync(SEED_DIR)) {
      throw new VaultError('io', `只读模式下找不到种子数据：${SEED_DIR}`);
    }
    return SEED_DIR;
  }

  const root = getVaultRoot();
  if (existsSync(root)) return root;

  if (!existsSync(SEED_DIR)) {
    throw new VaultError('io', `既没有 vault（${root}）也没有种子数据（${SEED_DIR}）。`, {
      hint: '仓库似乎不完整，确认 seed/ 目录还在。',
    });
  }

  try {
    cpSync(SEED_DIR, root, {
      recursive: true,
      // seed/README.md 讲的是「种子模板是什么」，复制进用户自己的 data/ 只会让人困惑
      filter: (source) => path.basename(source) !== 'README.md',
    });
  } catch (err) {
    throw new VaultError('io', `初始化 vault 失败：${(err as Error).message}`, {
      cause: err,
      hint: `确认当前目录可写，或用 VAULT_PATH 指到一个可写的位置。`,
    });
  }

  return root;
}
