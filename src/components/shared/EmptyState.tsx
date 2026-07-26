'use client';

/**
 * 通用空态。
 *
 * 三件事缺一不可（设计稿 3o 规范）：**一个图标 + 一句「为什么要填」 + 单一主行动**。
 * 空白列表不解释自己，用户就会以为是坏了；而「为什么要填」比「这里是空的」有用得多——
 * 本地部署的第一分钟正是靠这几句话决定要不要留下来。
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: string;
  title: string;
  /** 说清楚填了它能换来什么，不要只说「暂无数据」 */
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      style={{
        padding: '56px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 11,
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
        {icon}
      </div>
      <b style={{ fontSize: 14.5, color: 'var(--tx)' }}>{title}</b>
      <span style={{ fontSize: 12, color: 'var(--tx2)', maxWidth: 300, lineHeight: 1.7 }}>
        {description}
      </span>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
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
          {actionLabel}
        </button>
      )}
    </div>
  );
}
