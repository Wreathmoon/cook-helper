/**
 * 把整个 vault 一次性读进内存。
 *
 * 不建 SQLite 索引：48 种食材 + 54 道菜谱的量级，全量解析是毫秒级，
 * `Map.get(name)` 就是 O(1)。加一个 native addon（better-sqlite3）换不来性能，
 * 只换来跨平台编译问题——这与「clone 完就能跑」直接冲突（Task/04 决策）。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml, YAMLParseError } from 'yaml';
import type {
  CalendarEntry,
  InventoryCategory,
  InventoryItem,
  Recipe,
  RecipePhoto,
  Utensil,
} from '@/types';
import { RECOMMEND_CONFIG } from '@/lib/recommend/config';
import { buildAliasMap, normalizeIngredientName } from '@/lib/utils/normalize-name';
import { VaultError } from './errors';
import { parseFrontmatter } from './frontmatter';
import { relativeToVault, vaultPaths } from './paths';
import {
  aliasesFileSchema,
  calendarFileSchema,
  configFileSchema,
  inventoryCategories,
  inventoryFileSchema,
  parseOrThrow,
  recipeFrontmatterSchema,
  utensilsFileSchema,
} from './schema';

/** 菜谱的食材引用。`inventory_id` 里装的是**归一化后的食材名称**——见下方 §关联键 */
export interface VaultRecipeIngredient {
  inventory_id: string;
  role: 'main' | 'auxiliary' | 'seasoning';
  amount?: string;
}

export interface Vault {
  root: string;
  recipes: Recipe[];
  /** 菜谱 id → 磁盘上的目录名（写回时要用，目录名可能被用户改过）*/
  recipeDirs: Map<string, string>;
  recipeIngredients: Map<string, VaultRecipeIngredient[]>;
  recipeUtensils: Map<string, string[]>;
  recipePhotos: Map<string, RecipePhoto[]>;
  inventory: InventoryItem[];
  utensils: Utensil[];
  calendar: CalendarEntry[];
  /** 日历条目 id → 菜谱名称（vault 里日历按名称引用菜谱）*/
  calendarRecipeNames: Map<string, string>;
  aliases: Map<string, string>;
  config: typeof RECOMMEND_CONFIG;
}

/**
 * §关联键：为什么 `InventoryItem.id` 装的是归一化名称
 *
 * vault 用**名称**而不是 UUID 做外键（docs/vault-format.md §1.3）。推荐引擎按
 * `InventoryItem.id` 建索引（`tiering.ts:24`），只要加载时令 `id = 归一化名称`，
 * 引擎源码就一行都不用改——而那 18 个推荐测试正是本次改造唯一的正确性锚点
 * （Task/04 决策修正 A）。归一化属于数据层职责，不该漏进推荐层。
 */
function inventoryIdOf(name: string, aliases: Map<string, string>): string {
  return normalizeIngredientName(name, aliases);
}

export function loadVault(root: string): Vault {
  if (!existsSync(root)) {
    throw new VaultError('io', `vault 目录不存在：${root}`, {
      hint: '删掉 data/ 重新启动会自动从 seed/ 复制一份；或用 VAULT_PATH 指到你自己的 vault。',
    });
  }

  const aliases = readAliases(root);
  const config = readConfig(root);
  const inventory = readInventory(root, aliases);
  const utensils = readUtensils(root);
  const {
    recipes,
    recipeDirs,
    recipeIngredients,
    recipeUtensils,
    recipePhotos,
  } = readRecipes(root, aliases);
  const { calendar, calendarRecipeNames } = readCalendar(root, recipes);

  return {
    root,
    recipes,
    recipeDirs,
    recipeIngredients,
    recipeUtensils,
    recipePhotos,
    inventory,
    utensils,
    calendar,
    calendarRecipeNames,
    aliases,
    config,
  };
}

// ── 通用读取 ──────────────────────────────────────────────

function readYamlFile(root: string, absolutePath: string): unknown {
  const file = relativeToVault(root, absolutePath);
  let text: string;
  try {
    text = readFileSync(absolutePath, 'utf8');
  } catch (err) {
    throw new VaultError('io', `读不了这个文件：${(err as Error).message}`, { file, cause: err });
  }

  try {
    return parseYaml(text);
  } catch (err) {
    throw new VaultError('parse', `YAML 语法有误：${(err as Error).message}`, {
      file,
      line: err instanceof YAMLParseError ? err.linePos?.[0]?.line : undefined,
      cause: err,
      hint: '常见原因：缩进用了 Tab（YAML 只认空格）、冒号后面漏了空格、中文标点。',
    });
  }
}

/** 文件系统时间戳顶替 created_at / updated_at —— vault 文件里不存这两个字段 */
function fileTimes(absolutePath: string): { created_at: string; updated_at: string } {
  try {
    const stat = statSync(absolutePath);
    return {
      created_at: stat.birthtime.toISOString(),
      updated_at: stat.mtime.toISOString(),
    };
  } catch {
    const now = new Date().toISOString();
    return { created_at: now, updated_at: now };
  }
}

