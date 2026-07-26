'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TEXT } from '@/lib/constants/text';
import { getListRecipes, deleteRecipeAction, getRecipeDetailAction } from '@/app/actions/recipe';
import { getCalendarEntriesAction } from '@/app/actions/calendar';
import type { Recipe } from '@/types';
import { PageHeader } from '@/components/shared/PageHeader';
import { FilterChips } from '@/components/shared/FilterChips';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { RecipeDetailModal } from '@/components/shared/RecipeDetailModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { WaterfallCard } from '@/components/recipes';

const METHOD_OPTIONS = [
  { label: '全部', value: '' },
  { label: '炒', value: '炒' },
  { label: '炖', value: '炖' },
  { label: '蒸', value: '蒸' },
  { label: '煮', value: '煮' },
  { label: '烤', value: '烤' },
  { label: '凉拌', value: '凉拌' },
];

const SPICY_OPTIONS = [
  { label: '全部', value: '' },
  { label: '不辣', value: '不辣' },
  { label: '微辣', value: '微辣' },
  { label: '中辣', value: '中辣' },
];

function buildFilters(
  search: string,
  methodFilter: string[],
  spicyFilter: string[]
): { search?: string; attributes?: Record<string, unknown> } | undefined {
  const filters: Record<string, unknown> = {};
  if (methodFilter.length > 0 && methodFilter[0]) filters.method = [methodFilter[0]];
  if (spicyFilter.length > 0 && spicyFilter[0]) filters.spiciness = spicyFilter[0];
  if (search) filters.search = search;
  return Object.keys(filters).length > 0
    ? (filters as { search?: string; attributes?: Record<string, unknown> })
    : undefined;
}

export default function RecipesPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<string[]>([]);
  const [spicyFilter, setSpicyFilter] = useState<string[]>([]);
  const [detailRecipe, setDetailRecipe] = useState<Recipe | null>(null);
  const [missingMap, setMissingMap] = useState<Record<string, number>>({});
  const [cookCountMap, setCookCountMap] = useState<Record<string, number>>({});

  const fetchExtras = useCallback(async (list: Recipe[]) => {
    if (list.length === 0) {
      setMissingMap({});
      setCookCountMap({});
      return;
    }
    try {
      const details = await Promise.all(list.map((r) => getRecipeDetailAction(r.id)));
      const mMap: Record<string, number> = {};
      details.forEach((res, i) => {
        if (res.data) {
          mMap[list[i].id] = res.data.ingredients.filter(
            (ing) => !ing.inventory || ing.inventory.stock_level !== 'enough'
          ).length;
        }
      });
      setMissingMap(mMap);
    } catch { /* non-critical */ }

    try {
      const year = new Date().getFullYear();
      const months = await Promise.all(
        Array.from({ length: 12 }, (_, i) => getCalendarEntriesAction(year, i + 1))
      );
      const cMap: Record<string, number> = {};
      months.forEach((res) => {
        (res.data || []).forEach((entry) => {
          if (entry.status === 'completed') {
            cMap[entry.recipe_id] = (cMap[entry.recipe_id] || 0) + 1;
          }
        });
      });
      setCookCountMap(cMap);
    } catch { /* non-critical */ }
  }, []);

  /** 删除等写操作之后的重新拉取（事件触发，不在 effect 里）*/
  const fetchRecipes = useCallback(async () => {
    const res = await getListRecipes(buildFilters(search, methodFilter, spicyFilter));
    if (res.error) message.error(res.error);
    if (res.data) {
      setRecipes(res.data);
      void fetchExtras(res.data);
    }
  }, [search, methodFilter, spicyFilter, fetchExtras]);

  // 首屏与筛选变化：带取消标记的 async IIFE。setState 落在 await 之后，
  // 筛选条件连续变化时旧请求的结果不会覆盖新结果
  // （也顺带满足 react-hooks/set-state-in-effect —— 它只认内联的 IIFE）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getListRecipes(buildFilters(search, methodFilter, spicyFilter));
        if (cancelled) return;
        if (res.error) message.error(res.error);
        if (res.data) {
          setRecipes(res.data);
          void fetchExtras(res.data);
        }
      } catch {
        if (!cancelled) message.error(TEXT.common.error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [search, methodFilter, spicyFilter, fetchExtras]);

  const handleDelete = async (id: string) => {
    const res = await deleteRecipeAction(id);
    if (res.error) message.error(res.error);
    else { message.success(TEXT.common.success); fetchRecipes(); }
  };

  return (
    <div className="page-body">
      <PageHeader
        title="菜谱库"
        subtitle={`${recipes.length} 道菜谱`}
      >
        <input
          type="text"
          placeholder="搜索菜名..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '6px 12px', borderRadius: 10, border: '1px solid var(--line)',
            background: 'var(--panel)', color: 'var(--tx)', fontSize: 12.5, width: 180,
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <FilterChips options={METHOD_OPTIONS} selected={methodFilter} onChange={setMethodFilter} label="方式" />
          <FilterChips options={SPICY_OPTIONS} selected={spicyFilter} onChange={setSpicyFilter} label="辣度" />
        </div>
        <Button type="primary" icon={<PlusOutlined />}>
          <Link href="/recipes/new" style={{ color: 'inherit', textDecoration: 'none' }}>{TEXT.recipes.addRecipe}</Link>
        </Button>
      </PageHeader>

      {loading ? (
        <div style={{ columns: '180px 4', columnGap: 10 }}>
          <SkeletonCard height={160} />
          <SkeletonCard height={140} />
          <SkeletonCard height={180} />
          <SkeletonCard height={150} />
        </div>
      ) : recipes.length === 0 ? (
        <EmptyState
          icon="📖"
          title="菜谱库是空的"
          description="推荐是从菜谱库里挑菜的，没有菜谱就没有推荐。菜谱存成 data/kitchen/recipes/ 下的纯文本文件，你也可以直接用编辑器写。"
          actionLabel="新建第一道菜"
          onAction={() => router.push('/recipes/new')}
        />
      ) : (
        <div style={{ columns: '180px 4', columnGap: 10 }}>
            {/* 新建菜谱卡 — 链接到 /recipes/new */}
            <Link href="/recipes/new"
              style={{
                breakInside: 'avoid',
                marginBottom: 10,
                borderRadius: 14,
                border: '1.5px dashed var(--primary)',
                background: 'var(--primary-soft)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: 40, cursor: 'pointer', color: 'var(--primary)', fontSize: 13, fontWeight: 600, gap: 8,
                textDecoration: 'none',
              }}
            >
              <span style={{ fontSize: 24 }}>+</span>
              <span>新建菜谱</span>
            </Link>

            {recipes.map((recipe) => (
              <WaterfallCard key={recipe.id} recipe={recipe} missingCount={missingMap[recipe.id] ?? null} cookCount={cookCountMap[recipe.id] || 0} onClick={() => setDetailRecipe(recipe)} />
            ))}
          </div>
      )}

      {/* key 让换一道菜时组件整个重挂载，省掉手动重置 state */}
      <RecipeDetailModal key={detailRecipe?.id} recipe={detailRecipe} open={!!detailRecipe} onClose={() => setDetailRecipe(null)} />
    </div>
  );
}
