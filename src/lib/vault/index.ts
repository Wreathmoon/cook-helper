/**
 * vault —— Cook Helper 的数据层。纯文本文件是唯一真相，没有数据库。
 * 格式规范见 docs/vault-format.md。
 */
export { VaultError, readOnlyError } from './errors';
export type { VaultErrorKind } from './errors';
export { generateUlid, isValidUlid } from './ulid';
export { parseFrontmatter, serializeFrontmatter } from './frontmatter';
export { getVaultRoot, isReadOnly, vaultPaths, relativeToVault, SEED_DIR } from './paths';
export { loadVault, parseRecipeBody } from './reader';
export type { Vault, VaultRecipeIngredient } from './reader';
export {
  assertWritable,
  deleteRecipeDir,
  monthOf,
  writeCalendarMonth,
  writeFileAtomic,
  writeInventoryCategory,
  writeRecipe,
  writeUtensils,
} from './writer';
export { ensureVaultInitialized } from './init';
export { getVault, invalidateVault, markVaultWritten, reloadVault } from './store';
