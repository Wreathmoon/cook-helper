'use client';

import { useState, useEffect, useCallback, useMemo, type CSSProperties } from 'react';
import { message } from 'antd';
import { FilterOutlined } from '@ant-design/icons';
import { getRecommendations, generateShoppingListAction, checkoutShoppingListAction } from '@/app/actions/recommend';
import { addCalendarEntryAction } from '@/app/actions/calendar';
import { getListInventory } from '@/app/actions/inventory';
import { getListUtensils } from '@/app/actions/utensil';
import type { RecommendedRecipe, ShoppingListItem, RecommendTier } from '@/types';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusDot } from '@/components/shared/StatusDot';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { RecipeDetailModal } from '@/components/shared/RecipeDetailModal';

// ─── 筛选维度配置（可扩展：新增维度只需往这个数组里加一组）──────────────────────

interface FilterDimension {
  key: string;
  label: string;
  tags: string[];
}

const FILTER_DIMENSIONS: FilterDimension[] = [
  { key: 'cuisine', label: '菜系', tags: ['川', '粤', '鲁', '家常', '其他'] },
  { key: 'method', label: '做法', tags: ['炒', '炖', '蒸', '煮', '烤', '凉拌', '炸'] },
  { key: 'spiciness', label: '辣度', tags: ['不辣', '微辣', '中辣', '重辣'] },
  { key: 'time', label: '时长', tags: ['≤15分钟', '≤30分钟'] },
];

type FilterState = Record<string, string[]>;

function emptyFilterState(): FilterState {
  return Object.fromEntries(FILTER_DIMENSIONS.map((d) => [d.key, [] as string[]]));
}

function timeThreshold(tag: string): number {
  return tag === '≤15分钟' ? 15 : 30;
}

// 维度间 AND，维度内 OR；缺失该维度属性的菜谱不参与过滤（优雅降级）
function matchesDimension(rec: RecommendedRecipe, dimKey: string, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const attrs = rec.recipe.attributes;
  if (dimKey === 'cuisine') {
    if (!attrs?.cuisine) return true;
    return selected.includes(attrs.cuisine);
  }
  if (dimKey === 'method') {
    if (!attrs?.method?.length) return true;
    return attrs.method.some((m) => selected.includes(m));
  }
  if (dimKey === 'spiciness') {
    if (!attrs?.spiciness) return true;
    return selected.includes(attrs.spiciness);
  }
  if (dimKey === 'time') {
    if (!rec.recipe.cook_time_minutes) return true;
    return selected.some((t) => rec.recipe.cook_time_minutes! <= timeThreshold(t));
  }
  return true;
}

function matchesAllFilters(rec: RecommendedRecipe, filters: FilterState): boolean {
  return FILTER_DIMENSIONS.every((dim) => matchesDimension(rec, dim.key, filters[dim.key] || []));
}

function buildServerFilters(filters: FilterState): {
  maxCookTime?: number;
  spiciness?: string;
  method?: string[];
} {
  const result: { maxCookTime?: number; spiciness?: string; method?: string[] } = {};
  const timeTags = filters.time || [];
  if (timeTags.length > 0) {
    result.maxCookTime = Math.max(...timeTags.map(timeThreshold));
  }
  const spicyTags = filters.spiciness || [];
  if (spicyTags.length === 1) result.spiciness = spicyTags[0];
  const methodTags = filters.method || [];
  if (methodTags.length > 0) result.method = methodTags;
  return result;
}

// ─── 无图卡：按菜名 hash 取暖色渐变 ──────────────────────────────────────────

const NOPHOTO_GRADIENTS = [
  'linear-gradient(135deg, #f6e4d8, #efd9c8)', // t0
  'linear-gradient(135deg, #eee6d0, #e6dcbf)', // t1
  'linear-gradient(135deg, #e9edd9, #dee7c6)', // t2
  'linear-gradient(135deg, #f2e1de, #ead1cb)', // t3
];

