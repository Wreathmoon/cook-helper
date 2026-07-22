/**
 * Recipe Service — A 层核心纯函数
 * 同构纯函数，签名 fn(supabase, userId, args)，不依赖浏览器全局
 * 供 UI (Server Actions) 和二期 Agent 共用
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Recipe,
  RecipeIngredient,
  RecipeUtensil,
  RecipePhoto,
  RecipeAttributes,
  Difficulty,
} from '@/types';

/** 菜谱详情（含关联食材和厨具） */
export interface RecipeDetail extends Recipe {
  ingredients: (RecipeIngredient & {
    inventory?: { name: string; category: string; stock_level: string };
  })[];
  utensils: RecipeUtensil[];
  photos: RecipePhoto[];
}

/** 菜谱列表（支持搜索 + 标签筛选） */
export async function listRecipes(
  supabase: SupabaseClient,
  userId: string,
  filters?: {
    search?: string;
    attributes?: Partial<RecipeAttributes>;
  }
): Promise<{ data: Recipe[]; error: string | null }> {
  let query = supabase
    .from('recipes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }

  // jsonb 属性筛选
  if (filters?.attributes) {
    const attrs = filters.attributes;

    // 数组类型字段用 contains
    if (attrs.method && attrs.method.length > 0) {
      query = query.contains('attributes', JSON.stringify({ method: attrs.method }));
    }
    if (attrs.nutrition && attrs.nutrition.length > 0) {
      query = query.contains('attributes', JSON.stringify({ nutrition: attrs.nutrition }));
    }
    if (attrs.scene && attrs.scene.length > 0) {
      query = query.contains('attributes', JSON.stringify({ scene: attrs.scene }));
    }

    // 单值字段直接匹配
    if (attrs.spiciness) {
      query = query.contains('attributes', JSON.stringify({ spiciness: attrs.spiciness }));
    }
    if (attrs.greasiness) {
      query = query.contains('attributes', JSON.stringify({ greasiness: attrs.greasiness }));
    }
    if (attrs.flavor) {
      query = query.contains('attributes', JSON.stringify({ flavor: attrs.flavor }));
    }
    if (attrs.diet_type) {
      query = query.contains('attributes', JSON.stringify({ diet_type: attrs.diet_type }));
    }
    if (attrs.cuisine) {
      query = query.contains('attributes', JSON.stringify({ cuisine: attrs.cuisine }));
    }
  }

  const { data, error } = await query;
  return { data: data || [], error: error?.message || null };
}

/** 菜谱详情（含关联食材和厨具） */
export async function getRecipeDetail(
  supabase: SupabaseClient,
  userId: string,
  recipeId: string
): Promise<{ data: RecipeDetail | null; error: string | null }> {
  // 获取菜谱基本信息
  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', recipeId)
    .eq('user_id', userId)
    .single();

  if (recipeError || !recipe) {
    return { data: null, error: recipeError?.message || '菜谱不存在' };
  }

  // 获取关联食材（含 inventory 信息）
  const { data: ingredients } = await supabase
    .from('recipe_ingredients')
    .select('*, inventory:inventory_id(name, category, stock_level)')
    .eq('recipe_id', recipeId);

  // 获取关联厨具
  const { data: utensils } = await supabase
    .from('recipe_utensils')
    .select('*')
    .eq('recipe_id', recipeId);

  // 获取照片
  const { data: photos } = await supabase
    .from('recipe_photos')
    .select('*')
    .eq('recipe_id', recipeId);

  return {
    data: {
      ...recipe,
      ingredients: ingredients || [],
      utensils: utensils || [],
      photos: photos || [],
    },
    error: null,
  };
}

/** 创建菜谱（含关联写入） */
export async function createRecipe(
  supabase: SupabaseClient,
  userId: string,
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
    utensils?: string[]; // utensil names
  }
): Promise<{ data: Recipe | null; error: string | null }> {
  // 1. 创建菜谱
  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .insert({
      name: data.name,
      user_id: userId,
      steps: data.steps || null,
      cook_time_minutes: data.cook_time_minutes || null,
      difficulty: data.difficulty || null,
      attributes: data.attributes || {},
      tips: data.tips || null,
    })
    .select()
    .single();

  if (recipeError || !recipe) {
    return { data: null, error: recipeError?.message || '创建菜谱失败' };
  }

  // 2. 创建食材关联
  if (data.ingredients && data.ingredients.length > 0) {
    const { error } = await supabase
      .from('recipe_ingredients')
      .insert(
        data.ingredients.map((ing) => ({
          recipe_id: recipe.id,
          inventory_id: ing.inventory_id,
          role: ing.role,
          amount: ing.amount || null,
        }))
      );
    if (error) return { data: null, error: error.message };
  }

  // 3. 创建厨具关联
  if (data.utensils && data.utensils.length > 0) {
    const { error } = await supabase
      .from('recipe_utensils')
      .insert(
        data.utensils.map((name) => ({
          recipe_id: recipe.id,
          utensil_name: name,
        }))
      );
    if (error) return { data: null, error: error.message };
  }

  return { data: recipe, error: null };
}

