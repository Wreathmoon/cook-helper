import type { CSSProperties } from 'react';

export function SkeletonCard({
  height = 160,
  style,
}: {
  height?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        borderRadius: 14,
        background: 'var(--panel)',
        border: '1px solid var(--line2)',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        ...style,
      }}
    >
      <div className="sk-shimmer" style={{ height: height * 0.62, borderRadius: 10 }} />
      <div className="sk-shimmer" style={{ height: 12, width: '70%', borderRadius: 4 }} />
      <div className="sk-shimmer" style={{ height: 10, width: '45%', borderRadius: 4 }} />
    </div>
  );
}
