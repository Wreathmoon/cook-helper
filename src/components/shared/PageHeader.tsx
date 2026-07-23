import React from 'react';

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 20,
      }}
    >
      <div>
        <h1 style={{ fontSize: 19, fontWeight: 700, color: 'var(--tx)', margin: 0 }}>{title}</h1>
        {subtitle && (
          <div style={{ fontSize: 12.5, color: 'var(--tx2)', marginTop: 4 }}>{subtitle}</div>
        )}
      </div>
      {children && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {children}
        </div>
      )}
    </div>
  );
}
