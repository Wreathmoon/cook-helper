/**
 * vault 写入 —— 全部走「临时文件 + rename」。
 *
 * 写到一半被强杀，正式文件要么是旧内容要么是新内容，不会出现半截文件。
 * 不加锁：单用户场景下同时开两个 dev server 是使用失误，rename 的原子性
 * 已经足够保护单次写入（docs/vault-format.md §6）。
 */
import { existsSync, mkdirSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import type { CalendarEntry, InventoryItem, Recipe, Utensil } from '@/types';
import { VaultError } from './errors';
import { serializeFrontmatter } from './frontmatter';
import { isReadOnly, relativeToVault, vaultPaths } from './paths';
import type { Vault, VaultRecipeIngredient } from './reader';

const SPEC_VERSION = '0.1';

/** 原子写：同目录 .tmp → fsync 由 writeFileSync 保证落盘 → rename */
export function writeFileAtomic(absolutePath: string, content: string, root?: string): void {
  const file = root ? relativeToVault(root, absolutePath) : absolutePath;
  const dir = path.dirname(absolutePath);
  const tempPath = path.join(dir, `.${path.basename(absolutePath)}.${process.pid}.tmp`);

  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(tempPath, content, 'utf8');
    renameSync(tempPath, absolutePath);
  } catch (err) {
    try {
      if (existsSync(tempPath)) unlinkSync(tempPath);
    } catch {
      // 清理失败不该盖掉真正的错误
    }
    throw new VaultError('io', `写入失败：${(err as Error).message}`, {
      file,
      cause: err,
      hint: '检查一下这个目录有没有写权限、磁盘是不是满了、文件是不是被别的程序占用。',
    });
  }
}

/** 所有写入的统一入口检查 —— 只读沙盒在这里被挡下 */
export function assertWritable(action: string): void {
  if (isReadOnly()) {
    throw new VaultError('read_only', `这是只读演示实例，${action}不会被保存。`, {
      hint: '想改数据的话，把仓库 clone 到本地跑一份自己的：README 里有三行命令。',
    });
  }
}

// ── 库存 ─────────────────────────────────────────────────

/** 重写某个分类的整份 yaml。按名称排序，让 git diff 保持干净 */
export function writeInventoryCategory(vault: Vault, category: string): void {
  const rows = vault.inventory
    .filter((item) => item.category === category)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
    .map((item) => compact({
      name: item.name,
      total_amount: item.total_amount,
      stock_level: item.stock_level,
      unit: item.unit,
      last_restocked_at: item.last_restocked_at,
      note: item.note,
      price: item.price,
    }));

  const header = `# ${category} 库存 — 按名称排序\n`;
  writeFileAtomic(
    vaultPaths.inventoryFile(vault.root, category),
    header + (rows.length > 0 ? stringifyYaml(rows, { lineWidth: 0 }) : '[]\n'),
    vault.root
  );
}

// ── 厨具 ─────────────────────────────────────────────────

export function writeUtensils(vault: Vault): void {
  const rows = [...vault.utensils]
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
    .map((item) => compact({ name: item.name, category: item.category, note: item.note }));

  writeFileAtomic(
    vaultPaths.utensils(vault.root),
    '# 厨具 — 按名称排序\n' + (rows.length > 0 ? stringifyYaml(rows, { lineWidth: 0 }) : '[]\n'),
    vault.root
  );
}

// ── 菜谱 ─────────────────────────────────────────────────

export function writeRecipe(
  vault: Vault,
  recipe: Recipe,
  ingredients: VaultRecipeIngredient[],
  utensils: string[],
  photos: string[]
): void {
  const dirName = vault.recipeDirs.get(recipe.id) ?? recipe.name;

  const frontmatter = compact({
    spec_version: SPEC_VERSION,
    id: recipe.id,
    name: recipe.name,
    cook_time_minutes: recipe.cook_time_minutes,
    difficulty: recipe.difficulty,
    attributes: Object.keys(recipe.attributes ?? {}).length > 0 ? recipe.attributes : undefined,
    ingredients: ingredients.length > 0
      ? ingredients.map((ing) => compact({
          name: ing.inventory_id,
          role: ing.role,
          amount: ing.amount,
        }))
      : undefined,
    utensils: utensils.length > 0 ? utensils : undefined,
    photos: photos.length > 0 ? photos : undefined,
  });

  writeFileAtomic(
    vaultPaths.recipeFile(vault.root, dirName),
    serializeFrontmatter(frontmatter, renderRecipeBody(recipe)),
    vault.root
  );
  vault.recipeDirs.set(recipe.id, dirName);
}

/** steps / tips → Markdown 正文。步骤放正文是因为**人能写对** > 程序好解析 */
function renderRecipeBody(recipe: Recipe): string {
  const sections: string[] = [];

  if (recipe.steps && recipe.steps.length > 0) {
    const items = recipe.steps
      .map((step, index) => `${index + 1}. ${step.description}`)
      .join('\n');
    sections.push(`## 步骤\n${items}`);
  }
  if (recipe.tips) {
    const tips = recipe.tips
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => `- ${line.trim()}`)
      .join('\n');
    sections.push(`## Tips\n${tips}`);
  }

  return sections.join('\n\n');
}

export function deleteRecipeDir(vault: Vault, recipeId: string): void {
  const dirName = vault.recipeDirs.get(recipeId);
  if (!dirName) return;
  const dir = vaultPaths.recipeDir(vault.root, dirName);
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch (err) {
    throw new VaultError('io', `删除失败：${(err as Error).message}`, {
      file: relativeToVault(vault.root, dir),
      cause: err,
    });
  }
}

// ── 日历 ─────────────────────────────────────────────────

/** 重写某个月的日历文件。`yearMonth` 形如 `2026-07` */
export function writeCalendarMonth(vault: Vault, yearMonth: string): void {
  const rows = vault.calendar
    .filter((entry) => entry.date.startsWith(yearMonth))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) => compact({
      id: entry.id,
      date: entry.date,
      recipe_name: vault.calendarRecipeNames.get(entry.id) ?? '',
      status: entry.status,
      notes: entry.notes,
    }));

  const filePath = vaultPaths.calendarFile(vault.root, yearMonth);

  if (rows.length === 0) {
    // 整月清空就把文件删掉，别留一堆空文件在目录里
    try {
      if (existsSync(filePath)) unlinkSync(filePath);
    } catch {
      writeFileAtomic(filePath, '[]\n', vault.root);
    }
    return;
  }

  writeFileAtomic(
    filePath,
    `# ${yearMonth} 烹饪日历 — 按日期排序\n` + stringifyYaml(rows, { lineWidth: 0 }),
    vault.root
  );
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

// ── 工具 ─────────────────────────────────────────────────

/** 去掉 null / undefined / 空数组 —— vault 文件里不该出现一堆 `note: null` 的噪音 */
function compact<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    result[key] = value;
  }
  return result;
}

export type { InventoryItem, Utensil, CalendarEntry };
