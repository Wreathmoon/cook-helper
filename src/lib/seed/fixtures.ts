import type { InventoryItem, Recipe, RecipeIngredient, Utensil, CalendarEntry } from '@/types';
import { seedRecipes } from './seed-data';

// Demo 用固定数据，不碰数据库
// 从 seed-data 中精选 12 道菜作为 Demo 展示

const demoRecipeNames = [
  '西红柿炒鸡蛋', '红烧肉', '宫保鸡丁', '酸辣土豆丝',
  '麻婆豆腐', '蛋炒饭', '紫菜蛋花汤', '凉拌黄瓜',
  '蒜蓉西兰花', '可乐鸡翅', '西红柿蛋汤', '青椒肉丝',
];

function buildDemoRecipe(seedName: string, idx: number): Recipe {
  const seed = seedRecipes.find(r => r.name === seedName)!;
  return {
    id: `demo-recipe-${idx + 1}`,
    user_id: 'demo',
    name: seed.name,
    steps: seed.steps || null,
    cook_time_minutes: seed.cook_time_minutes || null,
    difficulty: seed.difficulty || null,
    attributes: seed.attributes,
    tips: seed.tips || null,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
  };
}

export const demoRecipes: Recipe[] = demoRecipeNames.map((name, i) => buildDemoRecipe(name, i));

export const demoRecipeIngredients: Record<string, RecipeIngredient[]> = {};
for (let i = 0; i < demoRecipeNames.length; i++) {
  const seed = seedRecipes.find(r => r.name === demoRecipeNames[i])!;
  const recipeId = `demo-recipe-${i + 1}`;
  demoRecipeIngredients[recipeId] = seed.ingredients.map((ing, j) => ({
    id: `${recipeId}-ing-${j + 1}`,
    recipe_id: recipeId,
    inventory_id: `demo-inv-${ing.name}`,
    role: ing.role,
    amount: ing.amount || null,
  }));
}

