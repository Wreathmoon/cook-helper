/**
 * 首次启动：把随仓库发布的 `seed/` 整个复制成 `data/`。
 *
 * 自托管项目最大的流失点是 onboarding：空库 → 推荐全空 → 「这玩意儿没用」。
 * 所以 `git clone && npm install && npm run dev` 之后，第一眼看到的必须是
 * 一个有内容、可操作的应用（DESIGN.md §1.5）。
 */
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { VaultError } from './errors';
import { isReadOnly, SEED_DIR, getVaultRoot, vaultPaths } from './paths';

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
  if (hasContent(root)) {
    ensureMemoryDir(root);
    return root;
  }

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

/**
 * 补一个空的 `memory/` 目录 —— 只对**记忆层之前就存在**的 vault 有意义。
 *
 * 那些 vault 是在 `memory/` 这个约定出现之前复制的，种子补不上它（种子只在
 * data/ 为空时整体复制）。于是记忆页会让用户「去 `memory/` 下新建一个 .md」，
 * 而那个目录根本不在——一句指不到地方的指引比不给指引更糟。
 *
 * ⚠️ 只建**空目录**，不塞任何文件。决策 ⑥ 的「只读不偷改」管的是用户的记忆内容，
 * 让一个被文档承诺过的位置真实存在不在此列。
 */
function ensureMemoryDir(root: string): void {
  const dir = vaultPaths.memoryDir(root);
  if (existsSync(dir)) return;
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    // 建不出来就算了：loadMemories 对目录缺失是宽容的，不该为这个挡住整个应用
  }
}

/**
 * vault 目录「已经有东西了」吗？
 *
 * 判断的不是「目录存在」而是「目录非空」，这个区别在 Docker 下是决定性的：
 * `docker compose up` 会**先把宿主机的 `./data` 建成空目录**再挂进容器，于是
 * 「存在即已初始化」的判断会跳过种子复制，用户拿到一个空 vault 和一句
 * 「找不到 kitchen/」的报错。同一个坑对手动 `mkdir data` 的人也成立。
 */
function hasContent(root: string): boolean {
  if (!existsSync(root)) return false;
  // 是个文件而不是目录：别往上面 cpSync，交给 reader 去报「这不是个 vault」
  if (!statSync(root).isDirectory()) return true;
  return readdirSync(root).length > 0;
}
