// 枚举
export type StockLevel = 'enough' | 'low' | 'out';
export type InventoryCategory = 'vegetable' | 'meat' | 'egg_dairy_bean' | 'staple' | 'seasoning';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type IngredientRole = 'main' | 'auxiliary' | 'seasoning';
export type CalendarStatus = 'planned' | 'completed';
export type CookingMethod = '炒' | '炖' | '蒸' | '煮' | '烤' | '凉拌' | '炸';
export type Spiciness = '不辣' | '微辣' | '中辣' | '重辣';
export type Greasiness = '清爽' | '适中' | '重油';
export type Flavor = '咸鲜' | '清淡' | '带甜';
export type DietType = '纯荤' | '荤素搭配' | '纯素';
export type Nutrition = '高蛋白' | '高碳水主食' | '多蔬菜纤维' | '汤水';
export type Scene = '工作日快手' | '周末慢做' | '宴客硬菜' | '夜宵';
export type Cuisine = '川' | '粤' | '鲁' | '家常' | '其他';

// 数据库表接口
export interface InventoryItem {
  id: string;
  user_id: string;
  name: string;
  category: InventoryCategory;
  total_amount: string | null;
  stock_level: StockLevel;
  unit: string | null;
  last_restocked_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Utensil {
  id: string;
  user_id: string;
  name: string;
  category?: string; // "锅具" | "电器" | "其他"
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeAttributes {
  method?: CookingMethod[];
  spiciness?: Spiciness;
  greasiness?: Greasiness;
  flavor?: Flavor;
  diet_type?: DietType;
  nutrition?: Nutrition[];
  scene?: Scene[];
  cuisine?: Cuisine;
}

export interface Recipe {
  id: string;
  user_id: string;
  name: string;
  steps: { step_number: number; description: string }[] | null;
  cook_time_minutes: number | null;
  difficulty: Difficulty | null;
  attributes: RecipeAttributes;
  tips: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  inventory_id: string;
  role: IngredientRole;
  amount: string | null;
}

export interface RecipeUtensil {
  id: string;
  recipe_id: string;
  utensil_name: string;
}

export interface RecipePhoto {
  id: string;
  recipe_id: string;
  storage_path: string;
  created_at: string;
}

export interface CalendarEntry {
  id: string;
  user_id: string;
  date: string;
  recipe_id: string;
  status: CalendarStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarPhoto {
  id: string;
  calendar_entry_id: string;
  storage_path: string;
}

// 推荐相关
export type RecommendTier = 'can_make_now' | 'need_shopping' | 'clear_stock';

export interface RecommendedRecipe {
  recipe: Recipe;
  tier: RecommendTier;
  score: number;
  missingIngredients?: string[];
  missingUtensils?: string[];
  clearStockIngredients?: string[];
  reason?: string;
}

// 购物清单
export interface ShoppingListItem {
  name: string;
  category: InventoryCategory;
  source: string; // 来自哪个菜谱或"库存不足"
  suggestedAmount?: string;
  inventoryId?: string; // 如果已有对应库存项
}
