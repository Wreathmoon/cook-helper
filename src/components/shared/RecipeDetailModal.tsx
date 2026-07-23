'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { Spin, message } from 'antd';
import { getRecipeDetailForCalendar, addCalendarEntryAction } from '@/app/actions/calendar';
import { getPhotoUrl } from '@/app/actions/recipe';
import type { Recipe, StockLevel, Difficulty } from '@/types';
import type { RecipeDetail } from '@/lib/services/recipe';
import { StatusDot, type StatusDotStatus } from './StatusDot';

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

const STOCK_TEXT: Record<StockLevel, string> = {
  enough: '充足',
  low: '不多了',
  out: '没了',
};

const STOCK_COLOR: Record<StockLevel, string> = {
  enough: 'var(--success)',
  low: 'var(--warn)',
  out: 'var(--danger)',
};

const STOCK_DOT: Record<StockLevel, StatusDotStatus> = {
  enough: 'good',
  low: 'warn',
  out: 'bad',
};

function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

export function RecipeDetailModal({
  recipe,
  open,
  onClose,
}: {
  recipe: Recipe | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [galIdx, setGalIdx] = useState(0);
  const [cooking, setCooking] = useState(false);

  useEffect(() => {
    if (!open || !recipe) {
      setDetail(null);
      setPhotoUrls([]);
      setGalIdx(0);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await getRecipeDetailForCalendar(recipe.id);
        if (cancelled) return;
        if (res.data) {
          setDetail(res.data);
          if (res.data.photos.length > 0) {
            const urls = await Promise.all(res.data.photos.map((p) => getPhotoUrl(p.storage_path)));
            if (!cancelled) setPhotoUrls(urls);
          } else {
            setPhotoUrls([]);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, recipe]);

  if (!open || !recipe) return null;

  const missingCount = detail
    ? detail.ingredients.filter((i) => !i.inventory || i.inventory.stock_level !== 'enough').length
    : 0;

  const tags: string[] = [
    ...(recipe.attributes?.method || []),
    ...(recipe.attributes?.spiciness ? [recipe.attributes.spiciness] : []),
    ...(recipe.attributes?.greasiness ? [recipe.attributes.greasiness] : []),
    ...(recipe.attributes?.flavor ? [recipe.attributes.flavor] : []),
    ...(recipe.attributes?.diet_type ? [recipe.attributes.diet_type] : []),
    ...(recipe.attributes?.nutrition || []),
    ...(recipe.attributes?.scene || []),
    ...(recipe.attributes?.cuisine ? [recipe.attributes.cuisine] : []),
    ...(recipe.difficulty ? [DIFFICULTY_LABEL[recipe.difficulty]] : []),
  ];

  const metaParts: string[] = [];
  if (recipe.attributes?.method?.length) metaParts.push(recipe.attributes.method.join('/'));
  if (recipe.cook_time_minutes) metaParts.push(`${recipe.cook_time_minutes} 分钟`);
  if (detail?.utensils.length) {
    metaParts.push(`需要：${detail.utensils.map((u) => u.utensil_name).join('、')}`);
  }

  const galN = photoUrls.length;

  const handleCook = async () => {
    setCooking(true);
    try {
      const res = await addCalendarEntryAction({
        date: todayStr(),
        recipe_id: recipe.id,
        status: 'planned',
      });
      if (res.error) {
        message.error(res.error);
      } else {
        message.success(`已把「${recipe.name}」写进今天的日历`);
        onClose();
      }
    } catch {
      message.error('操作失败');
    } finally {
      setCooking(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(30,20,12,.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        animation: 'modal-overlay-fade 0.15s ease both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 900,
          maxWidth: '94vw',
          height: 580,
          maxHeight: '88vh',
          display: 'flex',
          overflow: 'hidden',
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {/* 左侧图片轮播 */}
        <div style={{ width: '46%', flex: 'none', position: 'relative', background: 'var(--hover)' }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, var(--primary-soft), var(--hover))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--tx2)',
              fontSize: 12,
            }}
          >
            {galN > 0 ? (
              <img
                src={photoUrls[galIdx]}
                alt={recipe.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              '暂无成品照'
            )}
          </div>
          {galN > 1 && (
            <>
              <span
                onClick={() => setGalIdx((i) => (i + galN - 1) % galN)}
                style={navBtnStyle('left')}
              >
                ‹
              </span>
              <span onClick={() => setGalIdx((i) => (i + 1) % galN)} style={navBtnStyle('right')}>
                ›
              </span>
              <div
                style={{
                  position: 'absolute',
                  bottom: 12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  gap: 6,
                }}
              >
                {photoUrls.map((_, i) => (
                  <span
                    key={i}
                    onClick={() => setGalIdx(i)}
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      cursor: 'pointer',
                      background: i === galIdx ? 'var(--primary)' : 'var(--line)',
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* 右侧内容 */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '22px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 13,
            minWidth: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 19, fontWeight: 700, color: 'var(--tx)' }}>{recipe.name}</span>
            {detail && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: 'var(--hover)',
                  border: '1px solid var(--line2)',
                  borderRadius: 7,
                  padding: '1px 7px',
                  fontSize: 10.5,
                  color: 'var(--tx2)',
                }}
              >
                {missingCount === 0 ? '食材全齐' : `缺 ${missingCount} 样`}
              </span>
            )}
            <span style={{ flex: 1 }} />
            <span
              onClick={onClose}
              style={{ cursor: 'pointer', fontSize: 14, color: 'var(--tx2)' }}
            >
              ✕
            </span>
          </div>

          {metaParts.length > 0 && (
            <span style={{ fontSize: 11.5, color: 'var(--tx2)' }}>{metaParts.join(' · ')}</span>
          )}

          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {tags.map((t, i) => (
                <span
                  key={`${t}-${i}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: 'var(--hover)',
                    border: '1px solid var(--line2)',
                    borderRadius: 7,
                    padding: '1px 7px',
                    fontSize: 10.5,
                    color: 'var(--tx2)',
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Spin />
            </div>
          ) : (
            <>
              {detail && detail.ingredients.length > 0 && (
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>食材清单</span>
                  <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
                    {detail.ingredients.map((ing) => {
                      const level = (ing.inventory?.stock_level as StockLevel) || 'out';
                      return (
                        <div
                          key={ing.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 9,
                            padding: '7px 2px',
                            borderBottom: '1px solid var(--line2)',
                          }}
                        >
                          <StatusDot status={STOCK_DOT[level]} />
                          <span style={{ flex: 1, fontSize: 12.5, color: 'var(--tx)' }}>
                            {ing.inventory?.name || '已删除的食材'}
                            {ing.amount ? ` · ${ing.amount}` : ''}
                          </span>
                          <span style={{ fontSize: 11.5, color: STOCK_COLOR[level] }}>
                            {ing.inventory ? STOCK_TEXT[level] : '未知'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {recipe.steps && recipe.steps.length > 0 && (
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>步骤</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 7 }}>
                    {[...recipe.steps]
                      .sort((a, b) => a.step_number - b.step_number)
                      .map((s) => (
                        <div key={s.step_number} style={{ display: 'flex', gap: 9 }}>
                          <span
                            style={{
                              flex: 'none',
                              width: 18,
                              height: 18,
                              borderRadius: '50%',
                              background: 'var(--primary-soft)',
                              color: 'var(--primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {s.step_number}
                          </span>
                          <span style={{ fontSize: 12.5, color: 'var(--tx)' }}>{s.description}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {recipe.tips && (
                <div
                  style={{
                    background: 'var(--primary-soft)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontSize: 12,
                    color: 'var(--primary)',
                  }}
                >
                  <b>Tips</b> · {recipe.tips}
                </div>
              )}
            </>
          )}

          <div
            style={{
              display: 'flex',
              gap: 9,
              borderTop: '1px solid var(--line2)',
              paddingTop: 14,
              marginTop: 'auto',
            }}
          >
            <button
              type="button"
              onClick={handleCook}
              disabled={cooking}
              style={{
                flex: 1,
                padding: 9,
                borderRadius: 10,
                border: '1px solid var(--primary-btn)',
                background: 'var(--primary-btn)',
                color: 'var(--primary-btn-tx)',
                fontWeight: 600,
                fontSize: 13,
                cursor: cooking ? 'default' : 'pointer',
                opacity: cooking ? 0.7 : 1,
              }}
            >
              今天做它 → 写入日历
            </button>
            <button
              type="button"
              onClick={() => router.push('/recipes')}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: '1px solid transparent',
                background: 'var(--primary-soft)',
                color: 'var(--primary)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              ✏ 编辑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function navBtnStyle(side: 'left' | 'right'): CSSProperties {
  return {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    [side]: 12,
    width: 30,
    height: 30,
    borderRadius: '50%',
    background: 'var(--panel)',
    border: '1px solid var(--line)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--tx)',
    fontSize: 13,
    boxShadow: 'var(--shadow-card)',
  };
}
