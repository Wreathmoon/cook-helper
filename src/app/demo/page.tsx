'use client';

import React, { useState, useMemo, Suspense } from 'react';
import {
  Button, message, Modal, Select, Input, Divider, Space, Typography,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useSearchParams } from 'next/navigation';
import type {
  Recipe, CalendarEntry, RecommendedRecipe, ShoppingListItem,
  InventoryCategory, StockLevel, InventoryItem, Utensil, RecipeIngredient,
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
import {
  RecommendView,
  InventoryView,
  UtensilsView,
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

const difficultyLabel: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难' };
const roleLabel: Record<string, string> = { main: '主料', auxiliary: '辅料', seasoning: '调料' };
const stockLevelColor: Record<StockLevel, string> = { enough: 'green', low: 'orange', out: 'red' };

function buildRecipeIngredientsMap(
  ingredients: Record<string, RecipeIngredient[]>
): Map<string, { inventory_id: string; role: string; amount?: string }[]> {
  const map = new Map<string, { inventory_id: string; role: string; amount?: string }[]>();
  for (const [recipeId, ings] of Object.entries(ingredients)) {
    map.set(recipeId, ings.map((i) => ({ inventory_id: i.inventory_id, role: i.role, amount: i.amount || undefined })));
  }
  return map;
}

function getDaysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
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

// ─── Recipes Section (demo only — 菜谱未做共享视图) ─────────────────────

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
          const allEnough = ingStatus.every((i) => i.status === 'enough');
          const missingCount = ingStatus.filter((i) => i.status !== 'enough').length;
          return (
            <div key={recipe.id} onClick={() => setSelectedRecipe(recipe)} style={{ breakInside: 'avoid', marginBottom: 10, borderRadius: 14, background: 'var(--panel)', border: '1px solid var(--line)', overflow: 'hidden', cursor: 'pointer', transition: 'transform .15s, box-shadow .15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(60,50,30,.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
              <div style={{ height: 92 + (recipe.id.charCodeAt(recipe.id.length - 1) % 60), background: 'linear-gradient(135deg, var(--primary-soft), var(--hover))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--tx2)' }}>成品照</div>
              <div style={{ padding: '8px 10px 10px' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--tx)', marginBottom: 4 }}>{recipe.name}</div>
                {recipe.attributes?.flavor && <div style={{ fontSize: 11, color: 'var(--tx2)', marginBottom: 6, lineHeight: 1.4 }}>{String(recipe.attributes.flavor)}</div>}
                <Divider style={{ margin: '4px 0' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: allEnough ? 'var(--success)' : missingCount > 0 ? 'var(--danger)' : 'var(--warn)' }} />
                    <span style={{ fontSize: 11, color: 'var(--tx2)' }}>{allEnough ? '食材全齐' : `缺${missingCount}样`}</span>
                  </div>
                </div>
              </div>
            </div>
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

// ─── Calendar Section

function CalendarSection({
  entries, recipes: recipeList, onChange,
}: { entries: CalendarEntry[]; recipes: Recipe[]; onChange: (entries: CalendarEntry[]) => void }) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showRecipePicker, setShowRecipePicker] = useState(false);
  const [viewMonth, setViewMonth] = useState(6);

  const year = 2026; const month = viewMonth;
  const recipeMap = useMemo(() => new Map(recipeList.map((r) => [r.id, r])), [recipeList]);
  const calMap = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of entries) { const e = map.get(entry.date) || []; e.push(entry); map.set(entry.date, e); }
    return map;
  }, [entries]);

  const firstDay = new Date(year, month, 1).getDay();
  const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];
  const todayStr = '2026-07-05';

  const cells: (number | null)[] = [];
  for (let i = 0; i < mondayOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const getDateStr = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const closeModal = () => { setSelectedDay(null); setShowRecipePicker(false); };

  const handleAddEntry = (recipeId: string) => {
    if (selectedDay === null) return;
    onChange([...entries, { id: `cal-${Date.now()}`, user_id: 'demo', date: getDateStr(selectedDay), recipe_id: recipeId, status: 'planned', notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
    setShowRecipePicker(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button size="small" onClick={() => setViewMonth((m) => Math.max(0, m - 1))}>‹</Button>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{year}年{viewMonth + 1}月</span>
          <Button size="small" onClick={() => setViewMonth((m) => Math.min(11, m + 1))}>›</Button>
        </div>
      </div>
      <div style={{ padding: '24px 28px', borderRadius: 14, background: 'var(--panel)', border: '1px solid var(--line)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {weekDays.map((w) => <div key={w} style={{ textAlign: 'center', fontWeight: 600, padding: '6px 0', fontSize: 11.5, color: 'var(--tx2)', borderBottom: '1px solid var(--line2)' }}>{w}</div>)}
        </div>
        {[0, 1, 2, 3, 4].map((weekIdx) => (
          <div key={weekIdx} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {[0, 1, 2, 3, 4, 5, 6].map((dow) => {
              const day = cells[weekIdx * 7 + dow];
              if (day === null) return <div key={`e-${weekIdx}-${dow}`} style={{ minHeight: 80, padding: 4, background: 'var(--bg)', borderBottom: '1px solid var(--line2)', borderRight: '1px solid var(--line2)' }} />;
              const dateStr = getDateStr(day);
              const entriesForDay = calMap.get(dateStr) || [];
              const isToday = dateStr === todayStr;
              return (
                <div key={`d-${day}`} onClick={() => setSelectedDay(day)} style={{ minHeight: 80, padding: 4, cursor: 'pointer', borderBottom: '1px solid var(--line2)', borderRight: '1px solid var(--line2)', background: isToday ? 'var(--primary-soft)' : 'var(--panel)' }}>
                  <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--primary)' : 'var(--tx)', marginBottom: 2 }}>{day}</div>
                  {entriesForDay.slice(0, 2).map((e) => {
                    const r = recipeMap.get(e.recipe_id);
                    return <div key={e.id} style={{ fontSize: 10, borderRadius: 4, padding: '1px 4px', marginBottom: 1, background: e.status === 'completed' ? 'var(--success-bg)' : 'transparent', border: e.status === 'planned' ? '1px dashed var(--line)' : 'none', color: e.status === 'completed' ? 'var(--success)' : 'var(--tx2)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{e.status === 'completed' ? '✓' : '◌'} {r?.name || '未知'}</div>;
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <Modal open={selectedDay !== null} onCancel={closeModal} footer={null} title={selectedDay !== null ? `${year}年${month + 1}月${selectedDay}日` : ''}>
        {selectedDay !== null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Button type="dashed" block onClick={() => setShowRecipePicker(true)}>＋ 给这天加一道</Button>
            {showRecipePicker && (
              <Select style={{ width: '100%' }} placeholder="选择菜谱" showSearch optionFilterProp="label" options={recipeList.map((r) => ({ label: r.name, value: r.id }))} onChange={(v) => handleAddEntry(v)} />
            )}
            <Button block onClick={closeModal}>关闭</Button>
          </div>
        )}
      </Modal>
    </div>
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