// ── 别名表 / 配置 ─────────────────────────────────────────

function readAliases(root: string): Map<string, string> {
  const absolutePath = vaultPaths.aliases(root);
  if (!existsSync(absolutePath)) return new Map();

  const file = relativeToVault(root, absolutePath);
  const raw = readYamlFile(root, absolutePath);
  if (raw === null || raw === undefined) return new Map();

  const data = parseOrThrow(aliasesFileSchema, raw, file);
  try {
    return buildAliasMap(data);
  } catch (err) {
    throw new VaultError('schema', (err as Error).message, {
      file,
      hint: '同一个别名只能指向一个规范名称，且不能与某个规范名称同名。',
    });
  }
}

function readConfig(root: string): typeof RECOMMEND_CONFIG {
  const absolutePath = vaultPaths.config(root);
  if (!existsSync(absolutePath)) return RECOMMEND_CONFIG;

  const file = relativeToVault(root, absolutePath);
  const raw = readYamlFile(root, absolutePath);
  if (raw === null || raw === undefined) return RECOMMEND_CONFIG;

  const parsed = parseOrThrow(configFileSchema, raw, file);
  return {
    topPerTier: parsed.topPerTier,
    maxMissingForShopping: parsed.maxMissingForShopping,
    clearStockThreshold: {
      ...RECOMMEND_CONFIG.clearStockThreshold,
      ...parsed.clearStockThreshold,
    },
    weights: { ...RECOMMEND_CONFIG.weights, ...parsed.weights },
  };
}

// ── 库存 ─────────────────────────────────────────────────

function readInventory(root: string, aliases: Map<string, string>): InventoryItem[] {
  const items: InventoryItem[] = [];
  const seen = new Map<string, string>(); // 归一化名称 → 出处文件

  for (const category of inventoryCategories) {
    const absolutePath = vaultPaths.inventoryFile(root, category);
    if (!existsSync(absolutePath)) continue;

    const file = relativeToVault(root, absolutePath);
    const raw = readYamlFile(root, absolutePath);
    if (raw === null || raw === undefined) continue;

    const rows = parseOrThrow(inventoryFileSchema, raw, file);
    const times = fileTimes(absolutePath);

    for (const row of rows) {
      const id = inventoryIdOf(row.name, aliases);

      const previous = seen.get(id);
      if (previous) {
        throw new VaultError('schema', `食材「${row.name}」重复了（归一化后与 ${previous} 里的一条同名）。`, {
          file,
          field: row.name,
          hint: '同一样食材只能有一条记录。删掉多余的那条，或给其中一条换个名字。',
        });
      }
      seen.set(id, file);

      items.push({
        id,
        name: row.name,
        category: category as InventoryCategory,
        total_amount: row.total_amount ?? null,
        stock_level: row.stock_level,
        unit: row.unit ?? null,
        last_restocked_at: row.last_restocked_at ?? null,
        note: row.note ?? null,
        price: row.price ?? null,
        ...times,
      });
    }
  }

  return items;
}

// ── 厨具 ─────────────────────────────────────────────────

function readUtensils(root: string): Utensil[] {
  const absolutePath = vaultPaths.utensils(root);
  if (!existsSync(absolutePath)) return [];

  const file = relativeToVault(root, absolutePath);
  const raw = readYamlFile(root, absolutePath);
  if (raw === null || raw === undefined) return [];

  const rows = parseOrThrow(utensilsFileSchema, raw, file);
  const times = fileTimes(absolutePath);

  return rows.map((row) => ({
    id: row.name, // 厨具的 join key 就是名称（菜谱按名称引用厨具）
    name: row.name,
    category: row.category ?? undefined,
    note: row.note ?? null,
    ...times,
  }));
}

// ── 菜谱 ─────────────────────────────────────────────────

interface RecipeBundle {
  recipes: Recipe[];
  recipeDirs: Map<string, string>;
  recipeIngredients: Map<string, VaultRecipeIngredient[]>;
  recipeUtensils: Map<string, string[]>;
  recipePhotos: Map<string, RecipePhoto[]>;
}