function nameHashIndex(name: string): number {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return sum % NOPHOTO_GRADIENTS.length;
}

function NoPhotoCard({ name }: { name: string }) {
  return (
    <div
      style={{
        width: 120,
        height: 118,
        borderRadius: 10,
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        background: NOPHOTO_GRADIENTS[nameHashIndex(name)],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          fontSize: 14,
          fontWeight: 800,
          opacity: 0.34,
          color: 'var(--tx)',
          textAlign: 'center',
          padding: '0 10px',
          wordBreak: 'break-all',
        }}
      >
        {name}
      </span>
      <span
        style={{
          position: 'absolute',
          bottom: 6,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 9.5,
          padding: '2px 8px',
          borderRadius: 99,
          background: 'rgba(255,255,255,.55)',
          color: 'var(--tx2)',
          whiteSpace: 'nowrap',
        }}
      >
        📷 加照片
      </span>
    </div>
  );
}

// ─── 小组件 ──────────────────────────────────────────────────────────────────

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 7,
        border: '1px solid var(--line)',
        padding: '1px 7px',
        fontSize: 10.5,
        color: 'var(--tx2)',
      }}
    >
      {children}
    </span>
  );
}

function ActivePill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 6px 3px 10px',
        borderRadius: 99,
        background: 'var(--primary-soft)',
        color: 'var(--primary)',
        fontSize: 11.5,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      <span onClick={onRemove} style={{ cursor: 'pointer', fontSize: 12, lineHeight: 1, opacity: 0.7 }}>
        ✕
      </span>
    </span>
  );
}

function tagStyle(selected: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '5px 12px',
    borderRadius: 99,
    border: `1px solid ${selected ? 'var(--primary)' : 'var(--line)'}`,
    background: selected ? 'var(--primary-soft)' : 'transparent',
    color: selected ? 'var(--primary)' : 'var(--tx)',
    fontWeight: selected ? 700 : 400,
    fontSize: 12,
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  };
}

function fbtnStyle(active: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    borderRadius: 99,
    border: `1px solid ${active ? 'var(--primary)' : 'var(--line)'}`,
    background: active ? 'var(--primary-soft)' : 'var(--panel)',
    color: active ? 'var(--primary)' : 'var(--tx)',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}

const fbadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 16,
  height: 16,
  padding: '0 4px',
  borderRadius: 99,
  background: 'var(--primary)',
  color: '#fff',
  fontSize: 10,
  fontWeight: 700,
};

const scrimStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 40,
  background: 'transparent',
};

const popoverStyle: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  right: 0,
  width: 340,
  zIndex: 50,
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 14,
  boxShadow: 'var(--shadow-card-hover)',
  padding: 16,
  animation: 'popin 0.14s ease both',
};

const primaryBtnStyle: CSSProperties = {
  flex: 1,
  padding: '8px 16px',
  borderRadius: 10,
  background: 'var(--primary-btn)',
  color: 'var(--primary-btn-tx)',
  border: '1px solid var(--primary-btn)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryBtnStyle: CSSProperties = {
  padding: '8px 16px',
  borderRadius: 10,
  background: 'var(--panel)',
  color: 'var(--tx)',
  border: '1px solid var(--line)',
  fontSize: 13,
  cursor: 'pointer',
};

const TIER_META: Record<RecommendTier, { label: string; bg: string; tx: string; dot: 'good' | 'warn' | 'notice' }> = {
  can_make_now: { label: '现在就能做', bg: 'var(--success-bg)', tx: 'var(--success)', dot: 'good' },
  need_shopping: { label: '差一两样', bg: 'var(--warn-bg)', tx: 'var(--warn)', dot: 'warn' },
  clear_stock: { label: '该清库存了', bg: 'var(--notice-bg)', tx: 'var(--notice)', dot: 'notice' },
};

