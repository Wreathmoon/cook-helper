/**
 * Recipe Service — A 层核心纯函数
 * 签名 fn(vault, args)。数据落在 `kitchen/recipes/{菜谱名}/recipe.md`。
 *
 * 一菜一目录：`recipe.md` 和它的照片放一起，整个目录可以直接发给别人
 * （社区分享的雏形，见 Task/14）。
 */
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type {
  Recipe,
  RecipeIngredient,
  RecipeUtensil,
  RecipePhoto,
  RecipeAttributes,
  Difficulty,
} from '@/types';
import { normalizeIngredientName } from '@/lib/utils/normalize-name';
import type { Vault, VaultRecipeIngredient } from '@/lib/vault';
import {
  assertWritable,
  deleteRecipeDir,
  generateUlid,
  VaultError,
  vaultPaths,
  writeRecipe,
} from '@/lib/vault';

/** 菜谱详情（含关联食材和厨具）*/
export interface RecipeDetail extends Recipe {
  ingredients: (RecipeIngredient & {
    inventory?: { name: string; category: string; stock_level: string };
  })[];
  utensils: RecipeUtensil[];
  photos: RecipePhoto[];
}

function toMessage(err: unknown): string {
  return err instanceof VaultError ? err.toDisplayString() : (err as Error).message;
}

/** 菜谱列表（支持搜索 + 标签筛选）*/
export async function listRecipes(
  vault: Vault,
  filters?: {
    search?: string;
    attributes?: Partial<RecipeAttributes>;
  }
): Promise<{ data: Recipe[]; error: string | null }> {
  let data = vault.recipes;

  if (filters?.search) {
    const keyword = filters.search.trim().toLowerCase();
    if (keyword) data = data.filter((recipe) => recipe.name.toLowerCase().includes(keyword));
  }

  const attrs = filters?.attributes;
  if (attrs) {
    data = data.filter((recipe) => {
      const recipeAttrs = recipe.attributes ?? {};

      // 数组字段：菜谱只要命中任意一个选中的标签就算匹配
      for (const key of ['method', 'nutrition', 'scene'] as const) {
        const wanted = attrs[key];
        if (wanted && wanted.length > 0) {
          const owned = (recipeAttrs[key] ?? []) as string[];
          if (!wanted.some((value) => owned.includes(value as never))) return false;
        }
      }

      // 单值字段：精确匹配
      for (const key of ['spiciness', 'greasiness', 'flavor', 'diet_type', 'cuisine'] as const) {
        const wanted = attrs[key];
        if (wanted && recipeAttrs[key] !== wanted) return false;
      }

      return true;
    });
  }

  return { data, error: null };
}

/** 菜谱详情（含关联食材和厨具）*/
export async function getRecipeDetail(
  vault: Vault,
  recipeId: string
): Promise<{ data: RecipeDetail | null; error: string | null }> {
  const recipe = vault.recipes.find((item) => item.id === recipeId);
  if (!recipe) return { data: null, error: '菜谱不存在' };

  const inventoryById = new Map(vault.inventory.map((item) => [item.id, item]));
  const ingredients = (vault.recipeIngredients.get(recipeId) ?? []).map((ing, index) => {
    const inventory = inventoryById.get(ing.inventory_id);
    return {
      id: `${recipeId}:ing:${index}`,
      recipe_id: recipeId,
      inventory_id: ing.inventory_id,
      role: ing.role,
      amount: ing.amount ?? null,
      // 匹配不上库存的食材照样展示（名字就在 inventory_id 里），只是没有档位信息
      inventory: inventory
        ? {
            name: inventory.name,
            category: inventory.category,
            stock_level: inventory.stock_level,
          }
        : undefined,
    };
  });

  const utensils = (vault.recipeUtensils.get(recipeId) ?? []).map((name, index) => ({
    id: `${recipeId}:ut:${index}`,
    recipe_id: recipeId,
    utensil_name: name,
  }));

  return {
    data: {
      ...recipe,
      ingredients,
      utensils,
      photos: vault.recipePhotos.get(recipeId) ?? [],
    },
    error: null,
  };
}

