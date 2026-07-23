'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { TEXT } from '@/lib/constants/text';
import { getListRecipes, deleteRecipeAction } from '@/app/actions/recipe';
import type { Recipe } from '@/types';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusDot } from '@/components/shared/StatusDot';
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

function getStatus(recipe: Recipe): 'good' | 'warn' | 'bad' {
  const methods = recipe.attributes?.method || [];
  if (methods.length > 0) return 'good';
  return 'warn';
}

function WaterfallCard({ recipe, onClick }: { recipe: Recipe; onClick: () => void }) {
  const imgHeight = 92 + ((recipe.id.length * 7) % 61);
  const methods = recipe.attributes?.method || [];

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
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--tx)' }}>{recipe.name}</div>
        <div style={{ fontSize: 11, color: 'var(--tx2)' }}>
          {recipe.attributes?.flavor || recipe.attributes?.cuisine || `${methods.join('、') || '家常'}`}
        </div>
        <div style={{ height: 1, background: 'var(--line2)', margin: '4px 0' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <StatusDot status={getStatus(recipe)} />
            <span style={{ color: 'var(--tx2)' }}>
              {methods.length > 0 ? '食材全齐' : '缺食材'}
            </span>
          </div>
          <span style={{ color: 'var(--tx2)' }}>{recipe.created_at ? '已做' : ''} · {recipe.cook_time_minutes || '-'}分</span>
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

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    try {
      const filters: Record<string, unknown> = {};
      if (methodFilter.length > 0 && methodFilter[0]) filters.method = [methodFilter[0]];
      if (spicyFilter.length > 0 && spicyFilter[0]) filters.spiciness = spicyFilter[0];
      if (search) filters.search = search;

      const res = await getListRecipes(Object.keys(filters).length > 0 ? filters as any : undefined);
      if (res.data) setRecipes(res.data);
      else if (res.error) message.error(res.error);
    } catch {
      message.error(TEXT.common.error);
    } finally {
      setLoading(false);
    }
  }, [search, methodFilter, spicyFilter]);

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
        <Button type="primary" icon={<PlusOutlined />}>{TEXT.recipes.addRecipe}</Button>
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
          {/* 新建菜谱卡 */}
          <div
            style={{
              breakInside: 'avoid',
              marginBottom: 12,
              borderRadius: 14,
              border: '1.5px dashed var(--primary)',
              background: 'var(--primary-soft)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: 40, cursor: 'pointer', color: 'var(--primary)', fontSize: 13, fontWeight: 600, gap: 8,
            }}
          >
            <span style={{ fontSize: 24 }}>+</span>
            <span>新建菜谱</span>
          </div>

          {recipes.map((recipe) => (
            <WaterfallCard key={recipe.id} recipe={recipe} onClick={() => setDetailRecipe(recipe)} />
          ))}
        </div>
      )}

      <RecipeDetailModal recipe={detailRecipe} open={!!detailRecipe} onClose={() => setDetailRecipe(null)} />
    </div>
  );
}
