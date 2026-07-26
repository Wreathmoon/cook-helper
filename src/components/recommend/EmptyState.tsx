'use client';

export function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div
      className="card"
      style={{
        padding: '44px 24px',
        textAlign: 'center',
        borderStyle: 'dashed',
        boxShadow: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'var(--primary-soft)',
          color: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
        }}
      >
        🍳
      </div>
      <b style={{ fontSize: 15 }}>当前筛选下没有能推荐的菜</b>
      <span style={{ fontSize: 12, color: 'var(--tx2)', maxWidth: 280 }}>
        推荐会综合库存、保质期和你的厨具来挑菜。放宽筛选，或去补几样食材试试。
      </span>
      <button
        type="button"
        onClick={onClear}
        style={{
          marginTop: 2,
          padding: '6px 20px',
          borderRadius: 10,
          border: '1px solid var(--primary-btn)',
          background: 'var(--primary-btn)',
          color: 'var(--primary-btn-tx)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        清除筛选条件
      </button>
    </div>
  );
}
