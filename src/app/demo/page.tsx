'use client';

import React, { useState, useMemo, Suspense } from 'react';
import {
  Button, message, Modal, Input, Select, Divider, Space, Typography,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useSearchParams } from 'next/navigation';
import type {
  Recipe, CalendarEntry, RecommendedRecipe, ShoppingListItem,
  InventoryCategory, StockLevel, InventoryItem, Utensil, RecipeIngredient,
  CalendarStatus,
} from '@/types';
import {
  demoInventory,
  demoRecipes,
  demoRecipeIngredients,
  demoUtensils,
  demoCalendarEntries,
} from '@/lib/seed/fixtures';
import { tierRecipes } from '@/lib/recommend/tiering';
import { scoreAndSort } from '@/lib/recommend/scoring';
import { TEXT } from '@/lib/constants/text';
import { StatusDot } from '@/components/shared/StatusDot';
import { RecipeDetailModal } from '@/components/shared/RecipeDetailModal';
import { WaterfallCard } from '@/components/recipes';
import {
  RecommendView,
  InventoryView,
  UtensilsView,
  CalendarView,
} from '@/components/views';

const { Text, Title } = Typography;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const categoryLabels: Record<InventoryCategory, string> = {
  vegetable: TEXT.inventory.categories.vegetable,
  meat: TEXT.inventory.categories.meat,
  egg_dairy_bean: TEXT.inventory.categories.egg_dairy_bean,
  staple: TEXT.inventory.categories.staple,
  seasoning: TEXT.inventory.categories.seasoning,
};

const categoryKeys: InventoryCategory[] = ['vegetable', 'meat', 'egg_dairy_bean', 'staple', 'seasoning'];

function buildRecipeIngredientsMap(
  ingredients: Record<string, RecipeIngredient[]>
): Map<string, { inventory_id: string; role: string; amount?: string }[]> {
  const map = new Map<string, { inventory_id: string; role: string; amount?: string }[]>();
  for (const [recipeId, ings] of Object.entries(ingredients)) {
    map.set(recipeId, ings.map((i) => ({ inventory_id: i.inventory_id, role: i.role, amount: i.amount || undefined })));
  }
  return map;
}

function getIngredientStatus(
  recipeId: string,
  ingredients: Record<string, RecipeIngredient[]>,
  inventory: InventoryItem[] = demoInventory
): { name: string; status: StockLevel; role: string }[] {
  const ings = ingredients[recipeId] || [];
  const invMap = new Map(inventory.map((i) => [i.id, i]));
  return ings.map((ing) => {
    const inv = invMap.get(ing.inventory_id);
    return { name: inv?.name || '未知食材', status: inv?.stock_level || 'out', role: ing.role };
  });
}

// ─── Demo Data Wrapper — 计算推荐数据供 RecommendView 使用 ───────────────

function useDemoRecommendData(
  inventory: InventoryItem[],
  recipes: Recipe[],
  ingredients: Record<string, RecipeIngredient[]>,
  utensils: Utensil[],
  calendarEntries: CalendarEntry[],
) {
  return useMemo(() => {
    const recipeIngredientsMap = buildRecipeIngredientsMap(ingredients);
    const tiered = tierRecipes({ recipes, inventory, utensils, calendarEntries, recipeIngredients: recipeIngredientsMap, recipeUtensils: new Map() });
    const recommended = scoreAndSort({ tieredRecipes: tiered, calendarEntries, inventory, recipeIngredients: recipeIngredientsMap, userFilters: undefined });
    const order: Record<string, number> = { clear_stock: 0, can_make_now: 1, need_shopping: 2 };
    return [...recommended].sort((a, b) => (order[a.tier] ?? 3) - (order[b.tier] ?? 3));
  }, [inventory, recipes, ingredients, utensils, calendarEntries]);
}

// ─── Recipes Section — 使用共享 WaterfallCard ────────────────────────────

