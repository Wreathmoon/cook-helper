'use client';

import { useState, useMemo } from 'react';
import type { RecommendedRecipe, ShoppingListItem } from '@/types';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { RecipeDetailModal } from '@/components/shared/RecipeDetailModal';
import {
  HeroCard,
  AltCard,
  FilterPopover,
  ShoppingPanel,
  EmptyState,
  type FilterDimension,
} from '@/components/recommend';
import { useReadOnly } from '@/components/layout/read-only-provider';

// ─── 筛选维度配置 ──────────────────────────────────────────────────────────────

export const FILTER_DIMENSIONS: FilterDimension[] = [
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

// ─── Props ────────────────────────────────────────────────────────────────────

export interface RecommendViewProps {
  /** 所有推荐数据 */
  allRecs: RecommendedRecipe[];
  /** 是否首次加载中 */
  loading: boolean;
  /** 在库食材数 */
  inventoryCount: number;
  /** 厨具数 */
  utensilCount: number;
  /** 购物清单项 */
  shoppingItems: ShoppingListItem[];
  /** 购物清单加载中 */
  shoppingLoading: boolean;
  /** 购物清单已勾选项 keys */
  checkedItems: Set<string>;
  /** 购物清单 checkout 中 */
  checkoutLoading: boolean;

  // 操作回调
  onCook: (rec: RecommendedRecipe) => void;
  onRefreshBatch: () => void;
  onSwapSlot: (slot: number) => void;
  onToggleSelect: (recipeId: string) => void;
  onToggleCheckout: (key: string) => void;
  onCheckout: () => void;

  /** 只读沙盒：写操作提示「这是演示实例」而不实际执行。不传则从 ReadOnlyProvider 取 */
  readOnly?: boolean;
}

// ─── View 组件 ─────────────────────────────────────────────────────────────────

export function RecommendView({
  allRecs,
  loading,
  inventoryCount,
  utensilCount,
  shoppingItems,
  shoppingLoading,
  checkedItems,
  checkoutLoading,
  onCook,
  onRefreshBatch,
  onSwapSlot,
  onToggleSelect,
  onToggleCheckout,
  onCheckout,
  readOnly: readOnlyProp,
}: RecommendViewProps) {
  // 页面不必逐个传：只读状态从根布局的 ReadOnlyProvider 兜底。
  // hook 必须无条件调用，不能写成 `readOnlyProp ?? useReadOnly()`——`??` 会短路掉它
  const contextReadOnly = useReadOnly();
  const readOnly = readOnlyProp ?? contextReadOnly;
  const [filters, setFilters] = useState<FilterState>(emptyFilterState);
  const [filterOpen, setFilterOpen] = useState(false);
  const [heroIdx, setHeroIdx] = useState(0);
  const [swap, setSwap] = useState<[number, number]>([0, 0]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailRecipe, setDetailRecipe] = useState<RecommendedRecipe | null>(null);

  const displayRecs = useMemo(
    () => allRecs.filter((rec) => matchesAllFilters(rec, filters)),
    [allRecs, filters],
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
    () => FILTER_DIMENSIONS.flatMap((dim) =>
      (filters[dim.key] || []).map((tag) => ({ dimKey: dim.key, tag })),
    ),
    [filters],
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

  const handleRefreshBatch = () => { setHeroIdx((i) => i + 1); setSwap([0, 0]); onRefreshBatch(); };
  const handleSwapSlot = (slot: 0 | 1) => { setSwap((prev) => { const n: [number, number] = [...prev]; n[slot] += 1; return n; }); onSwapSlot(slot); };

  const handleToggleSelect = (recipeId: string) => {
    const next = new Set(selectedIds);
    if (next.has(recipeId)) next.delete(recipeId);
    else next.add(recipeId);
    setSelectedIds(next);
    onToggleSelect(recipeId);
  };

  return (
    <>
      {/* 页头 */}
      <div className="page-head">
        <div>
          <div style={{ fontSize: 19, fontWeight: 700 }}>今晚吃什么?</div>
          <div style={{ fontSize: 11.5, color: 'var(--tx2)', marginTop: 2 }}>
            根据 {inventoryCount} 种在库食材 · {utensilCount} 件厨具，共 {displayRecs.length} 道能安排
          </div>
        </div>
        <span style={{ flex: 1 }} />

        {activeTagList.map(({ dimKey, tag }) => (
          <span
            key={`${dimKey}-${tag}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 6px 3px 10px', borderRadius: 99,
              background: 'var(--primary-soft)', color: 'var(--primary)',
              fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap',
            }}
          >
            {tag}
            <span onClick={() => removeTag(dimKey, tag)} style={{ cursor: 'pointer', fontSize: 10, width: 15, height: 15, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.06)' }}>✕</span>
          </span>
        ))}
        {activeTagList.length > 0 && (
          <span onClick={clearAllFilters} style={{ fontSize: 12, color: 'var(--tx2)', cursor: 'pointer', textDecoration: 'underline' }}>清空</span>
        )}

        {filterOpen ? (
          <FilterPopover
            dimensions={FILTER_DIMENSIONS} filters={filters}
            onToggleTag={toggleTag} onClearAll={clearAllFilters}
            onClose={() => setFilterOpen(false)} poolCount={displayRecs.length}
          />
        ) : (
          <button type="button" onClick={() => setFilterOpen(true)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 10,
            border: `1px solid ${activeTagList.length > 0 ? 'var(--primary)' : 'var(--line)'}`,
            background: activeTagList.length > 0 ? 'var(--primary-soft)' : 'var(--panel)',
            color: activeTagList.length > 0 ? 'var(--primary)' : 'var(--tx)',
            fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18M6 12h12M10 19h4"/></svg>
            筛选
            {activeTagList.length > 0 && (
              <span style={{ background: 'var(--primary-btn)', color: 'var(--primary-btn-tx)', borderRadius: 99, fontSize: 10, fontWeight: 700, minWidth: 16, height: 16, padding: '0 4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{activeTagList.length}</span>
            )}
          </button>
        )}
      </div>

      {/* 内容区 */}
      <div className="page-body">
        {filterOpen && <div onClick={() => setFilterOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'transparent' }} />}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* 今日推荐 */}
          {loading ? (
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700, fontSize: 14, marginBottom: 11 }}>
                🍽 今日推荐<span style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx2)', background: 'var(--hover)', borderRadius: 99, padding: '0 8px' }}>0 道</span>
              </div>
              <div style={{ display: 'flex', gap: 14 }}>
                <SkeletonCard height={200} style={{ flex: 1 }} />
                <SkeletonCard height={200} style={{ flex: 1 }} />
              </div>
            </div>
          ) : allRecs.length === 0 ? (
            <EmptyState onClear={clearAllFilters} />
          ) : heroPair.length === 0 ? (
            <EmptyState onClear={clearAllFilters} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700, fontSize: 14 }}>
                🍽 今日推荐
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx2)', background: 'var(--hover)', borderRadius: 99, padding: '0 8px' }}>{heroPair.length} 道</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: 'var(--tx2)', marginRight: 4 }}>每天默认两道，下面可加菜</span>
                <button type="button" onClick={handleRefreshBatch} style={{ padding: '5px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--tx)', fontSize: 12, cursor: 'pointer' }}>换一批 ↻</button>
              </div>
              <div style={{ display: 'flex', gap: 14 }}>
                {heroPair.map((rec, slot) => (
                  <HeroCard
                    key={rec.recipe.id} rec={rec}
                    onCook={() => onCook(rec)}
                    onSwap={() => handleSwapSlot(slot as 0 | 1)}
                    onOpen={() => setDetailRecipe(rec)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 购物清单 — 放在今日推荐和备选推荐之间 */}
          <ShoppingPanel
            items={shoppingItems}
            checkedIds={checkedItems}
            onToggle={onToggleCheckout}
            onCheckout={readOnly ? () => {} : onCheckout}
            checkoutLoading={checkoutLoading}
            loading={shoppingLoading}
          />

          {/* 备选推荐 */}
          {!loading && altList.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700, fontSize: 14 }}>
                备选推荐
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx2)', background: 'var(--hover)', borderRadius: 99, padding: '0 8px' }}>{altList.length} 道</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: 'var(--tx2)' }}>勾选想加做的菜，缺料自动进购物清单</span>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                {altList.map((rec) => (
                  <AltCard
                    key={rec.recipe.id} rec={rec}
                    checked={selectedIds.has(rec.recipe.id)}
                    onToggle={() => { if (readOnly) return; handleToggleSelect(rec.recipe.id); }}
                    onClick={() => setDetailRecipe(rec)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* key 让换一道菜时组件整个重挂载，省掉手动重置 state */}
      <RecipeDetailModal key={detailRecipe?.recipe.id} recipe={detailRecipe?.recipe || null} open={!!detailRecipe} onClose={() => setDetailRecipe(null)} />
    </>
  );
}