/** 更新菜谱（食材/厨具采用先删后增策略） */
export async function updateRecipe(
  supabase: SupabaseClient,
  userId: string,
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
  // 1. 更新菜谱基本信息
  const { error: recipeError } = await supabase
    .from('recipes')
    .update({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.steps !== undefined && { steps: data.steps }),
      ...(data.cook_time_minutes !== undefined && {
        cook_time_minutes: data.cook_time_minutes,
      }),
      ...(data.difficulty !== undefined && { difficulty: data.difficulty }),
      ...(data.attributes !== undefined && { attributes: data.attributes }),
      ...(data.tips !== undefined && { tips: data.tips }),
    })
    .eq('id', recipeId)
    .eq('user_id', userId);

  if (recipeError) return { data: null, error: recipeError.message };

  // 2. 重建食材关联（先删后增）
  if (data.ingredients !== undefined) {
    await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
    if (data.ingredients.length > 0) {
      const { error } = await supabase.from('recipe_ingredients').insert(
        data.ingredients.map((ing) => ({
          recipe_id: recipeId,
          inventory_id: ing.inventory_id,
          role: ing.role,
          amount: ing.amount || null,
        }))
      );
      if (error) return { data: null, error: error.message };
    }
  }

  // 3. 重建厨具关联
  if (data.utensils !== undefined) {
    await supabase.from('recipe_utensils').delete().eq('recipe_id', recipeId);
    if (data.utensils.length > 0) {
      const { error } = await supabase.from('recipe_utensils').insert(
        data.utensils.map((name) => ({
          recipe_id: recipeId,
          utensil_name: name,
        }))
      );
      if (error) return { data: null, error: error.message };
    }
  }

  // 返回更新后的菜谱
  const { data: updated } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', recipeId)
    .single();

  return { data: updated, error: null };
}

/** 删除菜谱 */
export async function deleteRecipe(
  supabase: SupabaseClient,
  userId: string,
  recipeId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('recipes')
    .delete()
    .eq('id', recipeId)
    .eq('user_id', userId);

  return { error: error?.message || null };
}

/** 上传菜谱照片 */
export async function uploadRecipePhoto(
  supabase: SupabaseClient,
  userId: string,
  recipeId: string,
  file: File
): Promise<{ data: RecipePhoto | null; error: string | null }> {
  const ext = file.name.split('.').pop();
  const path = `${userId}/${recipeId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('recipe-photos')
    .upload(path, file);

  if (uploadError) return { data: null, error: uploadError.message };

  const { data: photo, error: photoError } = await supabase
    .from('recipe_photos')
    .insert({ recipe_id: recipeId, storage_path: path })
    .select()
    .single();

  return { data: photo, error: photoError?.message || null };
}

/** 删除菜谱照片 */
export async function deleteRecipePhoto(
  supabase: SupabaseClient,
  _userId: string,
  photoId: string
): Promise<{ error: string | null }> {
  // 先获取照片路径
  const { data: photo } = await supabase
    .from('recipe_photos')
    .select('storage_path')
    .eq('id', photoId)
    .single();

  if (photo) {
    await supabase.storage.from('recipe-photos').remove([photo.storage_path]);
  }

  const { error } = await supabase
    .from('recipe_photos')
    .delete()
    .eq('id', photoId);

  return { error: error?.message || null };
}
