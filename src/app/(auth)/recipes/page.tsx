'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { TEXT } from '@/lib/constants/text';
import { getListRecipes, deleteRecipeAction, getRecipeDetailAction } from '@/app/actions/recipe';
import { getCalendarEntriesAction } from '@/app/actions/calendar';
import type { Recipe } from '@/types';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusDot, type StatusDotStatus } from '@/components/shared/StatusDot';
import { FilterChips } from '@/components/shared/FilterChips';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { RecipeDetailModal } from '@/components/shared/RecipeDetailModal';

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

function WaterfallCard({
  recipe,
  missingCount,
  cookCount,
  onClick,
}: {
  recipe: Recipe;
  missingCount: number | null;
  cookCount: number;
  onClick: () => void;
}) {
  const imgHeight = 92 + ((recipe.id.length * 7) % 61);
  const methods = recipe.attributes?.method || [];
  const desc = recipe.attributes?.flavor || recipe.attributes?.cuisine || methods.join('、') || '家常美味';

  const status: StatusDotStatus = missingCount === null ? 'notice' : missingCount === 0 ? 'good' : 'warn';
  const statusText = missingCount === null ? '加载中...' : missingCount === 0 ? '食材全齐' : `缺${missingCount}样`;

  return (
    <div
      onClick={onClick}
      className="card-hover"
      style={{
        breakInside: 'avoid',
        marginBottom: 12,
        borderRadius: 14,
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          height: imgHeight,
          background: 'linear-gradient(135deg, var(--primary-soft), var(--hover))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--tx2)', fontSize: 11,
        }}
      >
        菜品照
      </div>
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {recipe.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--tx2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {desc}
        </div>
        <div style={{ height: 1, background: 'var(--line2)', margin: '4px 0' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <StatusDot status={status} />
            <span style={{ color: 'var(--tx2)' }}>{statusText}</span>
          </div>
          <span style={{ color: 'var(--tx2)' }}>做过{cookCount}次</span>
        </div>
      </div>
    </div>
  );
}

export default function RecipesPage() {
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

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    try {
      const filters: Record<string, unknown> = {};
      if (methodFilter.length > 0 && methodFilter[0]) filters.method = [methodFilter[0]];
      if (spicyFilter.length > 0 && spicyFilter[0]) filters.spiciness = spicyFilter[0];
      if (search) filters.search = search;

      const res = await getListRecipes(Object.keys(filters).length > 0 ? filters as any : undefined);
      if (res.data) {
        setRecipes(res.data);
        fetchExtras(res.data);
      } else if (res.error) message.error(res.error);
    } catch {
      message.error(TEXT.common.error);
    } finally {
      setLoading(false);
    }
  }, [search, methodFilter, spicyFilter, fetchExtras]);

  useEffect(() => { fetchRecipes(); }, [fetchRecipes]);

  const handleDelete = async (id: string) => {
    const res = await deleteRecipeAction(id);
    if (res.error) message.error(res.error);
    else { message.success(TEXT.common.success); fetchRecipes(); }
  };

  return (
    <div>
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
        <div style={{ columns: '176px 4', columnGap: 12 }}>
          <SkeletonCard height={160} />
          <SkeletonCard height={140} />
          <SkeletonCard height={180} />
          <SkeletonCard height={150} />
        </div>
      ) : recipes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80, fontSize: 13, color: 'var(--tx2)' }}>
          还没有菜谱，点击右上角新建
        </div>
      ) : (
        <div style={{ columns: '176px 4', columnGap: 12 }}>
          {/* 新建菜谱卡 — 链接到 /recipes/new */}
          <Link href="/recipes/new"
            style={{
              breakInside: 'avoid',
              marginBottom: 12,
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

      <RecipeDetailModal recipe={detailRecipe} open={!!detailRecipe} onClose={() => setDetailRecipe(null)} />
    </div>
  );
}
