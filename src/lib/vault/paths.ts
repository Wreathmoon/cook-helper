/**
 * vault 在磁盘上的位置，以及只读沙盒开关。
 *
 * 默认 `./data`（在 .gitignore 里），随仓库发布的那份种子在 `./seed`（进 git）。
 * `git clone && npm install && npm run dev` 之后不需要配置任何东西——这是本地化
 * 改造的整个意义所在（Task/04 验收标准第 1 条）。
 */
import path from 'node:path';

/** 仓库根目录。Next.js 的 server 代码工作目录就是项目根 */
const projectRoot = process.cwd();

/** 随仓库发布的种子 vault，只读，首次启动时整个复制到 data/ */
export const SEED_DIR = path.join(projectRoot, 'seed');

/** 运行时 vault。可用 VAULT_PATH 指到仓库外（比如 iCloud / Dropbox 目录）*/
export function getVaultRoot(): string {
  const configured = process.env.VAULT_PATH?.trim();
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.join(projectRoot, configured);
  }
  return path.join(projectRoot, 'data');
}

/**
 * 只读模式：cook.wreathmoon.com 那个演示沙盒用。
 * Vercel 的文件系统本来就是只读的，这个开关只是让写入**优雅地拒绝**而不是抛 EROFS。
 */
export function isReadOnly(): boolean {
  return process.env.READ_ONLY === '1' || process.env.READ_ONLY === 'true';
}

/** vault 内的固定路径 */
export const vaultPaths = {
  kitchen: (root: string) => path.join(root, 'kitchen'),
  recipes: (root: string) => path.join(root, 'kitchen', 'recipes'),
  recipeDir: (root: string, dirName: string) => path.join(root, 'kitchen', 'recipes', dirName),
  recipeFile: (root: string, dirName: string) =>
    path.join(root, 'kitchen', 'recipes', dirName, 'recipe.md'),
  inventoryDir: (root: string) => path.join(root, 'kitchen', 'inventory'),
  inventoryFile: (root: string, category: string) =>
    path.join(root, 'kitchen', 'inventory', `${category}.yaml`),
  utensils: (root: string) => path.join(root, 'kitchen', 'utensils.yaml'),
  calendarDir: (root: string) => path.join(root, 'kitchen', 'calendar'),
  calendarFile: (root: string, yearMonth: string) =>
    path.join(root, 'kitchen', 'calendar', `${yearMonth}.yaml`),
  logFile: (root: string, yearMonth: string) =>
    path.join(root, 'kitchen', 'log', `${yearMonth}.jsonl`),
  aliases: (root: string) => path.join(root, 'kitchen', 'aliases.yaml'),
  config: (root: string) => path.join(root, 'kitchen', 'config.yaml'),
};

/** 报错时把绝对路径缩成相对 vault 根的短路径——绝对路径对用户是噪音 */
export function relativeToVault(root: string, absolutePath: string): string {
  return path.relative(root, absolutePath).split(path.sep).join('/');
}
