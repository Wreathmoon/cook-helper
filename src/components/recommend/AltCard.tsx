'use client';

import type { RecommendedRecipe, RecommendTier } from '@/types';
import { StatusDot } from '@/components/shared/StatusDot';

const TIER_DOT: Record<RecommendTier, 'good' | 'warn' | 'notice'> = {
  can_make_now: 'good',
  need_shopping: 'warn',
  clear_stock: 'notice',
};

function altFeature(rec: RecommendedRecipe) {
  const r = rec.recipe;
  if (rec.missingIngredients?.length) {
    return { text: `缺: ${rec.missingIngredients.slice(0, 2).join('/')}`, cls: 'ty' };
  }
  if (rec.clearStockIngredients?.length) {
    return { text: `${rec.clearStockIngredients[0]} 已放多天，建议先吃`, cls: 'to' };
  }
  if (r.cook_time_minutes && r.cook_time_minutes <= 15) {
    return { text: `${r.cook_time_minutes}分钟快手，全齐能直接做`, cls: 'tg' };
  }
  if (r.attributes?.cuisine || r.attributes?.flavor) {
    return { text: r.attributes?.flavor || r.attributes?.cuisine || '家常美味', cls: '' };
  }
  return { text: '家常美味', cls: '' };
}

export function AltCard({
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
  const dotStatus = TIER_DOT[rec.tier];
  const feature = altFeature(rec);

  return (
    <div
      className="card-hover"
      onClick={onClick}
      style={{
        flex: '1 1 220px',
        minWidth: 200,
        maxWidth: 300,
        borderRadius: 14,
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        boxShadow: 'var(--shadow-card)',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <StatusDot status={dotStatus} />
        <b style={{ fontSize: 14, flex: 1, minWidth: 0 }}>{r.name}</b>
        <span
          className={`cb${checked ? ' on' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        />
      </div>
      <span className={feature.cls} style={{ fontSize: 12 }}>
        {feature.text}
      </span>
    </div>
  );
}
