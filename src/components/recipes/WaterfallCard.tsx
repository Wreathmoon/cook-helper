'use client';

import { StatusDot, type StatusDotStatus } from '@/components/shared/StatusDot';
import type { Recipe } from '@/types';

interface WaterfallCardProps {
  recipe: Recipe;
  /** 缺几样食材；null = 加载中 */
  missingCount: number | null;
  /** 做过几次；不传则不显示 */
  cookCount?: number;
  onClick: () => void;
}

export function WaterfallCard({ recipe, missingCount, cookCount, onClick }: WaterfallCardProps) {
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
        marginBottom: 10,
        borderRadius: 14,
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform .15s, box-shadow .15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 14px rgba(60,50,30,.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = '';
      }}
    >
      <div
        style={{
          height: imgHeight,
          background: 'linear-gradient(135deg, var(--primary-soft), var(--hover))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--tx2)',
          fontSize: 11,
        }}
      >
        菜品照
      </div>
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: 'var(--tx)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {recipe.name}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--tx2)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {desc}
        </div>
        <div style={{ height: 1, background: 'var(--line2)', margin: '4px 0' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <StatusDot status={status} />
            <span style={{ color: 'var(--tx2)' }}>{statusText}</span>
          </div>
          {cookCount !== undefined && (
            <span style={{ color: 'var(--tx2)' }}>做过{cookCount}次</span>
          )}
        </div>
      </div>
    </div>
  );
}
