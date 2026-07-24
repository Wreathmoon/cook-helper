-- Migration: Add category column to utensils table
-- Run this in Supabase SQL Editor or via migration tool

ALTER TABLE utensils ADD COLUMN IF NOT EXISTS category VARCHAR DEFAULT NULL;

-- Optional: Add check constraint for valid category values
-- ALTER TABLE utensils ADD CONSTRAINT utensils_category_check
--   CHECK (category IS NULL OR category IN ('锅具', '电器', '其他'));

-- Optional: Update RLS policies if needed (existing policies should cover this)
