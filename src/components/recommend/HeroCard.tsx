'use client';

import type { RecommendedRecipe, RecommendTier } from '@/types';
import { NoPhotoCard } from './NoPhotoCard';
import { StatusDot } from '@/components/shared/StatusDot';

const TIER_META: Record<RecommendTier, { label: string; cls: string; dot: 'good' | 'warn' | 'notice' }> = {
  can_make_now: { label: '现在就能做', cls: 'tg', dot: 'good' },
  need_shopping: { label: '差一两样', cls: 'ty', dot: 'warn' },
  clear_stock: { label: '该清库存了', cls: 'to', dot: 'notice' },
};

function buildReasons(rec: RecommendedRecipe) {
  const reasons: { color: 'g' | 'y' | 'o' | 'soft'; text: string }[] = [];
  const r = rec.recipe;

  if (rec.clearStockIngredients?.length) {
    reasons.push({ color: 'o', text: `${rec.clearStockIngredients.join('、')} 已放多天，建议尽快吃` });
  }
  if (rec.missingIngredients?.length) {
    reasons.push({ color: 'y', text: `缺 ${rec.missingIngredients.join('、')}，买齐就能做` });
  } else {
    reasons.push({ color: 'g', text: '食材全齐，随时能做 ✓' });
  }
  if (r.cook_time_minutes && r.cook_time_minutes <= 15) {
    reasons.push({ color: 'g', text: `快手菜，只需 ${r.cook_time_minutes} 分钟` });
  }
  if (rec.reason) reasons.push({ color: 'soft', text: rec.reason });
  if (reasons.length === 0) reasons.push({ color: 'soft', text: '为你精选 ✨' });
  return reasons.slice(0, 3);
}

const dotColorMap = { g: 'var(--success)', y: 'var(--warn)', o: 'var(--notice)', soft: 'var(--primary-soft)' };

export function HeroCard({
  rec,
  onCook,
  onSwap,
  onOpen,
}: {
  rec: RecommendedRecipe;
  onCook: () => void;
  onSwap: () => void;
  onOpen?: () => void;
}) {
  const r = rec.recipe;
  const meta = TIER_META[rec.tier];
  const reasons = buildReasons(rec);

  return (
    <div
      className="card-hover"
      style={{
        flex: 1,
        minWidth: 0,
        position: 'relative',
        borderRadius: 14,
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        boxShadow: 'var(--shadow-card)',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* 右上角徽标 */}
      <span
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          fontSize: 10.5,
          fontWeight: 700,
          borderRadius: 99,
          padding: '2px 10px',
          background: 'var(--hover)',
        }}
        className={meta.cls}
      >
        {meta.label}
      </span>

      <div style={{ display: 'flex', gap: 13 }}>
        <NoPhotoCard name={r.name} onClick={onOpen} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {/* 菜名 + 状态点 */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
            onClick={onOpen}
          >
            <StatusDot status={meta.dot} />
            <b style={{ fontSize: 17, minWidth: 0 }}>{r.name}</b>
          </div>

          {/* 标签 */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {r.attributes?.cuisine && (
              <span className="chip" style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 7, border: '1px solid var(--line)', padding: '1px 7px', fontSize: 10.5, color: 'var(--tx2)' }}>
                {r.attributes.cuisine}
              </span>
            )}
            {r.attributes?.method?.map((m) => (
              <span key={m} className="chip" style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 7, border: '1px solid var(--line)', padding: '1px 7px', fontSize: 10.5, color: 'var(--tx2)' }}>
                {m}
              </span>
            ))}
            {r.cook_time_minutes && (
              <span className="chip" style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 7, border: '1px solid var(--line)', padding: '1px 7px', fontSize: 10.5, color: 'var(--tx2)' }}>
                ⏱ {r.cook_time_minutes}分
              </span>
            )}
          </div>

          {/* 推荐理由 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 1 }}>
            {reasons.map((reason, i) => (
              <div key={i} className="reason-row">
                <span
                  className="dot"
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: dotColorMap[reason.color],
                    marginTop: 5,
                  }}
                />
                <span>{reason.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 按钮区 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onCook}
          style={{
            flex: 1,
            padding: '8px 16px',
            borderRadius: 10,
            border: '1px solid var(--primary-btn)',
            background: 'var(--primary-btn)',
            color: 'var(--primary-btn-tx)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          就做这道
        </button>
        <button
          type="button"
          onClick={onSwap}
          style={{
            padding: '8px 16px',
            borderRadius: 10,
            border: '1px solid var(--line)',
            background: 'var(--panel)',
            color: 'var(--tx)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          换一个
        </button>
      </div>
    </div>
  );
}