function RecipesSection({
  recipes, ingredients, onChange,
}: { recipes: Recipe[]; ingredients: Record<string, RecipeIngredient[]>; onChange: (recipes: Recipe[]) => void }) {
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [searchText, setSearchText] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const filtered = useMemo(() => {
    if (!searchText) return recipes;
    return recipes.filter((r) => r.name.includes(searchText));
  }, [recipes, searchText]);

  const handleAddRecipe = () => {
    const name = newName.trim();
    if (!name) { message.warning('请输入菜谱名称'); return; }
    onChange([{ id: `recipe-${Date.now()}`, user_id: 'demo', name, steps: null, cook_time_minutes: null, difficulty: null, attributes: {}, tips: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...recipes]);
    setNewName(''); setAddModalOpen(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{TEXT.recipes.title}</Title>
        <Input.Search placeholder="搜索菜谱" value={searchText} onChange={(e) => setSearchText(e.target.value)} style={{ width: 200 }} size="small" />
      </div>
      <div style={{ columns: '180px 4', columnGap: 10 }}>
        <div onClick={() => setAddModalOpen(true)} style={{ breakInside: 'avoid', marginBottom: 10, borderRadius: 14, border: '1.5px dashed var(--primary)', background: 'var(--primary-soft)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 12px', gap: 6 }}>
          <PlusOutlined style={{ fontSize: 20, color: 'var(--primary)' }} />
          <span style={{ fontSize: 12.5, color: 'var(--primary)', fontWeight: 600 }}>新建菜谱</span>
        </div>
        {filtered.map((recipe) => {
          const ingStatus = getIngredientStatus(recipe.id, ingredients);
          const missingCount = ingStatus.filter((i) => i.status !== 'enough').length;
          return (
            <WaterfallCard
              key={recipe.id}
              recipe={recipe}
              missingCount={missingCount}
              onClick={() => setSelectedRecipe(recipe)}
            />
          );
        })}
      </div>
      <Modal title="新建菜谱" open={addModalOpen} onCancel={() => setAddModalOpen(false)} onOk={handleAddRecipe}>
        <Input placeholder="菜谱名称" value={newName} onChange={(e) => setNewName(e.target.value)} onPressEnter={handleAddRecipe} />
      </Modal>
      <RecipeDetailModal recipe={selectedRecipe} open={!!selectedRecipe} onClose={() => setSelectedRecipe(null)} />
    </div>
  );
}

// ─── Calendar Section — 使用共享 CalendarView ────────────────────────────

function CalendarSection({
  entries, recipes: recipeList, onChange,
}: { entries: CalendarEntry[]; recipes: Recipe[]; onChange: (entries: CalendarEntry[]) => void }) {
  const calEntries = entries.map((e) => ({
    ...e,
    recipe: recipeList.find((r) => r.id === e.recipe_id) ? { name: recipeList.find((r) => r.id === e.recipe_id)!.name } : undefined,
  }));

  const handleAdd = async (params: { date: string; recipeId: string; status: CalendarStatus }) => {
    const newEntry: CalendarEntry = {
      id: `cal-${Date.now()}`,
      user_id: 'demo',
      date: params.date,
      recipe_id: params.recipeId,
      status: params.status,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    onChange([...entries, newEntry]);
  };

  return (
    <CalendarView
      entries={calEntries}
      recipes={recipeList.map((r) => ({ id: r.id, name: r.name }))}
      onAddEntry={handleAdd}
      onDeleteEntry={async (entryId) => {
        onChange(entries.filter((e) => e.id !== entryId));
      }}
      readOnly
    />
  );
}

// ─── Main Demo Page ────────────────────────────────────────────────────

function DemoPageContent() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'recommend';

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([...demoInventory]);
  const [recipes, setRecipes] = useState<Recipe[]>([...demoRecipes]);
  const [utensils, setUtensils] = useState<Utensil[]>([...demoUtensils]);
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([...demoCalendarEntries]);

  const allRecs = useDemoRecommendData(inventoryItems, recipes, demoRecipeIngredients, utensils, calendarEntries);

  // read-only callbacks
  const showLogin = () => message.info('Demo 只读。请登录后操作');
  const showLoginAdd = () => message.info('请登录后添加');

  const sections: Record<string, React.ReactNode> = {
    recommend: (
      <RecommendView
        allRecs={allRecs} loading={false}
        inventoryCount={inventoryItems.length} utensilCount={utensils.length}
        shoppingItems={[]} shoppingLoading={false}
        checkedItems={new Set()} checkoutLoading={false}
        onCook={showLogin} onRefreshBatch={() => {}} onSwapSlot={() => {}}
        onToggleSelect={() => {}} onToggleCheckout={() => {}} onCheckout={() => {}}
        readOnly
      />
    ),
    inventory: (
      <InventoryView
        items={inventoryItems} loading={false}
        onAdd={showLoginAdd} onEdit={showLoginAdd} onDelete={showLoginAdd}
        onStockChange={showLoginAdd}
        readOnly
      />
    ),
    utensils: (
      <UtensilsView
        items={utensils} loading={false}
        onAdd={showLoginAdd} onEdit={showLoginAdd} onDelete={showLoginAdd}
        readOnly
      />
    ),
    recipes: <RecipesSection recipes={recipes} ingredients={demoRecipeIngredients} onChange={setRecipes} />,
    calendar: <CalendarSection entries={calendarEntries} recipes={recipes} onChange={setCalendarEntries} />,
  };

  return <div className="page-body">{sections[defaultTab] || sections.recommend}</div>;
}

export default function DemoPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: 48 }}>{TEXT.common.loading}</div>}>
      <DemoPageContent />
    </Suspense>
  );
}
