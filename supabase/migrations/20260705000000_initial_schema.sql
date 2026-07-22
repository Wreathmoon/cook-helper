-- =============================================================================
-- Migration: 20260705000000_initial_schema.sql
-- Description: Initial database schema for Cook Helper
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Enums
-- ─────────────────────────────────────────────────────────────────────────────

-- 库存分类
CREATE TYPE inventory_category AS ENUM ('vegetable', 'meat', 'egg_dairy_bean', 'staple', 'seasoning');

-- 库存档位（三档制）
CREATE TYPE stock_level AS ENUM ('enough', 'low', 'out');

-- 难度
CREATE TYPE difficulty AS ENUM ('easy', 'medium', 'hard');

-- 食材角色
CREATE TYPE ingredient_role AS ENUM ('main', 'auxiliary', 'seasoning');

-- 日历状态
CREATE TYPE calendar_status AS ENUM ('planned', 'completed');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Tables
-- ─────────────────────────────────────────────────────────────────────────────

-- inventory 表（食材/调料）
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category inventory_category NOT NULL,
  total_amount TEXT,
  stock_level stock_level NOT NULL DEFAULT 'enough',
  unit TEXT,
  last_restocked_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- utensils 表（厨具）
CREATE TABLE utensils (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- recipes 表（菜谱）
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  steps JSONB,
  cook_time_minutes INTEGER,
  difficulty difficulty,
  attributes JSONB NOT NULL DEFAULT '{}',
  tips TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- recipe_ingredients 表（菜谱-食材关联）
CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL,  -- 不直接 FK 到 inventory，种子复制时需要灵活处理
  role ingredient_role NOT NULL,
  amount TEXT
);

-- recipe_utensils 表（菜谱-厨具关联，按名称匹配）
CREATE TABLE recipe_utensils (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  utensil_name TEXT NOT NULL
);

-- recipe_photos 表
CREATE TABLE recipe_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- calendar_entries 表
CREATE TABLE calendar_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  status calendar_status NOT NULL DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- calendar_photos 表
CREATE TABLE calendar_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_entry_id UUID NOT NULL REFERENCES calendar_entries(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Indexes
-- ─────────────────────────────────────────────────────────────────────────────

-- RLS 查询优化
CREATE INDEX idx_inventory_user_id ON inventory(user_id);
CREATE INDEX idx_utensils_user_id ON utensils(user_id);
CREATE INDEX idx_recipes_user_id ON recipes(user_id);
CREATE INDEX idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_inventory_id ON recipe_ingredients(inventory_id);
CREATE INDEX idx_recipe_utensils_recipe_id ON recipe_utensils(recipe_id);
CREATE INDEX idx_recipe_photos_recipe_id ON recipe_photos(recipe_id);
CREATE INDEX idx_calendar_entries_user_id ON calendar_entries(user_id);
CREATE INDEX idx_calendar_entries_date ON calendar_entries(user_id, date);
CREATE INDEX idx_calendar_photos_entry_id ON calendar_photos(calendar_entry_id);

-- jsonb GIN 索引（recipes.attributes 标签筛选）
CREATE INDEX idx_recipes_attributes ON recipes USING GIN (attributes);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- inventory
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own inventory" ON inventory FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own inventory" ON inventory FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own inventory" ON inventory FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own inventory" ON inventory FOR DELETE USING (user_id = auth.uid());

-- utensils
ALTER TABLE utensils ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own utensils" ON utensils FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own utensils" ON utensils FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own utensils" ON utensils FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own utensils" ON utensils FOR DELETE USING (user_id = auth.uid());

-- recipes
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own recipes" ON recipes FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own recipes" ON recipes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own recipes" ON recipes FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own recipes" ON recipes FOR DELETE USING (user_id = auth.uid());

-- recipe_ingredients（通过 recipe_id 关联到 recipes 的 user_id）
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own recipe_ingredients" ON recipe_ingredients FOR SELECT
  USING (recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own recipe_ingredients" ON recipe_ingredients FOR INSERT
  WITH CHECK (recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own recipe_ingredients" ON recipe_ingredients FOR UPDATE
  USING (recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete own recipe_ingredients" ON recipe_ingredients FOR DELETE
  USING (recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid()));

-- recipe_utensils（同上）
ALTER TABLE recipe_utensils ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own recipe_utensils" ON recipe_utensils FOR SELECT
  USING (recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own recipe_utensils" ON recipe_utensils FOR INSERT
  WITH CHECK (recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own recipe_utensils" ON recipe_utensils FOR UPDATE
  USING (recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete own recipe_utensils" ON recipe_utensils FOR DELETE
  USING (recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid()));

-- recipe_photos（同上）
ALTER TABLE recipe_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own recipe_photos" ON recipe_photos FOR SELECT
  USING (recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own recipe_photos" ON recipe_photos FOR INSERT
  WITH CHECK (recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete own recipe_photos" ON recipe_photos FOR DELETE
  USING (recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid()));

-- calendar_entries
ALTER TABLE calendar_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own calendar_entries" ON calendar_entries FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own calendar_entries" ON calendar_entries FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own calendar_entries" ON calendar_entries FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own calendar_entries" ON calendar_entries FOR DELETE USING (user_id = auth.uid());

-- calendar_photos（通过 calendar_entry_id 关联）
ALTER TABLE calendar_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own calendar_photos" ON calendar_photos FOR SELECT
  USING (calendar_entry_id IN (SELECT id FROM calendar_entries WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own calendar_photos" ON calendar_photos FOR INSERT
  WITH CHECK (calendar_entry_id IN (SELECT id FROM calendar_entries WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete own calendar_photos" ON calendar_photos FOR DELETE
  USING (calendar_entry_id IN (SELECT id FROM calendar_entries WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Storage Buckets & Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- 创建 Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('recipe-photos', 'recipe-photos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('calendar-photos', 'calendar-photos', true);

-- Storage RLS: 用户只能上传/删除自己的文件
CREATE POLICY "Users can upload own recipe photos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'recipe-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can view all recipe photos" ON storage.objects FOR SELECT
  USING (bucket_id = 'recipe-photos');
CREATE POLICY "Users can delete own recipe photos" ON storage.objects FOR DELETE
  USING (bucket_id = 'recipe-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can upload own calendar photos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'calendar-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can view all calendar photos" ON storage.objects FOR SELECT
  USING (bucket_id = 'calendar-photos');
CREATE POLICY "Users can delete own calendar photos" ON storage.objects FOR DELETE
  USING (bucket_id = 'calendar-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Triggers: auto-update updated_at
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON utensils
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON calendar_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