function buildReasons(rec: RecommendedRecipe): string[] {
  const reasons: string[] = [];
  const r = rec.recipe;
  if (rec.tier === 'clear_stock' && rec.clearStockIngredients?.length) {
    reasons.push(`${rec.clearStockIngredients.join('、')} 已放多天，建议尽快吃`);
  }
  if (rec.missingIngredients?.length) {
    reasons.push(`缺 ${rec.missingIngredients.join('、')}，买齐就能做`);
  } else {
    reasons.push('食材全齐，随时能做 ✓');
  }
  if (r.cook_time_minutes && r.cook_time_minutes <= 15) {
    reasons.push(`快手菜，只需 ${r.cook_time_minutes} 分钟`);
  }
  if (rec.reason) reasons.push(rec.reason);
  if (reasons.length === 0) reasons.push('为你精选 ✨');
  return reasons.slice(0, 3);
}

function altFeature(rec: RecommendedRecipe): { text: string; color: string } {
  const r = rec.recipe;
  if (rec.missingIngredients?.length) {
    return { text: `缺: ${rec.missingIngredients.slice(0, 2).join('/')}`, color: 'var(--warn)' };
  }
  if (rec.clearStockIngredients?.length) {
    return { text: `${rec.clearStockIngredients[0]} 已放多天，建议先吃`, color: 'var(--notice)' };
  }
  if (r.cook_time_minutes && r.cook_time_minutes <= 15) {
    return { text: `${r.cook_time_minutes}分钟快手`, color: 'var(--success)' };
  }
  return { text: r.attributes?.flavor || r.attributes?.cuisine || '家常美味', color: 'var(--tx2)' };
}

