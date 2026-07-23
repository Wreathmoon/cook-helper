'use client';

import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { getRecommendations, generateShoppingListAction, checkoutShoppingListAction } from '@/app/actions/recommend';
import { addCalendarEntryAction } from '@/app/actions/calendar';
import type { RecommendedRecipe, ShoppingListItem } from '@/types';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusDot } from '@/components/shared/StatusDot';
import { FilterChips } from '@/components/shared/FilterChips';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { RecipeDetailModal } from '@/components/shared/RecipeDetailModal';

// ─── 常量 ────────────────────────────────────────────────────────────────────────

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

// ─── 局部组件 ────────────────────────────────────────────────────────────────────

function MainCard({
  recipe,
  onCook,
  onRefresh,
}: {
  recipe: RecommendedRecipe | null;
  onCook: (r: RecommendedRecipe) => void;
  onRefresh: () => void;
}) {
  if (!recipe) return null;
  const r = recipe.recipe;
  const tierLabels: Record<string, string> = {
    clear_stock: '清库存',
    can_make_now: '现在能做',
    need_shopping: '缺料可买',
  };

  const reasons: string[] = [];
  if (recipe.tier === 'clear_stock' && recipe.clearStockIngredients?.length) {
    reasons.push(`${recipe.clearStockIngredients.join('、')} 已放多天，建议尽快吃`);
  }
  if (recipe.missingIngredients?.length && recipe.missingIngredients.length <= 2) {
    reasons.push(`缺 ${recipe.missingIngredients.join('、')}，买齐就能做`);
  }
  if (!recipe.missingIngredients?.length) {
    reasons.push('所有食材齐全 ✓');
  }
  if (r.cook_time_minutes && r.cook_time_minutes <= 15) {
    reasons.push('快手菜，只需 N 分钟');
  }
  if (reasons.length === 0) {
    reasons.push('推荐做这道 ✨');
  }

  return (
    <div
      style={{
        width: 600,
        margin: '0 auto',
        borderRadius: 14,
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', padding: 16, gap: 16 }}>
        {/* 图片占位 */}
        <div
          style={{
            width: 220,
            height: 180,
            borderRadius: 10,
            flexShrink: 0,
            background: 'linear-gradient(135deg, var(--primary-soft), var(--hover))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--tx2)',
            fontSize: 11,
          }}
        >
          成品照
        </div>

        {/* 右侧信息 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusDot status={recipe.tier === 'can_make_now' ? 'good' : recipe.tier === 'need_shopping' ? 'warn' : 'notice'} />
            <span style={{ fontSize: 19, fontWeight: 700, color: 'var(--tx)' }}>{r.name}</span>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {r.attributes?.method?.map((m) => (
              <span key={m} style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 7, border: '1px solid var(--line)', padding: '1px 7px', fontSize: 10.5, color: 'var(--tx2)' }}>{m}</span>
            ))}
            {r.cook_time_minutes && (
              <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 7, border: '1px solid var(--line)', padding: '1px 7px', fontSize: 10.5, color: 'var(--tx2)' }}>{r.cook_time_minutes}分</span>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 7, border: '1px solid var(--line)', padding: '1px 7px', fontSize: 10.5, color: 'var(--tx2)' }}>{tierLabels[recipe.tier] || ''}</span>
          </div>

          <div style={{ fontSize: 11.5, color: 'var(--primary)', fontWeight: 600, marginTop: 4 }}>为什么推荐它：</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {reasons.slice(0, 4).map((reason, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--tx)', paddingLeft: 10, position: 'relative' }}>
                <span style={{ position: 'absolute', left: 0, top: 2, color: 'var(--primary)' }}>·</span>
                {reason}
              </div>
            ))}
          </div>

          {/* 按钮区 */}
          <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 8 }}>
            <button
              type="button"
              onClick={() => onCook(recipe)}
              style={{
                flex: 1, padding: '8px 16px', borderRadius: 10,
                background: 'var(--primary-btn)', color: 'var(--primary-btn-tx)',
                border: '1px solid var(--primary-btn)', fontSize: 13, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              就做这道
            </button>
            <button
              type="button"
              onClick={onRefresh}
              style={{
                padding: '8px 16px', borderRadius: 10,
                background: 'var(--panel)', color: 'var(--tx)',
                border: '1px solid var(--line)', fontSize: 13, cursor: 'pointer',
              }}
            >
              换一个 ↻
            </button>
          </div>
        </div>
      </div>
      <div style={{ padding: '8px 16px', borderTop: '1px solid var(--line2)', fontSize: 11, color: 'var(--tx2)' }}>
        推荐池排序：清库存 → 现在就能做 → 需额外购买（缺 ≤ 2 样）
      </div>
    </div>
  );
}

function AlternateCard({
  rec,
  checked,
  onToggle,
  onClickCard,
}: {
  rec: RecommendedRecipe;
  checked: boolean;
  onToggle: () => void;
  onClickCard: () => void;
}) {
  const r = rec.recipe;
  let feature = '';
  if (rec.missingIngredients?.length) {
    feature = `缺: ${rec.missingIngredients.slice(0, 2).join('/')}`;
  } else if (rec.clearStockIngredients?.length) {
    feature = `${rec.clearStockIngredients[0]}已放N天，建议先吃`;
  } else if (r.cook_time_minutes && r.cook_time_minutes <= 15) {
    feature = `${r.cook_time_minutes}分钟快手`;
  } else if (r.cook_time_minutes && r.cook_time_minutes > 30) {
    feature = `要炖${r.cook_time_minutes}分钟`;
  } else {
    feature = r.attributes?.flavor || r.attributes?.cuisine || '家常美味';
  }

  return (
    <div
      onClick={onClickCard}
      style={{
        width: 212,
        borderRadius: 14,
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        padding: 12,
        cursor: 'pointer',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = '';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <StatusDot status={rec.missingIngredients?.length ? 'warn' : 'good'} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', flex: 1 }}>{r.name}</span>
        <input
          type="checkbox"
          checked={checked}
          onClick={(e) => e.stopPropagation()}
          onChange={onToggle}
          style={{ cursor: 'pointer' }}
        />
      </div>
      <div style={{ fontSize: 11, color: 'var(--tx2)' }}>{feature}</div>
    </div>
  );
}

function ShoppingPanel({
  items,
  checkedIds,
  onToggle,
  onCheckout,
  checkoutLoading,
}: {
  items: ShoppingListItem[];
  checkedIds: Set<string>;
  onToggle: (key: string) => void;
  onCheckout: () => void;
  checkoutLoading: boolean;
}) {
  return (
    <div
      style={{
        width: 262,
        flexShrink: 0,
        borderRadius: 14,
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        alignSelf: 'flex-start',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>购物清单</span>
        {items.length > 0 && (
          <span style={{ fontSize: 11, borderRadius: 7, padding: '0 7px', background: 'var(--primary-soft)', color: 'var(--primary)' }}>
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div style={{ fontSize: 11.5, color: 'var(--tx2)', textAlign: 'center', padding: '24px 0' }}>
          勾选缺料的菜<br />要买的东西会出现在这里
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((item, i) => {
            const key = item.inventoryId || `${item.name}-${i}`;
            const checked = checkedIds.has(key);
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
                  onChange={() => onToggle(key)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ flex: 1 }}>{item.name}</span>
                <span style={{ fontSize: 10.5, color: 'var(--tx2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80 }}>
                  {item.source}
                </span>
              </div>
            );
          })}
          {checkedIds.size > 0 && (
            <button
              type="button"
              onClick={onCheckout}
              disabled={checkoutLoading}
              style={{
                marginTop: 8, padding: '6px 12px', borderRadius: 10,
                background: 'var(--primary-btn)', color: 'var(--primary-btn-tx)',
                border: '1px solid var(--primary-btn)', fontSize: 12, fontWeight: 600,
                cursor: checkoutLoading ? 'default' : 'pointer', opacity: checkoutLoading ? 0.7 : 1,
              }}
            >
              {checkoutLoading ? '更新中...' : `已买到（${checkedIds.size} 项）`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 主页面 ─────────────────────────────────────────────────────────────────────

export default function RecommendPage() {
  const [allRecs, setAllRecs] = useState<RecommendedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [mainIndex, setMainIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [shoppingItems, setShoppingItems] = useState<ShoppingListItem[]>([]);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // 筛选
  const [timeFilter, setTimeFilter] = useState<string[]>([]);
  const [spicyFilter, setSpicyFilter] = useState<string[]>([]);

  // 详情弹窗
  const [detailRecipe, setDetailRecipe] = useState<RecommendedRecipe | null>(null);

  const fetchRecs = useCallback(async () => {
    setLoading(true);
    try {
      const filters: Record<string, unknown> = {};
      if (timeFilter.length > 0 && timeFilter[0]) filters.maxCookTime = Number(timeFilter[0]);
      if (spicyFilter.length > 0 && spicyFilter[0]) filters.spiciness = spicyFilter[0];
      const res = await getRecommendations(filters);
      if (res.data) {
        const sorted = [...res.data].sort((a, b) => {
          const order: Record<string, number> = { clear_stock: 0, can_make_now: 1, need_shopping: 2 };
          return (order[a.tier] ?? 3) - (order[b.tier] ?? 3);
        });
        setAllRecs(sorted);
        setMainIndex(0);
        setSelectedIds(new Set());
      }
    } catch {
      message.error('获取推荐失败');
    } finally {
      setLoading(false);
    }
  }, [timeFilter, spicyFilter]);

  useEffect(() => { fetchRecs(); }, [fetchRecs]);

  const mainRecipe = allRecs.length > 0 ? allRecs[mainIndex % allRecs.length] : null;
  const altRecipes = allRecs.filter((_, i) => i !== (mainIndex % allRecs.length));

  // "就做这道"
  const handleCook = async (rec: RecommendedRecipe) => {
    try {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const res = await addCalendarEntryAction({ date: dateStr, recipe_id: rec.recipe.id, status: 'planned' });
      if (res.error) {
        message.error(res.error);
      } else {
        message.success(`已把「${rec.recipe.name}」写进今天的日历`);
      }
    } catch {
      message.error('操作失败');
    }
  };

  // 备选勾选 → 购物清单
  const handleToggleSelect = async (recipeId: string) => {
    const next = new Set(selectedIds);
    if (next.has(recipeId)) {
      next.delete(recipeId);
    } else {
      next.add(recipeId);
    }
    setSelectedIds(next);

    if (next.size > 0) {
      const res = await generateShoppingListAction(Array.from(next));
      if (res.data) setShoppingItems(res.data);
    } else {
      setShoppingItems([]);
    }
    setCheckedItems(new Set());
  };

  // 购物清单勾选
  const handleToggleCheckout = (key: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // 采购完成
  const handleCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const ids = Array.from(checkedItems);
      const res = await checkoutShoppingListAction(ids);
      if (res.error) {
        message.error(res.error);
      } else {
        message.success('库存已更新');
        setCheckedItems(new Set());
        fetchRecs();
      }
    } catch {
      message.error('操作失败');
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="今晚吃什么？" subtitle="正在为你整理推荐..." />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <SkeletonCard height={200} />
          <SkeletonCard height={180} />
          <SkeletonCard height={160} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="今晚吃什么？"
        subtitle={`${allRecs.length} 道推荐菜品`}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <FilterChips options={TIME_OPTIONS} selected={timeFilter} onChange={setTimeFilter} label="时长" />
          <FilterChips options={SPICY_OPTIONS} selected={spicyFilter} onChange={setSpicyFilter} label="辣度" />
        </div>
      </PageHeader>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* 左侧推荐区 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* 主推卡 */}
          {mainRecipe && (
            <MainCard recipe={mainRecipe} onCook={handleCook} onRefresh={() => setMainIndex((i) => (i + 1) % allRecs.length)} />
          )}

          {allRecs.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, fontSize: 13, color: 'var(--tx2)' }}>
              还没有菜谱数据，先去添加一些菜谱和食材吧
            </div>
          )}

          {/* 备选推荐 */}
          {altRecipes.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)', marginBottom: 10 }}>更多推荐</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {altRecipes.slice(0, 12).map((rec) => (
                  <AlternateCard
                    key={rec.recipe.id}
                    rec={rec}
                    checked={selectedIds.has(rec.recipe.id)}
                    onToggle={() => handleToggleSelect(rec.recipe.id)}
                    onClickCard={() => setDetailRecipe(rec)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 右侧购物清单 */}
        <ShoppingPanel
          items={shoppingItems}
          checkedIds={checkedItems}
          onToggle={handleToggleCheckout}
          onCheckout={handleCheckout}
          checkoutLoading={checkoutLoading}
        />
      </div>

      {/* 详情弹窗 */}
      <RecipeDetailModal
        recipe={detailRecipe?.recipe || null}
        open={!!detailRecipe}
        onClose={() => setDetailRecipe(null)}
      />
    </div>
  );
}