/** 创建菜谱 */
export async function createRecipe(
  vault: Vault,
  data: {
    name: string;
    steps?: { step_number: number; description: string }[];
    cook_time_minutes?: number;
    difficulty?: Difficulty;
    attributes?: RecipeAttributes;
    tips?: string;
    ingredients?: {
      inventory_id: string;
      role: 'main' | 'auxiliary' | 'seasoning';
      amount?: string;
    }[];
    utensils?: string[];
  }
): Promise<{ data: Recipe | null; error: string | null }> {
  try {
    assertWritable('新建菜谱');

    const name = data.name.trim();
    if (!name) return { data: null, error: '菜谱名称不能为空' };
    if (vault.recipes.some((recipe) => recipe.name === name)) {
      return { data: null, error: `已经有一道叫「${name}」的菜了，换个名字吧` };
    }

    const now = new Date().toISOString();
    const recipe: Recipe = {
      id: generateUlid(),
      name,
      steps: data.steps ?? null,
      cook_time_minutes: data.cook_time_minutes ?? null,
      difficulty: data.difficulty ?? null,
      attributes: data.attributes ?? {},
      tips: data.tips ?? null,
      created_at: now,
      updated_at: now,
    };

    const ingredients = normalizeIngredients(vault, data.ingredients);
    const utensils = data.utensils ?? [];

    vault.recipes.unshift(recipe);
    vault.recipeDirs.set(recipe.id, safeDirName(name));
    vault.recipeIngredients.set(recipe.id, ingredients);
    vault.recipeUtensils.set(recipe.id, utensils);
    vault.recipePhotos.set(recipe.id, []);

    writeRecipe(vault, recipe, ingredients, utensils, []);
    return { data: recipe, error: null };
  } catch (err) {
    return { data: null, error: toMessage(err) };
  }
}

/** 更新菜谱 */
export async function updateRecipe(
  vault: Vault,
  recipeId: string,
  data: {
    name?: string;
    steps?: { step_number: number; description: string }[];
    cook_time_minutes?: number;
    difficulty?: Difficulty;
    attributes?: RecipeAttributes;
    tips?: string;
    ingredients?: {
      inventory_id: string;
      role: 'main' | 'auxiliary' | 'seasoning';
      amount?: string;
    }[];
    utensils?: string[];
  }
): Promise<{ data: Recipe | null; error: string | null }> {
  try {
    assertWritable('修改菜谱');

    const recipe = vault.recipes.find((item) => item.id === recipeId);
    if (!recipe) return { data: null, error: '菜谱不存在' };

    // 改名 = 换目录。先把旧目录删掉，再按新名字写一份
    const renamed = data.name !== undefined && data.name.trim() !== recipe.name;
    if (renamed) {
      const name = data.name!.trim();
      if (!name) return { data: null, error: '菜谱名称不能为空' };
      if (vault.recipes.some((item) => item.id !== recipeId && item.name === name)) {
        return { data: null, error: `已经有一道叫「${name}」的菜了，换个名字吧` };
      }
      deleteRecipeDir(vault, recipeId);
      recipe.name = name;
      vault.recipeDirs.set(recipeId, safeDirName(name));
    }

    if (data.steps !== undefined) recipe.steps = data.steps;
    if (data.cook_time_minutes !== undefined) recipe.cook_time_minutes = data.cook_time_minutes;
    if (data.difficulty !== undefined) recipe.difficulty = data.difficulty;
    if (data.attributes !== undefined) recipe.attributes = data.attributes;
    if (data.tips !== undefined) recipe.tips = data.tips;
    recipe.updated_at = new Date().toISOString();

    if (data.ingredients !== undefined) {
      vault.recipeIngredients.set(recipeId, normalizeIngredients(vault, data.ingredients));
    }
    if (data.utensils !== undefined) {
      vault.recipeUtensils.set(recipeId, data.utensils);
    }

    writeRecipe(
      vault,
      recipe,
      vault.recipeIngredients.get(recipeId) ?? [],
      vault.recipeUtensils.get(recipeId) ?? [],
      photoFileNames(vault, recipeId)
    );
    return { data: recipe, error: null };
  } catch (err) {
    return { data: null, error: toMessage(err) };
  }
}

