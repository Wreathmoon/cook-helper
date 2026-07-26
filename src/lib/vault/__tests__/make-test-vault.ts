/**
 * 测试用的 vault 工厂。
 *
 * 换掉云端数据库之后，service 测试不再需要手搓 thenable mock：
 * 直接给一份内存数据 + 一个临时目录，写入就真的落盘，读回来就能断言。
 * 比 mock 更真实，也更短。
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { CalendarEntry, InventoryItem, Recipe, Utensil } from '@/types';
import { RECOMMEND_CONFIG } from '@/lib/recommend/config';
import { normalizeIngredientName } from '@/lib/utils/normalize-name';
import type { Vault, VaultRecipeIngredient } from '../reader';

const now = new Date().toISOString();
const times = { created_at: now, updated_at: now };

export interface TestRecipeSpec {
  id: string;
  name: string;
  ingredients?: { name: string; role?: 'main' | 'auxiliary' | 'seasoning'; amount?: string }[];
  utensils?: string[];
  cook_time_minutes?: number;
}

/** 建一个跑在临时目录里的 vault。调用方负责 `cleanup()` */
export function makeTestVault(spec: {
  inventory?: (Partial<InventoryItem> & { name: string; category: InventoryItem['category'] })[];
  utensils?: string[];
  recipes?: TestRecipeSpec[];
  calendar?: (Partial<CalendarEntry> & { id: string; date: string; recipe_id: string })[];
  calendarRecipeNames?: Record<string, string>;
  aliases?: Map<string, string>;
} = {}): Vault & { cleanup: () => void } {
  const root = mkdtempSync(path.join(tmpdir(), 'cook-helper-vault-'));
  const aliases = spec.aliases ?? new Map<string, string>();

  const inventory: InventoryItem[] = (spec.inventory ?? []).map((item) => ({
    total_amount: null,
    stock_level: 'enough' as const,
    unit: null,
    last_restocked_at: null,
    note: null,
    price: null,
    ...times,
    ...item,
    // id 默认由名称推导——这正是 vault 的关联键规则（reader.ts §关联键）
    id: item.id ?? normalizeIngredientName(item.name, aliases),
  }));

  const utensils: Utensil[] = (spec.utensils ?? []).map((name) => ({
    id: name,
    name,
    note: null,
    ...times,
  }));

  const recipes: Recipe[] = [];
  const recipeDirs = new Map<string, string>();
  const recipeIngredients = new Map<string, VaultRecipeIngredient[]>();
  const recipeUtensils = new Map<string, string[]>();

  for (const item of spec.recipes ?? []) {
    recipes.push({
      id: item.id,
      name: item.name,
      steps: null,
      cook_time_minutes: item.cook_time_minutes ?? null,
      difficulty: null,
      attributes: {},
      tips: null,
      ...times,
    });
    recipeDirs.set(item.id, item.name);
    recipeIngredients.set(
      item.id,
      (item.ingredients ?? []).map((ing) => ({
        inventory_id: normalizeIngredientName(ing.name, aliases),
        role: ing.role ?? 'main',
        amount: ing.amount,
      }))
    );
    recipeUtensils.set(item.id, item.utensils ?? []);
  }

  const calendar: CalendarEntry[] = (spec.calendar ?? []).map((entry) => ({
    status: 'planned',
    notes: null,
    ...times,
    ...entry,
  })) as CalendarEntry[];

  return {
    root,
    recipes,
    recipeDirs,
    recipeIngredients,
    recipeUtensils,
    recipePhotos: new Map(),
    inventory,
    utensils,
    calendar,
    calendarRecipeNames: new Map(Object.entries(spec.calendarRecipeNames ?? {})),
    aliases,
    config: RECOMMEND_CONFIG,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}