function readRecipes(root: string, aliases: Map<string, string>): RecipeBundle {
  const bundle: RecipeBundle = {
    recipes: [],
    recipeDirs: new Map(),
    recipeIngredients: new Map(),
    recipeUtensils: new Map(),
    recipePhotos: new Map(),
  };

  const recipesDir = vaultPaths.recipes(root);
  if (!existsSync(recipesDir)) return bundle;

  const dirNames = readdirSync(recipesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const seenIds = new Set<string>();

  for (const dirName of dirNames) {
    const absolutePath = vaultPaths.recipeFile(root, dirName);
    if (!existsSync(absolutePath)) continue;

    const file = relativeToVault(root, absolutePath);
    let content: string;
    try {
      content = readFileSync(absolutePath, 'utf8');
    } catch (err) {
      throw new VaultError('io', `读不了这个文件：${(err as Error).message}`, { file, cause: err });
    }

    const { frontmatter, body } = parseFrontmatter(content, file);
    const data = parseOrThrow(recipeFrontmatterSchema, frontmatter, file);

    // 缺 id 时用菜谱名兜底：手写一道新菜谱不该被要求现敲 26 位 ULID
    const id = data.id ?? data.name;
    if (seenIds.has(id)) {
      throw new VaultError('schema', `菜谱 id「${id}」与另一道菜重复。`, {
        file,
        hint: '两道菜重名了。给其中一道改个名字，或给它一个自己的 id。',
      });
    }
    seenIds.add(id);

    const { steps, tips } = parseRecipeBody(body);

    bundle.recipes.push({
      id,
      name: data.name,
      steps,
      cook_time_minutes: data.cook_time_minutes ?? null,
      difficulty: data.difficulty ?? null,
      attributes: data.attributes,
      tips,
      ...fileTimes(absolutePath),
    });

    bundle.recipeDirs.set(id, dirName);
    bundle.recipeIngredients.set(
      id,
      data.ingredients.map((ing) => ({
        inventory_id: inventoryIdOf(ing.name, aliases),
        role: ing.role,
        amount: ing.amount ?? undefined,
      }))
    );
    bundle.recipeUtensils.set(id, data.utensils);
    bundle.recipePhotos.set(
      id,
      data.photos.map((photo, index) => ({
        id: `${id}:${index}`,
        recipe_id: id,
        storage_path: `kitchen/recipes/${dirName}/${photo}`,
        created_at: new Date().toISOString(),
      }))
    );
  }

  // 与旧行为一致：列表默认按创建时间倒序
  bundle.recipes.sort((a, b) => b.created_at.localeCompare(a.created_at));

  return bundle;
}

const STEPS_HEADING = /^##\s+步骤\s*$/;
const TIPS_HEADING = /^##\s+Tips\s*$/i;
const ORDERED_ITEM = /^\s*\d+[.、)]\s*(.+)$/;

/** 正文里 `## 步骤` 下的有序列表 → steps，`## Tips` 下的内容 → tips */
export function parseRecipeBody(body: string): {
  steps: { step_number: number; description: string }[] | null;
  tips: string | null;
} {
  const lines = body.split('\n');
  const steps: { step_number: number; description: string }[] = [];
  const tipsLines: string[] = [];
  let section: 'none' | 'steps' | 'tips' = 'none';

  for (const line of lines) {
    if (STEPS_HEADING.test(line)) {
      section = 'steps';
      continue;
    }
    if (TIPS_HEADING.test(line)) {
      section = 'tips';
      continue;
    }
    if (/^##\s+/.test(line)) {
      section = 'none';
      continue;
    }

    if (section === 'steps') {
      const match = line.match(ORDERED_ITEM);
      if (match) steps.push({ step_number: steps.length + 1, description: match[1].trim() });
    } else if (section === 'tips' && line.trim()) {
      tipsLines.push(line.replace(/^\s*[-*]\s*/, '').trim());
    }
  }

  return {
    steps: steps.length > 0 ? steps : null,
    tips: tipsLines.length > 0 ? tipsLines.join('\n') : null,
  };
}

// ── 日历 ─────────────────────────────────────────────────

function readCalendar(
  root: string,
  recipes: Recipe[]
): { calendar: CalendarEntry[]; calendarRecipeNames: Map<string, string> } {
  const calendar: CalendarEntry[] = [];
  const calendarRecipeNames = new Map<string, string>();

  const calendarDir = vaultPaths.calendarDir(root);
  if (!existsSync(calendarDir)) return { calendar, calendarRecipeNames };

  const recipeIdByName = new Map(recipes.map((r) => [r.name, r.id]));

  const files = readdirSync(calendarDir)
    .filter((name) => name.endsWith('.yaml'))
    .sort();

  for (const fileName of files) {
    const absolutePath = path.join(calendarDir, fileName);
    const file = relativeToVault(root, absolutePath);
    const raw = readYamlFile(root, absolutePath);
    if (raw === null || raw === undefined) continue;

    const rows = parseOrThrow(calendarFileSchema, raw, file);
    const times = fileTimes(absolutePath);

    for (const [index, row] of rows.entries()) {
      const id = row.id ?? `${fileName.replace('.yaml', '')}:${index}`;
      calendarRecipeNames.set(id, row.recipe_name);

      calendar.push({
        id,
        date: row.date,
        // 菜谱找不到时留空串：日历条目本身还在，只是关联不上——不该整个 vault 加载失败
        recipe_id: recipeIdByName.get(row.recipe_name) ?? '',
        status: row.status,
        notes: row.notes ?? null,
        ...times,
      });
    }
  }

  calendar.sort((a, b) => a.date.localeCompare(b.date));
  return { calendar, calendarRecipeNames };
}