/** 删除菜谱（连同它的目录和照片）*/
export async function deleteRecipe(
  vault: Vault,
  recipeId: string
): Promise<{ error: string | null }> {
  try {
    assertWritable('删除菜谱');

    const index = vault.recipes.findIndex((item) => item.id === recipeId);
    if (index === -1) return { error: '菜谱不存在' };

    deleteRecipeDir(vault, recipeId);
    vault.recipes.splice(index, 1);
    vault.recipeDirs.delete(recipeId);
    vault.recipeIngredients.delete(recipeId);
    vault.recipeUtensils.delete(recipeId);
    vault.recipePhotos.delete(recipeId);

    return { error: null };
  } catch (err) {
    return { error: toMessage(err) };
  }
}

/** 保存菜谱照片 —— 写进菜谱自己的目录，不再是对象存储 */
export async function uploadRecipePhoto(
  vault: Vault,
  recipeId: string,
  file: File
): Promise<{ data: RecipePhoto | null; error: string | null }> {
  try {
    assertWritable('上传照片');

    const recipe = vault.recipes.find((item) => item.id === recipeId);
    if (!recipe) return { data: null, error: '菜谱不存在' };

    const dirName = vault.recipeDirs.get(recipeId) ?? safeDirName(recipe.name);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const fileName = `${Date.now()}.${ext}`;
    const absolutePath = path.join(vaultPaths.recipeDir(vault.root, dirName), fileName);

    writeFileSync(absolutePath, Buffer.from(await file.arrayBuffer()));

    const photo: RecipePhoto = {
      id: `${recipeId}:${fileName}`,
      recipe_id: recipeId,
      storage_path: `kitchen/recipes/${dirName}/${fileName}`,
      created_at: new Date().toISOString(),
    };

    vault.recipePhotos.set(recipeId, [...(vault.recipePhotos.get(recipeId) ?? []), photo]);
    writeRecipe(
      vault,
      recipe,
      vault.recipeIngredients.get(recipeId) ?? [],
      vault.recipeUtensils.get(recipeId) ?? [],
      photoFileNames(vault, recipeId)
    );

    return { data: photo, error: null };
  } catch (err) {
    return { data: null, error: toMessage(err) };
  }
}

/** 删除菜谱照片 */
export async function deleteRecipePhoto(
  vault: Vault,
  photoId: string
): Promise<{ error: string | null }> {
  try {
    assertWritable('删除照片');

    const recipeId = photoId.split(':')[0];
    const photos = vault.recipePhotos.get(recipeId) ?? [];
    const photo = photos.find((item) => item.id === photoId);
    if (!photo) return { error: '照片不存在' };

    // ⚠️ 用 unlinkSync，别用 `rmSync(file, { force: true })`——实测在 Windows + Node 23 上
    // 后者对单个文件**静默不删也不报错**，照片会永远留在磁盘上变成孤儿文件
    const absolutePath = path.join(vault.root, photo.storage_path);
    if (existsSync(absolutePath)) unlinkSync(absolutePath);

    vault.recipePhotos.set(
      recipeId,
      photos.filter((item) => item.id !== photoId)
    );

    const recipe = vault.recipes.find((item) => item.id === recipeId);
    if (recipe) {
      writeRecipe(
        vault,
        recipe,
        vault.recipeIngredients.get(recipeId) ?? [],
        vault.recipeUtensils.get(recipeId) ?? [],
        photoFileNames(vault, recipeId)
      );
    }

    return { error: null };
  } catch (err) {
    return { error: toMessage(err) };
  }
}

// ── 工具 ─────────────────────────────────────────────────

/** UI 传来的 inventory_id 就是食材名称，但用户输入的可能是别名，统一归一 */
function normalizeIngredients(
  vault: Vault,
  ingredients?: { inventory_id: string; role: 'main' | 'auxiliary' | 'seasoning'; amount?: string }[]
): VaultRecipeIngredient[] {
  return (ingredients ?? []).map((ing) => ({
    inventory_id: normalizeIngredientName(ing.inventory_id, vault.aliases),
    role: ing.role,
    amount: ing.amount,
  }));
}

/** frontmatter 的 photos 写的是相对 `recipe.md` 的文件名 */
function photoFileNames(vault: Vault, recipeId: string): string[] {
  return (vault.recipePhotos.get(recipeId) ?? []).map((photo) => path.basename(photo.storage_path));
}

/** 菜谱名直接当目录名，只挡掉真的会让文件系统炸掉的字符 */
function safeDirName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').trim();
}
