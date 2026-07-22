'use server';

import { createClient } from '@/lib/supabase/server';
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
import { revalidatePath } from 'next/cache';

export async function getListRecipes(filters?: {
  search?: string;
  attributes?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  return listRecipes(supabase, user.id, filters as any);
}

export async function getRecipeDetailAction(recipeId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  return getRecipeDetail(supabase, user.id, recipeId);
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const result = await createRecipe(supabase, user.id, data as any);
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const result = await updateRecipe(supabase, user.id, recipeId, data as any);
  revalidatePath('/recipes');
  return result;
}

export async function deleteRecipeAction(recipeId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const result = await deleteRecipe(supabase, user.id, recipeId);
  revalidatePath('/recipes');
  return result;
}

export async function getInventoryForRecipe() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  return listInventory(supabase, user.id);
}

export async function getUtensilsForRecipe() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  return listUtensils(supabase, user.id);
}

export async function uploadRecipePhotoAction(recipeId: string, file: File) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const result = await uploadRecipePhoto(supabase, user.id, recipeId, file);
  revalidatePath('/recipes');
  return result;
}

export async function deleteRecipePhotoAction(photoId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const result = await deleteRecipePhoto(supabase, user.id, photoId);
  revalidatePath('/recipes');
  return result;
}

export async function getPhotoUrl(storagePath: string) {
  const supabase = await createClient();
  const { data } = supabase.storage
    .from('recipe-photos')
    .getPublicUrl(storagePath);
  return data.publicUrl;
}
