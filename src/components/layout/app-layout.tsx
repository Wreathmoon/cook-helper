'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useThemeStore } from '@/store/theme-store';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';

type IconProps = { size?: number };

const iconProps = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 16 16',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

function RecommendIcon({ size = 16 }: IconProps) {
  return (
    <svg {...iconProps(size)}>
      <path d="M8 1.5l1.2 3.6L13 6.5l-3.8 1.4L8 11.5l-1.2-3.6L3 6.5l3.8-1.4z" />
    </svg>
  );
}

function RecipesIcon({ size = 16 }: IconProps) {
  return (
    <svg {...iconProps(size)}>
      <rect x="2.5" y="3" width="11" height="10" rx="1.2" />
      <path d="M8 3v10" />
      <path d="M4.5 6h2M4.5 8.5h2M9.5 6h2M9.5 8.5h2" />
    </svg>
  );
}

function InventoryIcon({ size = 16 }: IconProps) {
  return (
    <svg {...iconProps(size)}>
      <path d="M2.5 6.5h11l-1 6.5a1 1 0 0 1-1 .85H4.5a1 1 0 0 1-1-.85z" />
      <path d="M5.5 6.5 8 2.5l2.5 4" />
      <path d="M6 9v2.5M10 9v2.5" />
    </svg>
  );
}

function UtensilsIcon({ size = 16 }: IconProps) {
  return (
    <svg {...iconProps(size)}>
      <path d="M3 7h10v2.5a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4z" />
      <path d="M2 7h12" />
      <path d="M4 7V5.5M12 7V5.5" />
    </svg>
  );
}

function CalendarIcon({ size = 16 }: IconProps) {
  return (
    <svg {...iconProps(size)}>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11" />
      <path d="M5.5 2v3M10.5 2v3" />
    </svg>
  );
}

interface NavItem {
  key: string;
  label: string;
  icon: React.ComponentType<IconProps>;
}

const NAV_ITEMS: NavItem[] = [
  { key: '/recommend', label: '推荐', icon: RecommendIcon },
  { key: '/calendar', label: '日历', icon: CalendarIcon },
  { key: '/recipes', label: '菜谱', icon: RecipesIcon },
  { key: '/inventory', label: '食材', icon: InventoryIcon },
  { key: '/utensils', label: '厨具', icon: UtensilsIcon },
];

function MainNav() {
  const pathname = usePathname();

  return (
    <nav style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 12px' }}>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.key || pathname?.startsWith(`${item.key}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            href={item.key}
            title={item.label}
            className="nav-item"
            style={{
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              color: active ? 'var(--primary)' : 'var(--tx)',
              background: active ? 'var(--primary-soft)' : 'transparent',
              textDecoration: 'none',
            }}
          >
            <Icon size={16} />
            <span className="nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppLayout({
  children,
  readOnly = false,
}: {
  children: React.ReactNode;
  /** 只读沙盒（cook.wreathmoon.com）。本地跑永远是 false */
  readOnly?: boolean;
}) {
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)' }}>
      {/* 侧边栏 — 响应式由 CSS .layout-side + @media 驱动 */}
      <aside className="layout-side" style={{ padding: '16px 12px 14px', gap: 2 }}>
        <div className="logo-text" style={{ display: 'flex', justifyContent: 'center', padding: '8px 8px 18px' }}>
          <span className="nav-label" style={{ fontSize: 16, fontWeight: 800, color: 'var(--tx)' }}>
            做饭小助手
          </span>
        </div>

        <MainNav />

        <div className="user-area" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 8px 0', borderTop: '1px solid var(--line)', marginTop: 'auto' }}>
          <div className="user-text" style={{ minWidth: 0, flex: 1 }}>
            <b style={{ fontSize: 12, color: 'var(--tx)' }}>本机</b>
            <div style={{ fontSize: 10.5, color: 'var(--tx2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              数据在你自己的磁盘上
            </div>
          </div>
          <button
            type="button" onClick={toggleTheme}
            title={isDarkMode ? '切换到浅色' : '切换到深色'}
            style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--tx)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}
          >
            {isDarkMode ? <MoonOutlined /> : <SunOutlined />}
          </button>
        </div>
      </aside>

      {/* 主内容区 */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
        {readOnly && (
          <div style={{ position: 'sticky', top: 0, zIndex: 10, padding: '8px 16px', background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: 12, textAlign: 'center', fontWeight: 600 }}>
            只读演示实例 —— 改动不会被保存
          </div>
        )}
        {/* 必须是 flex column + minHeight:0：页面内容是 .page-head + .page-body 两个兄弟，
            而 .page-body 靠 `flex:1; overflow:auto` 成为滚动容器。这里若是 block，
            .page-body 的 flex 失效 → 高度变成内容高度 → overflow:auto 永不触发，
            超出的部分被本容器 overflow:hidden 裁掉且滚不到。minHeight:0 用来解除
            flex item 的默认 min-height:auto，否则它仍会被内容撑破而不是让子级滚动。 */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
