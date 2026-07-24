'use client';
import React, { useState, useMemo, Suspense } from 'react';
import {
  Button, message,
  Modal, Select, Input, Divider, Space, Typography,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ShoppingCartOutlined,
} from '@ant-design/icons';
import { useSearchParams } from 'next/navigation';
import type {
  Recipe, CalendarEntry, RecommendedRecipe, ShoppingListItem,
  InventoryCategory, StockLevel, InventoryItem, Utensil, RecipeIngredient,
} from '@/types';
import {
  demoInventory as _demoInventory,
  demoRecipes as _demoRecipes,
  demoRecipeIngredients,
  demoUtensils as _demoUtensils,
  demoCalendarEntries as _demoCalendarEntries,
} from '@/lib/seed/fixtures';
import { tierRecipes } from '@/lib/recommend/tiering';
import { scoreAndSort } from '@/lib/recommend/scoring';
import { TEXT } from '@/lib/constants/text';
import { StatusDot } from '@/components/shared/StatusDot';
import { FilterChips } from '@/components/shared/FilterChips';

const { Text, Title } = Typography;

// ─── CSS animation keyframes (injected via style tag) ───────────────────

const PULSE_KEYFRAMES = `
@keyframes demoPulse {
  0% { opacity: 1; }
  50% { opacity: 0.6; }
  100% { opacity: 1; }
}
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const stockLevelColor: Record<StockLevel, string> = {
  enough: 'green',
  low: 'orange',
  out: 'red',
};

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

const tierColors: Record<string, string> = {
  can_make_now: 'success',
  need_shopping: 'warning',
  clear_stock: 'notice',
};

const TIER_LABELS: Record<string, string> = {
  clear_stock: '清库存',
  can_make_now: '现在能做',
  need_shopping: '缺料可买',
};

// Build recipeIngredients Map for recommend functions
function buildRecipeIngredientsMap(
  ingredients: Record<string, RecipeIngredient[]>
): Map<string, { inventory_id: string; role: string; amount?: string }[]> {
  const map = new Map<string, { inventory_id: string; role: string; amount?: string }[]>();
  for (const [recipeId, ings] of Object.entries(ingredients)) {
    map.set(
      recipeId,
      ings.map((i) => ({ inventory_id: i.inventory_id, role: i.role, amount: i.amount || undefined }))
    );
  }
  return map;
}

// Build recipeUtensils Map (empty for demo - no utensil-recipe mapping in fixtures)
function buildRecipeUtensilsMap(): Map<string, string[]> {
  return new Map();
}

// Check ingredient status for a recipe
function getIngredientStatus(
  recipeId: string,
  ingredients: Record<string, RecipeIngredient[]>,
  inventory: InventoryItem[] = _demoInventory
): { name: string; status: StockLevel; role: string }[] {
  const ings = ingredients[recipeId] || [];
  const invMap = new Map(inventory.map((i) => [i.id, i]));
  return ings.map((ing) => {
    const inv = invMap.get(ing.inventory_id);
    return {
      name: inv?.name || '未知食材',
      status: inv?.stock_level || 'out',
      role: ing.role,
    };
  });
}

function getDaysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Shared: stock level 3-segment control ────────────────────────────────────

const STOCK_SEGMENTS: { key: StockLevel; label: string; bg: string; color: string }[] = [
  { key: 'enough', label: '充足', bg: 'var(--success-bg)', color: 'var(--success)' },
  { key: 'low', label: '不多', bg: 'var(--warn-bg)', color: 'var(--warn)' },
  { key: 'out', label: '没了', bg: 'var(--danger-bg)', color: 'var(--danger)' },
];

function StockLevelSegmented({
  value, onChange, pulse,
}: { value: StockLevel; onChange: (v: StockLevel) => void; pulse?: boolean }) {
  return (
    <div
      style={{
        display: 'inline-flex', borderRadius: 9, overflow: 'hidden',
        border: '1px solid var(--line)',
        animation: pulse ? 'demoPulse .4s ease' : undefined,
      }}
    >
      {STOCK_SEGMENTS.map((seg) => {
        const active = value === seg.key;
        return (
          <span
            key={seg.key}
            onClick={() => onChange(seg.key)}
            style={{
              padding: '3px 10px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
              background: active ? seg.bg : 'transparent',
              color: active ? seg.color : 'var(--tx2)',
              transition: 'background .15s, color .15s',
            }}
          >
            {seg.label}
          </span>
        );
      })}
    </div>
  );
}

// ─── Inventory Section ────────────────────────────────────────────────────────

function InventorySection({
  items, onChange,
}: { items: InventoryItem[]; onChange: (items: InventoryItem[]) => void }) {
  const [activeCat, setActiveCat] = useState<string>('all');
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [pulseId, setPulseId] = useState<string | null>(null);

  const categoryOptions = useMemo(
    () => [{ label: '全部', value: 'all' }, ...categoryKeys.map((k) => ({ label: categoryLabels[k], value: k }))],
    []
  );

  const filteredItems = useMemo(
    () => (activeCat === 'all' ? items : items.filter((i) => i.category === activeCat)),
    [items, activeCat]
  );

  const handleLevelChange = (id: string, level: StockLevel) => {
    onChange(items.map((i) => (i.id === id ? { ...i, stock_level: level } : i)));
    setPulseId(id);
    window.setTimeout(() => setPulseId((cur) => (cur === id ? null : cur)), 400);
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    onChange(items.map((i) => (i.id === editingItem.id ? editingItem : i)));
    setEditingItem(null);
  };

  return (
    <div>
      {/* 分类筛选 */}
      <div style={{ marginBottom: 14 }}>
        <FilterChips
          options={categoryOptions}
          selected={[activeCat]}
          onChange={(vals) => setActiveCat(vals[0] || 'all')}
        />
      </div>

      {/* 表格 */}
      <div
        style={{
          borderRadius: 14, background: 'var(--panel)',
          border: '1px solid var(--line)', overflow: 'hidden',
        }}
      >
        {/* 表头 */}
        <div style={{
          display: 'flex', padding: '10px 14px', gap: 16,
          fontSize: 11.5, fontWeight: 600, color: 'var(--tx2)',
          borderBottom: '1px solid var(--line2)',
        }}>
          <span style={{ width: 130, flexShrink: 0 }}>名称</span>
          <span style={{ width: 'auto', flexShrink: 0 }}>库存档位</span>
          <span style={{ flex: 1 }}>提示</span>
          <span style={{ width: 60, flexShrink: 0, textAlign: 'center' }}>操作</span>
        </div>

        {/* 内容 */}
        <div>
          {filteredItems.map((item) => {
            const days = getDaysSince(item.last_restocked_at);
            let hintText = '';
            let hintColor = 'var(--tx2)';
            if (item.stock_level === 'out') {
              hintText = '已提示到购物清单';
              hintColor = 'var(--warn)';
            } else if (days !== null) {
              const threshold = item.category === 'vegetable' ? 3 : item.category === 'meat' ? 5 : 7;
              if (days >= threshold) {
                hintText = `${days}天前入库 · 建议先吃`;
                hintColor = 'var(--notice)';
              } else {
                hintText = `${days}天前入库`;
              }
            } else {
              hintText = '—';
            }
            return (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', padding: '10px 14px', gap: 16,
                fontSize: 12.5, color: 'var(--tx)',
                borderBottom: '1px solid var(--line2)',
              }}>
                <div style={{ width: 130, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: stockLevelColor[item.stock_level],
                  }} />
                  <span>{item.name}</span>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <StockLevelSegmented
                    value={item.stock_level}
                    pulse={pulseId === item.id}
                    onChange={(level) => handleLevelChange(item.id, level)}
                  />
                </div>
                <div style={{ flex: 1, fontSize: 11, color: hintColor }}>{hintText}</div>
                <div style={{ width: 60, flexShrink: 0, textAlign: 'center' }}>
                  <Button
                    type="text" size="small" icon={<EditOutlined />}
                    onClick={() => setEditingItem(item)}
                    style={{ color: 'var(--tx2)' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 编辑弹窗 */}
      <Modal
        title="编辑食材"
        open={!!editingItem}
        onCancel={() => setEditingItem(null)}
        onOk={handleSaveEdit}
      >
        {editingItem && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Input
              value={editingItem.name}
              onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
              placeholder="名称"
            />
            <Select
              value={editingItem.category}
              onChange={(v) => setEditingItem({ ...editingItem, category: v as InventoryCategory })}
              style={{ width: '100%' }}
              options={categoryKeys.map((k) => ({ label: categoryLabels[k], value: k }))}
            />
            <StockLevelSegmented
              value={editingItem.stock_level}
              onChange={(v) => setEditingItem({ ...editingItem, stock_level: v })}
            />
          </Space>
        )}
      </Modal>
    </div>
  );
}

// ─── Recipes Section ──────────────────────────────────────────────────────────

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
    if (!name) {
      message.warning('请输入菜谱名称');
      return;
    }
    const newRecipe: Recipe = {
      id: `recipe-${Date.now()}`,
      user_id: 'demo',
      name,
      steps: null,
      cook_time_minutes: null,
      difficulty: null,
      attributes: {},
      tips: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    onChange([newRecipe, ...recipes]);
    setNewName('');
    setAddModalOpen(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{TEXT.recipes.title}</Title>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Input.Search
            placeholder="搜索菜谱"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200 }}
            size="small"
          />
        </div>
      </div>

      {/* 瀑布流 */}
      <div style={{ columns: '176px 4', columnGap: 12 }}>
        {/* 新建菜谱卡 — inside the waterfall */}
        <div
          onClick={() => setAddModalOpen(true)}
          style={{
            breakInside: 'avoid', marginBottom: 12, borderRadius: 14,
            border: '1.5px dashed var(--primary)',
            background: 'var(--primary-soft)',
            cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '24px 12px', gap: 6,
          }}
        >
          <PlusOutlined style={{ fontSize: 20, color: 'var(--primary)' }} />
          <span style={{ fontSize: 12.5, color: 'var(--primary)', fontWeight: 600 }}>新建菜谱</span>
        </div>
        {filtered.map((recipe) => {
          const ingStatus = getIngredientStatus(recipe.id, ingredients);
          const allEnough = ingStatus.every((i) => i.status === 'enough');
          const missingCount = ingStatus.filter((i) => i.status !== 'enough').length;
          return (
            <div
              key={recipe.id}
              onClick={() => setSelectedRecipe(recipe)}
              style={{
                breakInside: 'avoid', marginBottom: 12, borderRadius: 14,
                background: 'var(--panel)', border: '1px solid var(--line)',
                overflow: 'hidden', cursor: 'pointer',
                transition: 'transform .15s, box-shadow .15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(60,50,30,.1)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = '';
                (e.currentTarget as HTMLElement).style.boxShadow = '';
              }}
            >
              {/* 图片占位 */}
              <div style={{
                height: 92 + (recipe.id.charCodeAt(recipe.id.length - 1) % 60),
                background: 'linear-gradient(135deg, var(--primary-soft), var(--hover))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: 'var(--tx2)',
              }}>
                成品照
              </div>
              {/* 内容 */}
              <div style={{ padding: '8px 10px 10px' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--tx)', marginBottom: 4 }}>
                  {recipe.name}
                </div>
                {recipe.attributes?.flavor && (
                  <div style={{ fontSize: 11, color: 'var(--tx2)', marginBottom: 6, lineHeight: 1.4 }}>
                    {String(recipe.attributes.flavor)}
                  </div>
                )}
                <Divider style={{ margin: '4px 0' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: allEnough ? 'var(--success)' : missingCount > 0 ? 'var(--danger)' : 'var(--warn)',
                    }} />
                    <span style={{ fontSize: 11, color: 'var(--tx2)' }}>
                      {allEnough ? '食材全齐' : `缺${missingCount}样`}
                    </span>
                  </div>
                  <span style={{ fontSize: 10.5, color: 'var(--tx2)' }}></span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 新建菜谱弹窗 */}
      <Modal
        title="新建菜谱"
        open={addModalOpen}
        onCancel={() => setAddModalOpen(false)}
        onOk={handleAddRecipe}
      >
        <Input
          placeholder="菜谱名称"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onPressEnter={handleAddRecipe}
        />
      </Modal>

      {/* 详情弹窗 */}
      <Modal
        open={!!selectedRecipe}
        onCancel={() => setSelectedRecipe(null)}
        footer={null}
        width={900}
        styles={{ body: { padding: 0, maxHeight: '90vh', overflowY: 'auto', display: 'flex' }, mask: { background: 'rgba(30,20,12,.45)' } }}
      >
        {selectedRecipe && (
          <>
            {/* 左：图片 */}
            <div style={{
              width: '46%', flexShrink: 0,
              background: 'linear-gradient(135deg, var(--primary-soft), var(--hover))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--tx2)', fontSize: 13,
            }}>
              成品照
            </div>
            {/* 右：内容 */}
            <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 19, fontWeight: 700, color: 'var(--tx)' }}>{selectedRecipe.name}</span>
                  {(() => {
                    const ingStatus = getIngredientStatus(selectedRecipe.id, ingredients);
                    const allEnough = ingStatus.every((i) => i.status === 'enough');
                    return (
                      <span style={{
                        fontSize: 10.5, borderRadius: 7, padding: '1px 7px',
                        background: allEnough ? 'var(--success-bg)' : 'var(--warn-bg)',
                        color: allEnough ? 'var(--success)' : 'var(--warn)',
                      }}>
                        {allEnough ? '食材全齐' : '缺料'}
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div style={{ fontSize: 11.5, color: 'var(--tx2)', marginBottom: 12 }}>
                做过 3 次 · 需要：炒锅
              </div>

              {/* 标签 */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 14 }}>
                {selectedRecipe.difficulty && (
                  <span style={{ borderRadius: 7, border: '1px solid var(--line)', padding: '1px 7px', fontSize: 10.5, color: 'var(--tx2)' }}>
                    {difficultyLabel[selectedRecipe.difficulty]}
                  </span>
                )}
                {selectedRecipe.cook_time_minutes && (
                  <span style={{ borderRadius: 7, border: '1px solid var(--line)', padding: '1px 7px', fontSize: 10.5, color: 'var(--tx2)' }}>
                    {selectedRecipe.cook_time_minutes}分
                  </span>
                )}
              </div>

              {/* 食材清单 */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx)', marginBottom: 6 }}>食材</div>
                {(() => {
                  const ings = getIngredientStatus(selectedRecipe.id, ingredients);
                  return ings.map((ing, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: stockLevelColor[ing.status] }} />
                        <span style={{ color: 'var(--tx)' }}>{ing.name}</span>
                        <span style={{ color: 'var(--tx2)', fontSize: 11 }}>
                          {roleLabel[ing.role] || '辅料'}
                        </span>
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 600,
                        color: ing.status === 'enough' ? 'var(--success)' :
                               ing.status === 'low' ? 'var(--warn)' : 'var(--danger)',
                      }}>
                        {ing.status === 'enough' ? '充足' : ing.status === 'low' ? '不多' : '没了'}
                      </span>
                    </div>
                  ));
                })()}
              </div>

              {/* 步骤 */}
              {selectedRecipe.steps && selectedRecipe.steps.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx)', marginBottom: 6 }}>步骤</div>
                  {selectedRecipe.steps.map((s) => (
                    <div key={s.step_number} style={{ display: 'flex', gap: 8, padding: '4px 0' }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                        background: 'var(--primary)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 600, marginTop: 1,
                      }}>
                        {s.step_number}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--tx)', lineHeight: 1.5 }}>{s.description}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tips */}
              {selectedRecipe.tips && (
                <div style={{
                  borderRadius: 10, padding: 10,
                  background: 'var(--primary-soft)', color: 'var(--primary)',
                  fontSize: 12, lineHeight: 1.5, marginBottom: 14,
                }}>
                  💡 {selectedRecipe.tips}
                </div>
              )}

              {/* 底部按钮 */}
              <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--line2)', paddingTop: 12 }}>
                <Button
                  type="primary"
                  style={{ flex: 1 }}
                  onClick={() => message.success(`已把「${selectedRecipe.name}」写入今天的日历`)}
                >
                  今天做它 → 写入日历
                </Button>
                <Button onClick={() => setSelectedRecipe(null)}>✏ 编辑</Button>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

// ─── Recommend Section ────────────────────────────────────────────────────────

const TIME_OPTIONS = [
  { label: '全部', value: '' },
  { label: '≤15分钟', value: '15' },
  { label: '≤30分钟', value: '30' },
];

const SPICY_OPTIONS = [
  { label: '全部', value: '' },
  { label: '不辣', value: '不辣' },
  { label: '微辣', value: '微辣' },
  { label: '中辣', value: '中辣' },
];

function RecommendSection({
  inventory, recipes, ingredients, utensils, calendarEntries,
}: {
  inventory: InventoryItem[];
  recipes: Recipe[];
  ingredients: Record<string, RecipeIngredient[]>;
  utensils: Utensil[];
  calendarEntries: CalendarEntry[];
}) {
  const [selectedRecipes, setSelectedRecipes] = useState<Set<string>>(new Set());
  const [mainIndex, setMainIndex] = useState(0);
  const [shoppingChecked, setShoppingChecked] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<{
    maxCookTime?: number;
    spiciness?: string;
    dietType?: string;
  }>({});

  const recipeIngredientsMap = useMemo(() => buildRecipeIngredientsMap(ingredients), [ingredients]);
  const recipeUtensilsMap = useMemo(() => buildRecipeUtensilsMap(), []);

  const recommended = useMemo(() => {
    const tiered = tierRecipes({
      recipes,
      inventory,
      utensils,
      calendarEntries,
      recipeIngredients: recipeIngredientsMap,
      recipeUtensils: recipeUtensilsMap,
    });
    return scoreAndSort({
      tieredRecipes: tiered,
      calendarEntries,
      inventory,
      recipeIngredients: recipeIngredientsMap,
      userFilters: Object.keys(filters).length > 0 ? filters : undefined,
    });
  }, [recipes, inventory, utensils, calendarEntries, recipeIngredientsMap, recipeUtensilsMap, filters]);

  const mainRecipe = recommended.length > 0
    ? recommended[mainIndex % recommended.length]
    : null;

  // Pick alternative (non-main) recipes for the grid
  const altRecipes = recommended.filter((r) => r.recipe.id !== mainRecipe?.recipe.id).slice(0, 12);

  const toggleRecipeSelect = (id: string) => {
    setSelectedRecipes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Shopping list: from selected recipes missing ingredients + low/out staple/seasoning
  const shoppingList: ShoppingListItem[] = useMemo(() => {
    const invMap = new Map(inventory.map((i) => [i.id, i]));
    const items: ShoppingListItem[] = [];
    const seen = new Set<string>();

    // From selected recipes
    for (const recipeId of selectedRecipes) {
      const ings = ingredients[recipeId] || [];
      const recipe = recipes.find((r) => r.id === recipeId);
      for (const ing of ings) {
        const inv = invMap.get(ing.inventory_id);
        if (!inv || inv.stock_level === 'out' || inv.stock_level === 'low') {
          const key = ing.inventory_id;
          if (!seen.has(key)) {
            seen.add(key);
            items.push({
              name: inv?.name || '未知食材',
              category: inv?.category || 'vegetable',
              source: recipe?.name || '',
              inventoryId: ing.inventory_id,
            });
          }
        }
      }
    }

    // Low/out staples and seasoning
    for (const inv of inventory) {
      if (seen.has(inv.id)) continue;
      if ((inv.category === 'staple' || inv.category === 'seasoning') && inv.stock_level !== 'enough') {
        seen.add(inv.id);
        items.push({
          name: inv.name,
          category: inv.category,
          source: '库存不足',
          inventoryId: inv.id,
        });
      }
    }

    return items;
  }, [selectedRecipes, inventory, ingredients, recipes]);

  const toggleShopping = (key: string) => {
    setShoppingChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {/* 左中：推荐内容 */}
      <div style={{ flex: '1 1 480px', minWidth: 0 }}>
        {/* 头部 */}
        <div style={{ marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>今晚吃什么？</Title>
          <div style={{ fontSize: 11.5, color: 'var(--tx2)', marginTop: 4 }}>
            {inventory.length}种在库食材 · {utensils.length}件厨具 · {recommended.length}道能安排
          </div>
        </div>

        {/* 筛选 chips */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <FilterChips
            options={TIME_OPTIONS}
            selected={filters.maxCookTime ? [filters.maxCookTime.toString()] : []}
            onChange={(vals) => setFilters((f) => ({ ...f, maxCookTime: vals.length > 0 ? Number(vals[0]) : undefined }))}
          />
          <FilterChips
            options={SPICY_OPTIONS}
            selected={filters.spiciness ? [filters.spiciness] : []}
            onChange={(vals) => setFilters((f) => ({ ...f, spiciness: vals.length > 0 ? vals[0] : undefined }))}
          />
        </div>

        {mainRecipe ? (
          <>
            {/* 主推卡 */}
            <div style={{
              width: '100%', maxWidth: 600, margin: '0 auto', borderRadius: 14,
              background: 'var(--panel)', border: '1px solid var(--line)',
              boxShadow: '0 1px 2px rgba(60,50,30,.05), 0 4px 14px rgba(60,50,30,.05)',
              overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', padding: 16, gap: 16 }}>
                {/* 图片 */}
                <div style={{
                  width: 220, height: 180, borderRadius: 10, flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--primary-soft), var(--hover))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--tx2)', fontSize: 11,
                }}>
                  成品照
                </div>
                {/* 信息 */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <StatusDot
                      status={mainRecipe.tier === 'can_make_now' ? 'good' :
                             mainRecipe.tier === 'need_shopping' ? 'warn' : 'notice'}
                    />
                    <span style={{ fontSize: 19, fontWeight: 700, color: 'var(--tx)' }}>
                      {mainRecipe.recipe.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {mainRecipe.recipe.attributes?.method?.map((m) => (
                      <span key={m} style={{
                        display: 'inline-flex', alignItems: 'center', borderRadius: 7,
                        border: '1px solid var(--line)', padding: '1px 7px',
                        fontSize: 10.5, color: 'var(--tx2)',
                      }}>{m}</span>
                    ))}
                    {mainRecipe.recipe.cook_time_minutes && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', borderRadius: 7,
                        border: '1px solid var(--line)', padding: '1px 7px',
                        fontSize: 10.5, color: 'var(--tx2)',
                      }}>{mainRecipe.recipe.cook_time_minutes}分</span>
                    )}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', borderRadius: 7,
                      border: '1px solid var(--line)', padding: '1px 7px',
                      fontSize: 10.5, color: 'var(--tx2)',
                    }}>{mainRecipe.recipe.difficulty ? difficultyLabel[mainRecipe.recipe.difficulty] : ''}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--primary)', fontWeight: 600, marginTop: 4 }}>
                    为什么推荐它：
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {(() => {
                      const reasons: string[] = [];
                      if (mainRecipe.tier === 'clear_stock' && mainRecipe.clearStockIngredients?.length) {
                        reasons.push(`${mainRecipe.clearStockIngredients.join('、')} 已放多天，建议尽快吃`);
                      }
                      if (mainRecipe.missingIngredients?.length && mainRecipe.missingIngredients.length <= 2) {
                        reasons.push(`缺 ${mainRecipe.missingIngredients.join('、')}，买齐就能做`);
                      }
                      if (!mainRecipe.missingIngredients?.length) {
                        reasons.push('所有食材齐全 ✓');
                      }
                      if (mainRecipe.recipe.cook_time_minutes && mainRecipe.recipe.cook_time_minutes <= 15) {
                        reasons.push('快手菜，只需几分钟');
                      }
                      if (reasons.length === 0) reasons.push('推荐做这道 ✨');
                      return reasons.slice(0, 4).map((reason, i) => (
                        <div key={i} style={{ fontSize: 12, color: 'var(--tx)', paddingLeft: 10, position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 0, top: 2, color: 'var(--primary)' }}>·</span>
                          {reason}
                        </div>
                      ));
                    })()}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 8 }}>
                    <Button
                      type="primary"
                      style={{ flex: 1 }}
                      onClick={() => message.success(`已把「${mainRecipe.recipe.name}」写入今天的日历`)}
                    >
                      就做这道
                    </Button>
                    <Button onClick={() => setMainIndex((i) => (i + 1) % recommended.length)}>
                      换一个 ↻
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--tx2)', marginTop: 8 }}>
              按住推荐能做的、缺料的、需清库存的菜优先展示
            </div>

            {/* 备选推荐 */}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)', marginBottom: 10 }}>
                备选推荐
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {altRecipes.map((rec) => {
                  const ingStatus = getIngredientStatus(rec.recipe.id, ingredients, inventory);
                  const missingNames = rec.missingIngredients || [];
                  const isChecked = selectedRecipes.has(rec.recipe.id);
                  let note = '';
                  if (missingNames.length > 0) {
                    note = `缺:${missingNames.slice(0, 2).join('、')}${missingNames.length > 2 ? `+${missingNames.length - 2}` : ''}`;
                  } else if (rec.clearStockIngredients?.length) {
                    note = `${rec.clearStockIngredients.slice(0, 2).join('、')}已放${getDaysSince('2026-07-01') || 3}天，建议先吃`;
                  } else if (rec.recipe.cook_time_minutes && rec.recipe.cook_time_minutes <= 15) {
                    note = `${rec.recipe.cook_time_minutes}分钟快手`;
                  } else if (rec.recipe.cook_time_minutes && rec.recipe.cook_time_minutes >= 40) {
                    note = `要炖${rec.recipe.cook_time_minutes}分钟`;
                  } else {
                    note = ingStatus.every((i) => i.status === 'enough') ? '食材全齐' : '需购买';
                  }
                  return (
                    <div
                      key={rec.recipe.id}
                      style={{
                        width: 212, borderRadius: 14, cursor: 'pointer',
                        background: 'var(--panel)', border: '1px solid var(--line)',
                        padding: 12, transition: 'transform .15s, box-shadow .15s',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(60,50,30,.1)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.transform = '';
                        (e.currentTarget as HTMLElement).style.boxShadow = '';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <StatusDot
                          status={rec.tier === 'can_make_now' ? 'good' :
                                 rec.tier === 'need_shopping' ? 'warn' : 'notice'}
                        />
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)', flex: 1 }}>
                          {rec.recipe.name}
                        </span>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleRecipeSelect(rec.recipe.id)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                        />
                      </div>
                      <div style={{ fontSize: 11, color: ingStatus.every((i) => i.status === 'enough') ? 'var(--success)' : 'var(--tx2)' }}>
                        {note}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--tx2)', textAlign: 'center', padding: '16px 0' }}>
            当前没有可推荐的菜品，试试调整筛选条件
          </div>
        )}
      </div>

      {/* 右侧购物清单 */}
      <div className="shoplist" style={{
        borderRadius: 14,
        background: 'var(--panel)', border: '1px solid var(--line)',
        padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShoppingCartOutlined style={{ color: 'var(--primary)', fontSize: 14 }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>购物清单</span>
          {shoppingList.length > 0 && (
            <span style={{
              fontSize: 11, borderRadius: 7, padding: '0 7px',
              background: 'var(--primary-soft)', color: 'var(--primary)',
            }}>
              {shoppingList.length}
            </span>
          )}
        </div>
        {shoppingList.length === 0 ? (
          <div style={{
            fontSize: 11.5, color: 'var(--tx2)', textAlign: 'center', padding: '24px 0',
          }}>
            勾选缺料的菜<br />要买的东西会出现在这里
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {shoppingList.map((item, i) => {
              const key = item.inventoryId || `${item.name}-${i}`;
              const checked = shoppingChecked.has(key);
              return (
                <div
                  key={key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0',
                    fontSize: 12, color: checked ? 'var(--tx2)' : 'var(--tx)',
                    textDecoration: checked ? 'line-through' : 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleShopping(key)}
                    style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                  />
                  <span style={{ flex: 1 }}>{item.name}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--tx2)' }}>{item.source}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Calendar Section ─────────────────────────────────────────────────────────

function CalendarSection({
  entries, recipes: recipeList, onChange,
}: { entries: CalendarEntry[]; recipes: Recipe[]; onChange: (entries: CalendarEntry[]) => void }) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showRecipePicker, setShowRecipePicker] = useState(false);
  const [viewMonth, setViewMonth] = useState(6); // July, within fixed year 2026

  const year = 2026;
  const month = viewMonth;

  const recipeMap = useMemo(() => new Map(recipeList.map((r) => [r.id, r])), [recipeList]);

  const calMap = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of entries) {
      const existing = map.get(entry.date) || [];
      existing.push(entry);
      map.set(entry.date, existing);
    }
    return map;
  }, [entries, year, month]);

  // Monday-first calendar
  const firstDay = new Date(year, month, 1).getDay();
  const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];
  const todayStr = '2026-07-05';

  const cells: (number | null)[] = [];
  for (let i = 0; i < mondayOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const getDateStr = (day: number) => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  const closeModal = () => {
    setSelectedDay(null);
    setShowRecipePicker(false);
  };

  const handleMarkComplete = (entryId: string) => {
    onChange(entries.map((e) => (e.id === entryId ? { ...e, status: 'completed' as const } : e)));
  };

  const handleCancelPlan = (entryId: string) => {
    onChange(entries.filter((e) => e.id !== entryId));
  };

  const handleAddEntry = (recipeId: string) => {
    if (selectedDay === null) return;
    const newEntry: CalendarEntry = {
      id: `cal-${Date.now()}`,
      user_id: 'demo',
      date: getDateStr(selectedDay),
      recipe_id: recipeId,
      status: 'planned',
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    onChange([...entries, newEntry]);
    setShowRecipePicker(false);
  };

  return (
    <div>
      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button size="small" onClick={() => setViewMonth((m) => Math.max(0, m - 1))}>‹</Button>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx)' }}>
            {year}年{viewMonth + 1}月
          </span>
          <Button size="small" onClick={() => setViewMonth((m) => Math.min(11, m + 1))}>›</Button>
          <Button size="small" type="text" style={{ fontSize: 12, color: 'var(--primary)' }} onClick={() => setViewMonth(6)}>今天</Button>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--tx2)' }}>
          {entries.filter((e) => e.status === 'completed').length}道完成 · {entries.filter((e) => e.status === 'planned').length}道计划中
        </div>
      </div>

      {/* 月视图 */}
      <div style={{
        borderRadius: 14, background: 'var(--panel)',
        border: '1px solid var(--line)', overflow: 'hidden',
      }}>
        {/* 表头 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {weekDays.map((w) => (
            <div key={w} style={{
              textAlign: 'center', fontWeight: 600, padding: '6px 0',
              fontSize: 11.5, color: 'var(--tx2)',
              borderBottom: '1px solid var(--line2)',
            }}>
              {w}
            </div>
          ))}
        </div>
        {/* 格子 */}
        {[0, 1, 2, 3, 4].map((weekIdx) => (
          <div key={weekIdx} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {[0, 1, 2, 3, 4, 5, 6].map((dow) => {
              const cellIdx = weekIdx * 7 + dow;
              const day = cells[cellIdx];
              if (day === null) {
                return (
                  <div key={`empty-${weekIdx}-${dow}`} style={{
                    minHeight: 80, padding: 4,
                    background: 'var(--bg)', borderBottom: '1px solid var(--line2)',
                    borderRight: '1px solid var(--line2)',
                  }} />
                );
              }
              const dateStr = getDateStr(day);
              const entriesForDay = calMap.get(dateStr) || [];
              const isToday = dateStr === todayStr;
              const isSelected = selectedDay === day;
              return (
                <div
                  key={`day-${day}`}
                  onClick={() => setSelectedDay(day)}
                  style={{
                    minHeight: 80, padding: 4, cursor: 'pointer',
                    borderBottom: '1px solid var(--line2)',
                    borderRight: '1px solid var(--line2)',
                    background: isToday ? 'var(--primary-soft)' : isSelected ? 'var(--hover)' : 'var(--panel)',
                    outline: (isToday || isSelected) ? '1.5px solid var(--primary)' : undefined,
                    outlineOffset: -1,
                    transition: 'transform .12s, box-shadow .12s, background .12s',
                  }}
                  onMouseEnter={(e) => {
                    const t = e.currentTarget;
                    if (!isToday && !isSelected) t.style.background = 'var(--hover)';
                    t.style.transform = 'scale(1.05)';
                    t.style.boxShadow = '0 4px 14px rgba(60,50,30,.12)';
                    t.style.zIndex = '1';
                    t.style.position = 'relative';
                  }}
                  onMouseLeave={(e) => {
                    const t = e.currentTarget;
                    if (!isToday && !isSelected) t.style.background = 'var(--panel)';
                    t.style.transform = '';
                    t.style.boxShadow = '';
                  }}
                >
                  <div style={{
                    fontSize: 11, fontWeight: isToday ? 700 : 400,
                    color: isToday ? 'var(--primary)' : 'var(--tx)',
                    marginBottom: 2,
                  }}>{day}</div>
                  {entriesForDay.slice(0, 2).map((entry) => {
                    const recipe = recipeMap.get(entry.recipe_id);
                    return (
                      <div
                        key={entry.id}
                        style={{
                          fontSize: 10, borderRadius: 4, padding: '1px 4px', marginBottom: 1,
                          background: entry.status === 'completed' ? 'var(--success-bg)' : 'transparent',
                          border: entry.status === 'planned' ? '1px dashed var(--line)' : 'none',
                          color: entry.status === 'completed' ? 'var(--success)' : 'var(--tx2)',
                          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                        }}
                      >
                        {entry.status === 'completed' ? '✓' : '◌'} {recipe?.name || '未知'}
                      </div>
                    );
                  })}
                  {entriesForDay.length > 2 && (
                    <div style={{ fontSize: 9, color: 'var(--tx2)' }}>+{entriesForDay.length - 2}</div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* 日期详情弹窗 */}
      <Modal
        open={selectedDay !== null}
        onCancel={closeModal}
        footer={null}
        title={selectedDay !== null ? `${year}年${month + 1}月${selectedDay}日` : ''}
      >
        {selectedDay !== null && (() => {
          const dateStr = getDateStr(selectedDay);
          const dayEntries = calMap.get(dateStr) || [];
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dayEntries.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--tx2)', textAlign: 'center', padding: '12px 0' }}>
                  这天没有安排
                </div>
              ) : dayEntries.map((entry) => {
                const recipe = recipeMap.get(entry.recipe_id);
                return (
                  <div key={entry.id} style={{
                    borderRadius: 10, padding: 10,
                    background: entry.status === 'completed' ? 'var(--success-bg)' : 'var(--bg)',
                    border: entry.status === 'planned' ? '1px dashed var(--line)' : 'none',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>
                        {recipe?.name || '未知'}
                      </span>
                      <span style={{
                        fontSize: 10.5, borderRadius: 7, padding: '1px 7px',
                        background: entry.status === 'completed' ? 'var(--success-bg)' : 'transparent',
                        color: entry.status === 'completed' ? 'var(--success)' : 'var(--tx2)',
                        border: entry.status === 'planned' ? '1px solid var(--line)' : 'none',
                      }}>
                        {entry.status === 'completed' ? '已完成' : '计划中'}
                      </span>
                    </div>
                    {entry.status === 'planned' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Button size="small" type="primary" style={{ flex: 1, fontSize: 11 }} onClick={() => handleMarkComplete(entry.id)}>
                          标记完成
                        </Button>
                        <Button size="small" style={{ fontSize: 11 }} onClick={() => handleCancelPlan(entry.id)}>
                          取消计划
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}

              {showRecipePicker ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="选择菜谱"
                    showSearch
                    optionFilterProp="label"
                    options={recipeList.map((r) => ({ label: r.name, value: r.id }))}
                    onChange={(v) => handleAddEntry(v)}
                  />
                  <Button size="small" onClick={() => setShowRecipePicker(false)}>取消</Button>
                </div>
              ) : (
                <Button type="dashed" block style={{ fontSize: 12 }} onClick={() => setShowRecipePicker(true)}>
                  ＋ 给这天加一道
                </Button>
              )}

              <Button block onClick={closeModal}>关闭</Button>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

// ─── Utensils Section ─────────────────────────────────────────────────────────

function UtensilsSection({
  items, onChange,
}: { items: Utensil[]; onChange: (items: Utensil[]) => void }) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNote, setNewNote] = useState('');
  const [editingUtensil, setEditingUtensil] = useState<Utensil | null>(null);

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) {
      message.warning('请输入厨具名称');
      return;
    }
    const utensil: Utensil = {
      id: `utensil-${Date.now()}`,
      user_id: 'demo',
      name,
      note: newNote.trim() || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    onChange([...items, utensil]);
    setNewName('');
    setNewNote('');
    setAddModalOpen(false);
  };

  const handleSaveEdit = () => {
    if (!editingUtensil) return;
    onChange(items.map((u) => (u.id === editingUtensil.id ? editingUtensil : u)));
    setEditingUtensil(null);
  };

  const handleDelete = (id: string) => {
    onChange(items.filter((u) => u.id !== id));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{TEXT.utensils.title}</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)}>
          {TEXT.utensils.addUtensil}
        </Button>
      </div>
      <div style={{ maxWidth: 640 }}>
        {items.map((utensil) => (
          <div
            key={utensil.id}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', borderRadius: 14,
              background: 'var(--panel)', border: '1px solid var(--line)',
              marginBottom: 8,
            }}
          >
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx)' }}>{utensil.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--tx2)', marginTop: 2 }}>{utensil.note || '—'}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 10.5, borderRadius: 7, padding: '1px 7px',
                background: 'var(--primary-soft)', color: 'var(--primary)',
              }}>
                {0}道菜在用
              </span>
              <Button type="text" size="small" icon={<EditOutlined />} onClick={() => setEditingUtensil(utensil)}
                style={{ color: 'var(--tx2)' }} />
              <Button type="text" size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(utensil.id)}
                style={{ color: 'var(--danger)' }} />
            </div>
          </div>
        ))}
      </div>

      {/* 新建厨具弹窗 */}
      <Modal title="添加厨具" open={addModalOpen} onCancel={() => setAddModalOpen(false)} onOk={handleAdd}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Input placeholder="名称" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Input placeholder="备注（可选）" value={newNote} onChange={(e) => setNewNote(e.target.value)} />
        </Space>
      </Modal>

      {/* 编辑厨具弹窗 */}
      <Modal title="编辑厨具" open={!!editingUtensil} onCancel={() => setEditingUtensil(null)} onOk={handleSaveEdit}>
        {editingUtensil && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Input
              value={editingUtensil.name}
              onChange={(e) => setEditingUtensil({ ...editingUtensil, name: e.target.value })}
              placeholder="名称"
            />
            <Input
              value={editingUtensil.note || ''}
              onChange={(e) => setEditingUtensil({ ...editingUtensil, note: e.target.value })}
              placeholder="备注（可选）"
            />
          </Space>
        )}
      </Modal>
    </div>
  );
}

// ─── Main Page (wrapped in Suspense for useSearchParams) ─────────────────────

function DemoPageContent() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'recommend';

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([..._demoInventory]);
  const [recipes, setRecipes] = useState<Recipe[]>([..._demoRecipes]);
  const [utensils, setUtensils] = useState<Utensil[]>([..._demoUtensils]);
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([..._demoCalendarEntries]);

  const sections: Record<string, React.ReactNode> = {
    recommend: (
      <RecommendSection
        inventory={inventoryItems} recipes={recipes} ingredients={demoRecipeIngredients}
        utensils={utensils} calendarEntries={calendarEntries}
      />
    ),
    inventory: <InventorySection items={inventoryItems} onChange={setInventoryItems} />,
    utensils: <UtensilsSection items={utensils} onChange={setUtensils} />,
    recipes: <RecipesSection recipes={recipes} ingredients={demoRecipeIngredients} onChange={setRecipes} />,
    calendar: <CalendarSection entries={calendarEntries} recipes={recipes} onChange={setCalendarEntries} />,
  };

  return (
    <div style={{ marginTop: 16 }}>
      <style>{PULSE_KEYFRAMES}</style>
      {sections[defaultTab] || sections.recommend}
    </div>
  );
}

export default function DemoPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: 48 }}>{TEXT.common.loading}</div>}>
      <DemoPageContent />
    </Suspense>
  );
}