export const demoInventory: InventoryItem[] = [
  // 蔬菜
  { id: 'demo-inv-西红柿', user_id: 'demo', name: '西红柿', category: 'vegetable', total_amount: null, stock_level: 'enough', unit: '个', last_restocked_at: '2026-07-01T00:00:00Z', note: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'demo-inv-土豆', user_id: 'demo', name: '土豆', category: 'vegetable', total_amount: null, stock_level: 'enough', unit: '个', last_restocked_at: '2026-07-01T00:00:00Z', note: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'demo-inv-黄瓜', user_id: 'demo', name: '黄瓜', category: 'vegetable', total_amount: null, stock_level: 'low', unit: '根', last_restocked_at: null, note: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'demo-inv-青椒', user_id: 'demo', name: '青椒', category: 'vegetable', total_amount: null, stock_level: 'enough', unit: '个', last_restocked_at: '2026-07-01T00:00:00Z', note: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'demo-inv-西兰花', user_id: 'demo', name: '西兰花', category: 'vegetable', total_amount: null, stock_level: 'low', unit: '颗', last_restocked_at: null, note: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'demo-inv-白菜', user_id: 'demo', name: '白菜', category: 'vegetable', total_amount: null, stock_level: 'out', unit: '颗', last_restocked_at: null, note: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  // 肉类
  { id: 'demo-inv-猪肉', user_id: 'demo', name: '猪肉', category: 'meat', total_amount: null, stock_level: 'enough', unit: 'g', last_restocked_at: '2026-07-01T00:00:00Z', note: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'demo-inv-鸡胸肉', user_id: 'demo', name: '鸡胸肉', category: 'meat', total_amount: null, stock_level: 'low', unit: 'g', last_restocked_at: null, note: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'demo-inv-鸡腿', user_id: 'demo', name: '鸡腿', category: 'meat', total_amount: null, stock_level: 'enough', unit: '个', last_restocked_at: '2026-07-01T00:00:00Z', note: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  // 蛋奶豆
  { id: 'demo-inv-鸡蛋', user_id: 'demo', name: '鸡蛋', category: 'egg_dairy_bean', total_amount: null, stock_level: 'enough', unit: '个', last_restocked_at: '2026-07-01T00:00:00Z', note: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'demo-inv-豆腐', user_id: 'demo', name: '豆腐', category: 'egg_dairy_bean', total_amount: null, stock_level: 'enough', unit: '块', last_restocked_at: '2026-07-01T00:00:00Z', note: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  // 主食
  { id: 'demo-inv-大米', user_id: 'demo', name: '大米', category: 'staple', total_amount: null, stock_level: 'enough', unit: 'g', last_restocked_at: '2026-07-01T00:00:00Z', note: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  // 蔬菜补充
  { id: 'demo-inv-紫菜', user_id: 'demo', name: '紫菜', category: 'vegetable', total_amount: null, stock_level: 'enough', unit: '块', last_restocked_at: '2026-07-01T00:00:00Z', note: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  // 调料
  { id: 'demo-inv-盐', user_id: 'demo', name: '盐', category: 'seasoning', total_amount: null, stock_level: 'enough', unit: null, last_restocked_at: '2026-07-01T00:00:00Z', note: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'demo-inv-生抽', user_id: 'demo', name: '生抽', category: 'seasoning', total_amount: null, stock_level: 'enough', unit: null, last_restocked_at: '2026-07-01T00:00:00Z', note: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'demo-inv-食用油', user_id: 'demo', name: '食用油', category: 'seasoning', total_amount: null, stock_level: 'enough', unit: null, last_restocked_at: '2026-07-01T00:00:00Z', note: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'demo-inv-葱姜蒜', user_id: 'demo', name: '葱姜蒜', category: 'seasoning', total_amount: null, stock_level: 'enough', unit: null, last_restocked_at: '2026-07-01T00:00:00Z', note: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'demo-inv-醋', user_id: 'demo', name: '醋', category: 'seasoning', total_amount: null, stock_level: 'enough', unit: null, last_restocked_at: '2026-07-01T00:00:00Z', note: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'demo-inv-白糖', user_id: 'demo', name: '白糖', category: 'seasoning', total_amount: null, stock_level: 'low', unit: null, last_restocked_at: null, note: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'demo-inv-豆瓣酱', user_id: 'demo', name: '豆瓣酱', category: 'seasoning', total_amount: null, stock_level: 'enough', unit: null, last_restocked_at: '2026-07-01T00:00:00Z', note: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
];

export const demoUtensils: Utensil[] = [
  { id: 'demo-ut-1', user_id: 'demo', name: '炒锅', note: '26cm不粘锅', created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'demo-ut-2', user_id: 'demo', name: '蒸锅', note: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'demo-ut-3', user_id: 'demo', name: '煮锅', note: '汤锅', created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'demo-ut-4', user_id: 'demo', name: '菜刀', note: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
  { id: 'demo-ut-5', user_id: 'demo', name: '砧板', note: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
];

export const demoCalendarEntries: CalendarEntry[] = [
  { id: 'demo-cal-1', user_id: 'demo', date: '2026-07-03', recipe_id: 'demo-recipe-1', status: 'completed', notes: null, created_at: '2026-07-03T00:00:00Z', updated_at: '2026-07-03T00:00:00Z' },
  { id: 'demo-cal-2', user_id: 'demo', date: '2026-07-04', recipe_id: 'demo-recipe-6', status: 'completed', notes: '加了火腿', created_at: '2026-07-04T00:00:00Z', updated_at: '2026-07-04T00:00:00Z' },
  { id: 'demo-cal-3', user_id: 'demo', date: '2026-07-05', recipe_id: 'demo-recipe-2', status: 'planned', notes: null, created_at: '2026-07-05T00:00:00Z', updated_at: '2026-07-05T00:00:00Z' },
  { id: 'demo-cal-4', user_id: 'demo', date: '2026-07-06', recipe_id: 'demo-recipe-3', status: 'planned', notes: null, created_at: '2026-07-05T00:00:00Z', updated_at: '2026-07-05T00:00:00Z' },
  { id: 'demo-cal-5', user_id: 'demo', date: '2026-07-05', recipe_id: 'demo-recipe-7', status: 'planned', notes: '配红烧肉', created_at: '2026-07-05T00:00:00Z', updated_at: '2026-07-05T00:00:00Z' },
];