function HeroCard({
  rec,
  onCook,
  onSwap,
}: {
  rec: RecommendedRecipe;
  onCook: () => void;
  onSwap: () => void;
}) {
  const r = rec.recipe;
  const meta = TIER_META[rec.tier];
  const reasons = buildReasons(rec);

  return (
    <div
      className="card-hover"
      style={{
        flex: '1 1 330px',
        position: 'relative',
        borderRadius: 14,
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        boxShadow: 'var(--shadow-card)',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          fontSize: 10.5,
          fontWeight: 600,
          padding: '2px 9px',
          borderRadius: 99,
          background: meta.bg,
          color: meta.tx,
        }}
      >
        {meta.label}
      </span>

      <div style={{ display: 'flex', gap: 12 }}>
        <NoPhotoCard name={r.name} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingRight: 76 }}>
            <StatusDot status={meta.dot} />
            <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--tx)' }}>{r.name}</span>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {r.attributes?.cuisine && <Chip>{r.attributes.cuisine}</Chip>}
            {r.attributes?.method?.map((m) => <Chip key={m}>{m}</Chip>)}
            {r.cook_time_minutes ? <Chip>⏱{r.cook_time_minutes}分</Chip> : null}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {reasons.map((reason, i) => (
              <div key={i} style={{ fontSize: 11.5, color: 'var(--tx2)', paddingLeft: 9, position: 'relative' }}>
                <span style={{ position: 'absolute', left: 0, top: 1, color: 'var(--primary)' }}>·</span>
                {reason}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" onClick={onCook} style={primaryBtnStyle}>
          就做这道
        </button>
        <button type="button" onClick={onSwap} style={secondaryBtnStyle}>
          换一个
        </button>
      </div>
    </div>
  );
}

function AltCard({
  rec,
  checked,
  onToggle,
  onClick,
}: {
  rec: RecommendedRecipe;
  checked: boolean;
  onToggle: () => void;
  onClick: () => void;
}) {
  const r = rec.recipe;
  const meta = TIER_META[rec.tier];
  const feature = altFeature(rec);

  return (
    <div
      className="card-hover"
      onClick={onClick}
      style={{
        flex: '1 1 200px',
        minWidth: 190,
        maxWidth: 260,
        borderRadius: 14,
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        padding: 12,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <StatusDot status={meta.dot} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', flex: 1 }}>{r.name}</span>
        <input
          type="checkbox"
          checked={checked}
          onClick={(e) => e.stopPropagation()}
          onChange={onToggle}
          style={{ cursor: 'pointer' }}
        />
      </div>
      <div style={{ fontSize: 11, color: feature.color }}>{feature.text}</div>
    </div>
  );
}

function EmptyState({ hasData, onClear }: { hasData: boolean; onClear: () => void }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '44px 20px',
        borderRadius: 14,
        background: 'var(--panel)',
        border: '1px dashed var(--line)',
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: '50%',
          background: 'var(--hover)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          margin: '0 auto 12px',
        }}
      >
        {hasData ? '🔍' : '🍳'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--tx2)', marginBottom: hasData ? 14 : 0 }}>
        {hasData ? '没有符合筛选条件的菜谱，试试调整筛选' : '还没有菜谱数据，先去添加一些菜谱和食材吧'}
      </div>
      {hasData && (
        <button
          type="button"
          onClick={onClear}
          style={{
            padding: '7px 18px',
            borderRadius: 10,
            background: 'var(--primary-btn)',
            color: 'var(--primary-btn-tx)',
            border: '1px solid var(--primary-btn)',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          清除筛选条件
        </button>
      )}
    </div>
  );
}

function ShoppingPanel({
  items,
  checkedIds,
  onToggle,
  onCheckout,
  checkoutLoading,
  loading,
}: {
  items: ShoppingListItem[];
  checkedIds: Set<string>;
  onToggle: (key: string) => void;
  onCheckout: () => void;
  checkoutLoading: boolean;
  loading: boolean;
}) {
  return (
    <div
      className="shoplist"
      style={{
        borderRadius: 14,
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
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

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="sk-shimmer" style={{ height: 16, borderRadius: 6 }} />
          <div className="sk-shimmer" style={{ height: 16, borderRadius: 6 }} />
          <div className="sk-shimmer" style={{ height: 16, borderRadius: 6, width: '70%' }} />
        </div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: 22, marginBottom: 8 }}>🧺</div>
          <div style={{ fontSize: 11.5, color: 'var(--tx2)' }}>
            勾选缺料的菜，要买的东西会出现在这里
          </div>
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '3px 0',
                  fontSize: 12,
                  color: checked ? 'var(--tx2)' : 'var(--tx)',
                  textDecoration: checked ? 'line-through' : 'none',
                }}
              >
                <input type="checkbox" checked={checked} onChange={() => onToggle(key)} style={{ cursor: 'pointer' }} />
                <span style={{ flex: 1 }}>{item.name}</span>
                <span
                  style={{
                    fontSize: 10.5,
                    color: 'var(--tx2)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 80,
                  }}
                >
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
                marginTop: 8,
                padding: '6px 12px',
                borderRadius: 10,
                background: 'var(--primary-btn)',
                color: 'var(--primary-btn-tx)',
                border: '1px solid var(--primary-btn)',
                fontSize: 12,
                fontWeight: 600,
                cursor: checkoutLoading ? 'default' : 'pointer',
                opacity: checkoutLoading ? 0.7 : 1,
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
  const [allRecsRaw, setAllRecsRaw] = useState<RecommendedRecipe[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  const [filters, setFilters] = useState<FilterState>(emptyFilterState);
  const [filterOpen, setFilterOpen] = useState(false);

  const [heroIdx, setHeroIdx] = useState(0);
  const [swap, setSwap] = useState<[number, number]>([0, 0]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [shoppingItems, setShoppingItems] = useState<ShoppingListItem[]>([]);
  const [shoppingLoading, setShoppingLoading] = useState(true);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [detailRecipe, setDetailRecipe] = useState<RecommendedRecipe | null>(null);

  const [inventoryCount, setInventoryCount] = useState(0);
  const [utensilCount, setUtensilCount] = useState(0);

  const fetchStats = useCallback(async () => {
    try {
      const [invRes, utilRes] = await Promise.all([getListInventory(), getListUtensils()]);
      if (invRes.data) setInventoryCount(invRes.data.length);
      if (utilRes.data) setUtensilCount(utilRes.data.length);
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const refreshShoppingList = useCallback(async (ids: Set<string>) => {
    setShoppingLoading(true);
    try {
      const res = await generateShoppingListAction(Array.from(ids));
      if (res.data) setShoppingItems(res.data);
    } catch {
      /* non-critical */
    } finally {
      setShoppingLoading(false);
    }
  }, []);

  const fetchRecs = useCallback(async () => {
    try {
      const res = await getRecommendations(buildServerFilters(filters));
      if (res.data) {
        const order: Record<string, number> = { clear_stock: 0, can_make_now: 1, need_shopping: 2 };
        const sorted = [...res.data].sort((a, b) => (order[a.tier] ?? 3) - (order[b.tier] ?? 3));
        setAllRecsRaw(sorted);
        setHeroIdx(0);
        setSwap([0, 0]);
        setSelectedIds(new Set());
        setCheckedItems(new Set());
        refreshShoppingList(new Set());
      }
    } catch {
      message.error('获取推荐失败');
    } finally {
      setInitialLoading(false);
    }
  }, [filters, refreshShoppingList]);

  useEffect(() => {
    fetchRecs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const displayRecs = useMemo(
    () => allRecsRaw.filter((rec) => matchesAllFilters(rec, filters)),
    [allRecsRaw, filters]
  );

  const heroPair = useMemo(() => {
    if (displayRecs.length === 0) return [];
    if (displayRecs.length === 1) return [displayRecs[0]];
    const idx0 = (heroIdx * 2 + swap[0]) % displayRecs.length;
    let idx1 = (heroIdx * 2 + 1 + swap[1]) % displayRecs.length;
    if (idx1 === idx0) idx1 = (idx1 + 1) % displayRecs.length;
    return [displayRecs[idx0], displayRecs[idx1]];
  }, [displayRecs, heroIdx, swap]);

  const altList = useMemo(() => {
    const heroIds = new Set(heroPair.map((r) => r.recipe.id));
    return displayRecs.filter((r) => !heroIds.has(r.recipe.id));
  }, [displayRecs, heroPair]);

  const activeTagList = useMemo(
    () => FILTER_DIMENSIONS.flatMap((dim) => (filters[dim.key] || []).map((tag) => ({ dimKey: dim.key, tag }))),
    [filters]
  );

  const toggleTag = (dimKey: string, tag: string) => {
    setFilters((prev) => {
      const cur = prev[dimKey] || [];
      const next = cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag];
      return { ...prev, [dimKey]: next };
    });
  };

  const removeTag = (dimKey: string, tag: string) => {
    setFilters((prev) => ({ ...prev, [dimKey]: (prev[dimKey] || []).filter((t) => t !== tag) }));
  };

  const clearAllFilters = () => setFilters(emptyFilterState());

  const handleRefreshBatch = () => {
    setHeroIdx((i) => i + 1);
    setSwap([0, 0]);
  };

  const handleSwapSlot = (slot: 0 | 1) => {
    setSwap((prev) => {
      const next: [number, number] = [prev[0], prev[1]];
      next[slot] += 1;
      return next;
    });
  };

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
    if (next.has(recipeId)) next.delete(recipeId);
    else next.add(recipeId);
    setSelectedIds(next);
    setCheckedItems(new Set());
    await refreshShoppingList(next);
  };

  // 购物清单勾选（已买到）
  const handleToggleCheckout = (key: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // 采购完成 → 库存改"充足"
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
        await fetchRecs();
      }
    } catch {
      message.error('操作失败');
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="今晚吃什么？"
        subtitle={`根据 ${inventoryCount} 种在库食材 · ${utensilCount} 件厨具，共 ${displayRecs.length} 道能安排`}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {activeTagList.map(({ dimKey, tag }) => (
            <ActivePill key={`${dimKey}-${tag}`} label={tag} onRemove={() => removeTag(dimKey, tag)} />
          ))}
          {activeTagList.length > 0 && (
            <span onClick={clearAllFilters} style={{ fontSize: 12, color: 'var(--tx2)', cursor: 'pointer' }}>
              清空
            </span>
          )}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setFilterOpen((o) => !o)}
              style={fbtnStyle(activeTagList.length > 0)}
            >
              <FilterOutlined />
              筛选
              {activeTagList.length > 0 && <span style={fbadgeStyle}>{activeTagList.length}</span>}
            </button>

            {filterOpen && (
              <>
                <div onClick={() => setFilterOpen(false)} style={scrimStyle} />
                <div style={popoverStyle}>
                  {FILTER_DIMENSIONS.map((dim) => (
                    <div key={dim.key} style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--tx2)', marginBottom: 7 }}>
                        {dim.label}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {dim.tags.map((tag) => (
                          <span
                            key={tag}
                            onClick={() => toggleTag(dim.key, tag)}
                            style={tagStyle((filters[dim.key] || []).includes(tag))}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: 10,
                      borderTop: '1px solid var(--line2)',
                    }}
                  >
                    <span onClick={clearAllFilters} style={{ fontSize: 12, color: 'var(--tx2)', cursor: 'pointer' }}>
                      清空全部
                    </span>
                    <button
                      type="button"
                      onClick={() => setFilterOpen(false)}
                      style={{
                        padding: '6px 16px',
                        borderRadius: 10,
                        background: 'var(--primary-btn)',
                        color: 'var(--primary-btn-tx)',
                        border: '1px solid var(--primary-btn)',
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      查看 {displayRecs.length} 道
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </PageHeader>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* 左侧：今日推荐 + 备选推荐 */}
        <div style={{ flex: '1 1 480px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>
                🍽 今日推荐 · {heroPair.length} 道
              </span>
              <span
                onClick={handleRefreshBatch}
                style={{ fontSize: 12, color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
              >
                换一批 ↻
              </span>
            </div>

            {initialLoading ? (
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <SkeletonCard height={160} style={{ flex: '1 1 330px' }} />
                <SkeletonCard height={160} style={{ flex: '1 1 330px' }} />
              </div>
            ) : allRecsRaw.length === 0 ? (
              <EmptyState hasData={false} onClear={clearAllFilters} />
            ) : heroPair.length === 0 ? (
              <EmptyState hasData={true} onClear={clearAllFilters} />
            ) : (
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {heroPair.map((rec, slot) => (
                  <HeroCard
                    key={rec.recipe.id}
                    rec={rec}
                    onCook={() => handleCook(rec)}
                    onSwap={() => handleSwapSlot(slot as 0 | 1)}
                  />
                ))}
              </div>
            )}
          </div>

          {!initialLoading && altList.length > 0 && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 10 }}>
                备选推荐 · {altList.length} 道
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {altList.map((rec) => (
                  <AltCard
                    key={rec.recipe.id}
                    rec={rec}
                    checked={selectedIds.has(rec.recipe.id)}
                    onToggle={() => handleToggleSelect(rec.recipe.id)}
                    onClick={() => setDetailRecipe(rec)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 右侧：购物清单 */}
        <ShoppingPanel
          items={shoppingItems}
          checkedIds={checkedItems}
          onToggle={handleToggleCheckout}
          onCheckout={handleCheckout}
          checkoutLoading={checkoutLoading}
          loading={shoppingLoading}
        />
      </div>

      {/* 详情弹窗 */}
      <RecipeDetailModal recipe={detailRecipe?.recipe || null} open={!!detailRecipe} onClose={() => setDetailRecipe(null)} />
    </div>
  );
}
