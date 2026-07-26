'use server';

import {
  listRecipes,
  getRecipeDetail,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  uploadRecipePhoto,
  deleteRecipePhoto,
} from '@/lib/services/recipe';
import { listInventory } from '@/lib/services/inventory';
import { listUtensils } from '@/lib/services/utensil';
import { getVault } from '@/lib/vault';
import { guardData, guardResult } from '@/lib/utils/error';
import type { Difficulty, InventoryItem, Recipe, RecipeAttributes, Utensil } from '@/types';
import { revalidatePath } from 'next/cache';

type RecipeIngredientInput = {
  inventory_id: string;
  role: 'main' | 'auxiliary' | 'seasoning';
  amount?: string;
};

export async function getListRecipes(filters?: {
  search?: string;
  attributes?: Record<string, unknown>;
}) {
  return guardData([] as Recipe[], () =>
    listRecipes(getVault(), filters as { search?: string; attributes?: RecipeAttributes })
  );
}

export async function getRecipeDetailAction(recipeId: string) {
  return guardData(null, () => getRecipeDetail(getVault(), recipeId));
}

export async function createRecipeAction(data: {
  name: string;
  steps?: { step_number: number; description: string }[];
  cook_time_minutes?: number;
  difficulty?: string;
  attributes?: Record<string, unknown>;
  tips?: string;
  ingredients?: { inventory_id: string; role: string; amount?: string }[];
  utensils?: string[];
}) {
  const result = await guardResult(
    () =>
      createRecipe(getVault(), {
        ...data,
        difficulty: data.difficulty as Difficulty | undefined,
        attributes: data.attributes as RecipeAttributes | undefined,
        ingredients: data.ingredients as RecipeIngredientInput[] | undefined,
      }),
    { data: null }
  );
  revalidatePath('/recipes');
  return result;
}

export async function updateRecipeAction(
  recipeId: string,
  data: {
    name?: string;
    steps?: { step_number: number; description: string }[];
    cook_time_minutes?: number;
    difficulty?: string;
    attributes?: Record<string, unknown>;
    tips?: string;
    ingredients?: { inventory_id: string; role: string; amount?: string }[];
    utensils?: string[];
  }
) {
  const result = await guardResult(
    () =>
      updateRecipe(getVault(), recipeId, {
        ...data,
        difficulty: data.difficulty as Difficulty | undefined,
        attributes: data.attributes as RecipeAttributes | undefined,
        ingredients: data.ingredients as RecipeIngredientInput[] | undefined,
      }),
    { data: null }
  );
  revalidatePath('/recipes');
  return result;
}

export async function deleteRecipeAction(recipeId: string) {
  const result = await guardResult(() => deleteRecipe(getVault(), recipeId));
  revalidatePath('/recipes');
  return result;
}

export async function getInventoryForRecipe() {
  return guardData([] as InventoryItem[], () => listInventory(getVault()));
}

export async function getUtensilsForRecipe() {
  return guardData([] as Utensil[], () => listUtensils(getVault()));
}

export async function uploadRecipePhotoAction(recipeId: string, formData: FormData) {
  const file = formData.get('file');
  if (!(file instanceof File)) return { data: null, error: '没有收到文件' };

  const result = await guardResult(() => uploadRecipePhoto(getVault(), recipeId, file), {
    data: null,
  });
  revalidatePath('/recipes');
  return result;
}

export async function deleteRecipePhotoAction(photoId: string) {
  const result = await guardResult(() => deleteRecipePhoto(getVault(), photoId));
  revalidatePath('/recipes');
  return result;
}

/**
 * 照片是 vault 里的普通文件，不是对象存储的对象。
 * 交给 /api/photo 读盘并流出去（它做了越界路径检查）。
 */
export async function getPhotoUrl(storagePath: string) {
  return `/api/photo?path=${encodeURIComponent(storagePath)}`;
}
