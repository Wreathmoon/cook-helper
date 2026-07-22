'use client';
import React, { useState, useMemo, Suspense } from 'react';
import {
  Tabs, Alert, Tag, Button, Card, Row, Col, Table, Tooltip, message,
  Modal, Descriptions, Steps, Select, Checkbox, List, Badge, Space, Typography, Divider,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ShoppingCartOutlined,
  CheckCircleOutlined, ClockCircleOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import { useSearchParams } from 'next/navigation';
import type { Recipe, CalendarEntry, RecommendedRecipe, InventoryCategory, StockLevel } from '@/types';
import {
  demoInventory, demoRecipes, demoRecipeIngredients, demoUtensils, demoCalendarEntries,
} from '@/lib/seed/fixtures';
import { tierRecipes } from '@/lib/recommend/tiering';
import { scoreAndSort } from '@/lib/recommend/scoring';
import { TEXT } from '@/lib/constants/text';

const { Text, Title } = Typography;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEMO_WARNING = 'Demo 模式下不可写入，请登录后操作';

function showDemoWarning() {
  message.warning(DEMO_WARNING);
}

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

// Build recipeIngredients Map for recommend functions
function buildRecipeIngredientsMap(): Map<string, { inventory_id: string; role: string; amount?: string }[]> {
  const map = new Map<string, { inventory_id: string; role: string; amount?: string }[]>();
  for (const [recipeId, ings] of Object.entries(demoRecipeIngredients)) {
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
function getIngredientStatus(recipeId: string): { name: string; status: StockLevel; role: string }[] {
  const ings = demoRecipeIngredients[recipeId] || [];
  const invMap = new Map(demoInventory.map((i) => [i.id, i]));
  return ings.map((ing) => {
    const inv = invMap.get(ing.inventory_id);
    return {
      name: inv?.name || '未知食材',
      status: inv?.stock_level || 'out',
      role: ing.role,
    };
  });
}

// ─── Inventory Section ────────────────────────────────────────────────────────

function InventorySection() {
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filtered = activeCategory === 'all'
    ? demoInventory
    : demoInventory.filter((i) => i.category === activeCategory);

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '分类', dataIndex: 'category', key: 'category',
      render: (cat: InventoryCategory) => categoryLabels[cat],
    },
    {
      title: '库存', dataIndex: 'stock_level', key: 'stock_level',
      render: (level: StockLevel) => (
        <Tag color={stockLevelColor[level]}>{TEXT.inventory.stockLevel[level]}</Tag>
      ),
    },
    { title: '单位', dataIndex: 'unit', key: 'unit', render: (v: string | null) => v || '-' },
    {
      title: '操作', key: 'actions', width: 200,
      render: () => (
        <Space>
          <Tooltip title={TEXT.common.demoMode}>
            <Button icon={<EditOutlined />} disabled size="small">{TEXT.common.edit}</Button>
          </Tooltip>
          <Tooltip title={TEXT.common.demoMode}>
            <Button icon={<DeleteOutlined />} danger disabled size="small">{TEXT.common.delete}</Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{TEXT.inventory.title}</Title>
        <Tooltip title={TEXT.common.demoMode}>
          <Button type="primary" icon={<PlusOutlined />} disabled onClick={showDemoWarning}>
            {TEXT.inventory.addIngredient}
          </Button>
        </Tooltip>
      </div>
      <Tabs
        activeKey={activeCategory}
        onChange={setActiveCategory}
        items={[
          { key: 'all', label: '全部' },
          ...categoryKeys.map((k) => ({ key: k, label: categoryLabels[k] })),
        ]}
      />
      <Table
        dataSource={filtered}
        columns={columns}
        rowKey="id"
        pagination={false}
        size="middle"
      />
    </div>
  );
}

// ─── Recipes Section ──────────────────────────────────────────────────────────

function RecipesSection() {
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{TEXT.recipes.title}</Title>
        <Tooltip title={TEXT.common.demoMode}>
          <Button type="primary" icon={<PlusOutlined />} disabled onClick={showDemoWarning}>
            {TEXT.recipes.addRecipe}
          </Button>
        </Tooltip>
      </div>
      <Row gutter={[16, 16]}>
        {demoRecipes.map((recipe) => {
          const ingStatus = getIngredientStatus(recipe.id);
          const allEnough = ingStatus.every((i) => i.status === 'enough');
          const hasOut = ingStatus.some((i) => i.status === 'out');
          return (
            <Col key={recipe.id} xs={24} sm={12} lg={8} xl={6}>
              <Card
                hoverable
                title={recipe.name}
                extra={
                  <Badge
                    status={allEnough ? 'success' : hasOut ? 'error' : 'warning'}
                    text={allEnough ? '食材齐全' : hasOut ? '缺少食材' : '部分不足'}
                  />
                }
                onClick={() => setSelectedRecipe(recipe)}
                actions={[
                  <Tooltip title={TEXT.common.demoMode} key="edit">
                    <Button type="link" disabled icon={<EditOutlined />} onClick={showDemoWarning} />
                  </Tooltip>,
                  <Tooltip title={TEXT.common.demoMode} key="del">
                    <Button type="link" danger disabled icon={<DeleteOutlined />} onClick={showDemoWarning} />
                  </Tooltip>,
                ]}
              >
                <div style={{ marginBottom: 8 }}>
                  {recipe.difficulty && (
                    <Tag>{difficultyLabel[recipe.difficulty] || recipe.difficulty}</Tag>
                  )}
                  {recipe.cook_time_minutes && (
                    <Tag icon={<ClockCircleOutlined />}>{recipe.cook_time_minutes}分钟</Tag>
                  )}
                  {recipe.attributes?.method?.map((m) => <Tag key={m} color="blue">{m}</Tag>)}
                </div>
                <div style={{ fontSize: 12, color: '#999' }}>
                  {ingStatus.slice(0, 4).map((ing, idx) => (
                    <Tag
                      key={idx}
                      color={stockLevelColor[ing.status]}
                      style={{ marginBottom: 4 }}
                    >
                      {ing.name}
                    </Tag>
                  ))}
                  {ingStatus.length > 4 && <Text type="secondary"> +{ingStatus.length - 4}</Text>}
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      <Modal
        title={selectedRecipe?.name}
        open={!!selectedRecipe}
        onCancel={() => setSelectedRecipe(null)}
        footer={null}
        width={640}
      >
        {selectedRecipe && (
          <div>
            <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
              {selectedRecipe.difficulty && (
                <Descriptions.Item label={TEXT.recipes.difficulty}>
                  {difficultyLabel[selectedRecipe.difficulty]}
                </Descriptions.Item>
              )}
              {selectedRecipe.cook_time_minutes && (
                <Descriptions.Item label={TEXT.recipes.cookTime}>
                  {selectedRecipe.cook_time_minutes} 分钟
                </Descriptions.Item>
              )}
              {selectedRecipe.attributes?.spiciness && (
                <Descriptions.Item label={TEXT.recipes.attributes.spiciness}>
                  {selectedRecipe.attributes.spiciness}
                </Descriptions.Item>
              )}
              {selectedRecipe.attributes?.diet_type && (
                <Descriptions.Item label={TEXT.recipes.attributes.dietType}>
                  {selectedRecipe.attributes.diet_type}
                </Descriptions.Item>
              )}
              {selectedRecipe.attributes?.cuisine && (
                <Descriptions.Item label={TEXT.recipes.attributes.cuisine}>
                  {selectedRecipe.attributes.cuisine}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Divider orientation="left" style={{ marginTop: 0 }}>{TEXT.recipes.ingredients}</Divider>
            {(() => {
              const ings = getIngredientStatus(selectedRecipe.id);
              const grouped = { main: ings.filter(i => i.role === 'main'), auxiliary: ings.filter(i => i.role === 'auxiliary'), seasoning: ings.filter(i => i.role === 'seasoning') };
              return (
                <div>
                  {(['main', 'auxiliary', 'seasoning'] as const).map(role => {
                    const items = grouped[role];
                    if (items.length === 0) return null;
                    return (
                      <div key={role} style={{ marginBottom: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>{roleLabel[role]}：</Text>
                        {items.map((ing, idx) => (
                          <Tag key={idx} color={stockLevelColor[ing.status]} style={{ marginBottom: 4 }}>
                            {ing.name}
                          </Tag>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {selectedRecipe.steps && selectedRecipe.steps.length > 0 && (
              <>
                <Divider orientation="left">{TEXT.recipes.steps}</Divider>
                <Steps
                  direction="vertical"
                  size="small"
                  items={selectedRecipe.steps.map((s) => ({
                    title: `步骤 ${s.step_number}`,
                    description: s.description,
                  }))}
                />
              </>
            )}

            {selectedRecipe.tips && (
              <>
                <Divider orientation="left">{TEXT.recipes.tips}</Divider>
                <Text>{selectedRecipe.tips}</Text>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Recommend Section ────────────────────────────────────────────────────────

function RecommendSection() {
  const [selectedRecipes, setSelectedRecipes] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<{
    maxCookTime?: number;
    spiciness?: string;
    dietType?: string;
  }>({});

  const recipeIngredientsMap = useMemo(() => buildRecipeIngredientsMap(), []);
  const recipeUtensilsMap = useMemo(() => buildRecipeUtensilsMap(), []);

  const recommended = useMemo(() => {
    const tiered = tierRecipes({
      recipes: demoRecipes,
      inventory: demoInventory,
      utensils: demoUtensils,
      calendarEntries: demoCalendarEntries,
      recipeIngredients: recipeIngredientsMap,
      recipeUtensils: recipeUtensilsMap,
    });

    return scoreAndSort({
      tieredRecipes: tiered,
      calendarEntries: demoCalendarEntries,
      inventory: demoInventory,
      recipeIngredients: recipeIngredientsMap,
      userFilters: Object.keys(filters).length > 0 ? filters : undefined,
    });
  }, [recipeIngredientsMap, recipeUtensilsMap, filters]);

  // Shopping list calculation
  const shoppingList = useMemo(() => {
    if (selectedRecipes.size === 0) return [];
    const invMap = new Map(demoInventory.map((i) => [i.id, i]));
    const items: { name: string; category: InventoryCategory; source: string }[] = [];
    const seen = new Set<string>();

    for (const recipeId of selectedRecipes) {
      const ings = demoRecipeIngredients[recipeId] || [];
      const recipe = demoRecipes.find((r) => r.id === recipeId);
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
            });
          }
        }
      }
    }
    return items;
  }, [selectedRecipes]);

  const tiered = useMemo(() => {
    const groups: Record<string, RecommendedRecipe[]> = {
      can_make_now: [],
      need_shopping: [],
      clear_stock: [],
    };
    for (const r of recommended) {
      groups[r.tier]?.push(r);
    }
    return groups;
  }, [recommended]);

  const toggleRecipeSelect = (id: string) => {
    setSelectedRecipes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const tierColors: Record<string, string> = {
    can_make_now: 'green',
    need_shopping: 'orange',
    clear_stock: 'blue',
  };

  return (
    <div>
      <Title level={4}>{TEXT.recommend.title}</Title>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Text type="secondary">{TEXT.recommend.filters}：</Text>
          <Select
            placeholder="辣度"
            allowClear
            style={{ width: 120 }}
            onChange={(v) => setFilters((f) => ({ ...f, spiciness: v }))}
            options={[
              { value: '不辣', label: '不辣' },
              { value: '微辣', label: '微辣' },
              { value: '中辣', label: '中辣' },
            ]}
          />
          <Select
            placeholder="荤素"
            allowClear
            style={{ width: 120 }}
            onChange={(v) => setFilters((f) => ({ ...f, dietType: v }))}
            options={[
              { value: '纯荤', label: '纯荤' },
              { value: '荤素搭配', label: '荤素搭配' },
              { value: '纯素', label: '纯素' },
            ]}
          />
          <Select
            placeholder="烹饪时间"
            allowClear
            style={{ width: 140 }}
            onChange={(v) => setFilters((f) => ({ ...f, maxCookTime: v }))}
            options={[
              { value: 15, label: '15分钟内' },
              { value: 30, label: '30分钟内' },
              { value: 60, label: '1小时内' },
            ]}
          />
        </Space>
      </Card>

      {/* Tiered recommendations */}
      {(['can_make_now', 'clear_stock', 'need_shopping'] as const).map((tier) => {
        const items = tiered[tier];
        if (!items || items.length === 0) return null;
        return (
          <div key={tier} style={{ marginBottom: 24 }}>
            <Title level={5}>
              <Tag color={tierColors[tier]}>{TEXT.recommend.tiers[tier]}</Tag>
            </Title>
            <Row gutter={[12, 12]}>
              {items.map((rec) => (
                <Col key={rec.recipe.id} xs={24} sm={12} lg={8}>
                  <Card
                    size="small"
                    title={
                      <Space>
                        <Checkbox
                          checked={selectedRecipes.has(rec.recipe.id)}
                          onChange={() => toggleRecipeSelect(rec.recipe.id)}
                        />
                        <span>{rec.recipe.name}</span>
                      </Space>
                    }
                    extra={
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        评分: {rec.score.toFixed(2)}
                      </Text>
                    }
                  >
                    {rec.missingIngredients && (
                      <div style={{ marginBottom: 4 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>缺少：</Text>
                        {rec.missingIngredients.map((m, i) => (
                          <Tag key={i} color="red" style={{ fontSize: 11 }}>{m}</Tag>
                        ))}
                      </div>
                    )}
                    {rec.clearStockIngredients && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>可清库存：</Text>
                        {rec.clearStockIngredients.map((m, i) => (
                          <Tag key={i} color="blue" style={{ fontSize: 11 }}>{m}</Tag>
                        ))}
                      </div>
                    )}
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        );
      })}

      {recommended.length === 0 && (
        <Alert message="当前没有可推荐的菜品，试试调整筛选条件" type="info" showIcon />
      )}

      {/* Shopping list */}
      {selectedRecipes.size > 0 && (
        <Card
          title={
            <Space>
              <ShoppingCartOutlined />
              <span>{TEXT.recommend.shoppingList}</span>
              <Badge count={shoppingList.length} />
            </Space>
          }
          style={{ marginTop: 16 }}
          extra={
            <Tooltip title={TEXT.common.demoMode}>
              <Button type="primary" disabled onClick={showDemoWarning}>
                {TEXT.recommend.checkout}
              </Button>
            </Tooltip>
          }
        >
          {shoppingList.length > 0 ? (
            <List
              size="small"
              dataSource={shoppingList}
              renderItem={(item) => (
                <List.Item>
                  <Space>
                    <Tag>{categoryLabels[item.category]}</Tag>
                    <Text>{item.name}</Text>
                    <Text type="secondary">（来自: {item.source}）</Text>
                  </Space>
                </List.Item>
              )}
            />
          ) : (
            <Alert message="所选菜品的食材都已齐全！" type="success" showIcon />
          )}
        </Card>
      )}
    </div>
  );
}

// ─── Calendar Section ─────────────────────────────────────────────────────────

function CalendarSection() {
  const [currentDate] = useState(new Date(2026, 6, 1)); // July 2026

  const recipeMap = useMemo(() => new Map(demoRecipes.map((r) => [r.id, r])), []);

  // Build calendar date map
  const calMap = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of demoCalendarEntries) {
      const existing = map.get(entry.date) || [];
      existing.push(entry);
      map.set(entry.date, existing);
    }
    return map;
  }, []);

  // Generate calendar grid
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const getDateStr = (day: number) => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{TEXT.calendar.title}</Title>
        <Space>
          <Tooltip title={TEXT.common.demoMode}>
            <Button icon={<PlusOutlined />} disabled onClick={showDemoWarning}>
              {TEXT.calendar.addEntry}
            </Button>
          </Tooltip>
        </Space>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <Title level={5}>{year}年{month + 1}月</Title>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {weekDays.map((w) => (
          <div key={w} style={{ textAlign: 'center', fontWeight: 'bold', padding: 8, background: '#fafafa' }}>
            {w}
          </div>
        ))}
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} style={{ minHeight: 80, padding: 4, background: '#fafafa' }} />;
          }
          const dateStr = getDateStr(day);
          const entries = calMap.get(dateStr) || [];
          const isToday = dateStr === '2026-07-05';
          return (
            <div
              key={`day-${day}`}
              style={{
                minHeight: 80,
                padding: 4,
                border: '1px solid #f0f0f0',
                background: isToday ? '#e6f7ff' : undefined,
              }}
            >
              <div style={{ fontWeight: isToday ? 'bold' : undefined, color: isToday ? '#1890ff' : undefined }}>
                {day}
              </div>
              {entries.map((entry) => {
                const recipe = recipeMap.get(entry.recipe_id);
                return (
                  <div key={entry.id} style={{ marginTop: 2 }}>
                    <Tag
                      color={entry.status === 'completed' ? 'green' : 'blue'}
                      style={{ fontSize: 11, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {entry.status === 'completed' && <CheckCircleOutlined />}
                      {entry.status === 'planned' && <ClockCircleOutlined />}
                      {' '}{recipe?.name || '未知'}
                    </Tag>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ marginTop: 16 }}>
        <Space>
          <Tag color="green"><CheckCircleOutlined /> 已完成</Tag>
          <Tag color="blue"><ClockCircleOutlined /> 计划中</Tag>
          <Tag style={{ background: '#e6f7ff', borderColor: '#91d5ff' }}>今天</Tag>
        </Space>
      </div>
    </div>
  );
}

// ─── Utensils Section ─────────────────────────────────────────────────────────

function UtensilsSection() {
  const columns = [
    { title: TEXT.utensils.name, dataIndex: 'name', key: 'name' },
    { title: TEXT.utensils.note, dataIndex: 'note', key: 'note', render: (v: string | null) => v || '-' },
    {
      title: '操作', key: 'actions', width: 200,
      render: () => (
        <Space>
          <Tooltip title={TEXT.common.demoMode}>
            <Button icon={<EditOutlined />} disabled size="small">{TEXT.common.edit}</Button>
          </Tooltip>
          <Tooltip title={TEXT.common.demoMode}>
            <Button icon={<DeleteOutlined />} danger disabled size="small">{TEXT.common.delete}</Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{TEXT.utensils.title}</Title>
        <Tooltip title={TEXT.common.demoMode}>
          <Button type="primary" icon={<PlusOutlined />} disabled onClick={showDemoWarning}>
            {TEXT.utensils.addUtensil}
          </Button>
        </Tooltip>
      </div>
      <Table dataSource={demoUtensils} columns={columns} rowKey="id" pagination={false} size="middle" />
    </div>
  );
}

// ─── Main Page (wrapped in Suspense for useSearchParams) ──────────────────────

function DemoPageContent() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'recommend';

  const tabItems = [
    { key: 'recommend', label: TEXT.nav.recommend, children: <RecommendSection /> },
    { key: 'inventory', label: TEXT.nav.inventory, children: <InventorySection /> },
    { key: 'utensils', label: TEXT.nav.utensils, children: <UtensilsSection /> },
    { key: 'recipes', label: TEXT.nav.recipes, children: <RecipesSection /> },
    { key: 'calendar', label: TEXT.nav.calendar, children: <CalendarSection /> },
  ];

  return (
    <div>
      <Alert
        message={TEXT.demo.title}
        description={`${TEXT.demo.description} 登录后可管理自己的数据。`}
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ marginBottom: 24 }}
      />
      <Tabs defaultActiveKey={defaultTab} items={tabItems} size="large" />
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
