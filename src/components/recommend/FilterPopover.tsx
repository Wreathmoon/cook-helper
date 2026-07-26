'use client';

import { FilterOutlined } from '@ant-design/icons';

interface FilterDimension {
  key: string;
  label: string;
  tags: string[];
}

interface FilterPopoverProps {
  dimensions: FilterDimension[];
  filters: Record<string, string[]>;
  onToggleTag: (dimKey: string, tag: string) => void;
  onClearAll: () => void;
  onClose: () => void;
  poolCount: number;
}

export function FilterPopover({
  dimensions,
  filters,
  onToggleTag,
  onClearAll,
  onClose,
  poolCount,
}: FilterPopoverProps) {
  const filterCount = Object.values(filters).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div style={{ position: 'relative' }}>
      {/* Filter button */}
      <button
        type="button"
        onClick={onClose}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 14px',
          borderRadius: 10,
          border: `1px solid ${filterCount > 0 ? 'var(--primary)' : 'var(--line)'}`,
          background: filterCount > 0 ? 'var(--primary-soft)' : 'var(--panel)',
          color: filterCount > 0 ? 'var(--primary)' : 'var(--tx)',
          fontSize: 12.5,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <FilterOutlined />
        筛选
        {filterCount > 0 && (
          <span
            style={{
              background: 'var(--primary-btn)',
              color: 'var(--primary-btn-tx)',
              borderRadius: 99,
              fontSize: 10,
              fontWeight: 700,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {filterCount}
          </span>
        )}
      </button>

      {/* Popover */}
      <div
        style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: 340,
          maxWidth: 'calc(100vw - 40px)',
          zIndex: 50,
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          boxShadow: 'var(--shadow-card-hover)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          animation: 'popin 0.14s ease both',
        }}
      >
        {/* Scrim background */}
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            background: 'transparent',
          }}
        />

        {dimensions.map((dim) => (
          <div key={dim.key}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--tx2)', marginBottom: 7 }}>
              {dim.label}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {dim.tags.map((tag) => {
                const selected = (filters[dim.key] || []).includes(tag);
                return (
                  <span
                    key={tag}
                    onClick={() => onToggleTag(dim.key, tag)}
                    className={selected ? 'tag-sel' : 'tag'}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '4px 12px',
                      borderRadius: 99,
                      border: `1px solid ${selected ? 'var(--primary)' : 'var(--line)'}`,
                      background: selected ? 'var(--primary-soft)' : 'var(--panel)',
                      color: selected ? 'var(--primary)' : 'var(--tx)',
                      fontSize: 12,
                      fontWeight: selected ? 600 : 400,
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    {tag}
                  </span>
                );
              })}
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', borderTop: '1px solid var(--line2)', paddingTop: 12 }}>
          <button
            type="button"
            onClick={onClearAll}
            style={{
              padding: '6px 13px',
              borderRadius: 10,
              border: '1px solid var(--line)',
              background: 'var(--panel)',
              color: 'var(--tx)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            清空全部
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
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
            查看 {poolCount} 道
          </button>
        </div>
      </div>
    </div>
  );
}

export { type FilterDimension };
