'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useThemeStore } from '@/store/theme-store';
import { signOut } from '@/app/actions/auth';

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

const NAV_ITEMS = [
  { key: '/recommend', label: '智能推荐', icon: RecommendIcon },
  { key: '/recipes', label: '菜谱库', icon: RecipesIcon },
  { key: '/inventory', label: '食材库存', icon: InventoryIcon },
  { key: '/utensils', label: '我的厨具', icon: UtensilsIcon },
  { key: '/calendar', label: '烹饪日历', icon: CalendarIcon },
];

export interface AppLayoutUser {
  email?: string | null;
  name?: string | null;
}

export function AppLayout({
  children,
  user,
}: {
  children: React.ReactNode;
  user?: AppLayoutUser | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  const displayName = user?.name || user?.email || '游客';
  const displayEmail = user?.email && user?.email !== displayName ? user.email : null;
  const initial = displayName.charAt(0).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)' }}>
      <aside
        style={{
          width: 208,
          flexShrink: 0,
          background: 'var(--side)',
          borderRight: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            padding: '24px 16px 20px',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'var(--logo-gradient)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            CH
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>Cook Helper</div>
        </div>

        <nav
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            padding: '4px 12px',
          }}
        >
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.key || pathname?.startsWith(`${item.key}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 16px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--primary)' : 'var(--tx)',
                  background: active ? 'var(--primary-soft)' : 'transparent',
                  textDecoration: 'none',
                }}
              >
                <Icon />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: '12px 16px 16px',
            borderTop: '1px solid var(--line)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                flexShrink: 0,
                background: 'var(--primary-soft)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {initial}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--tx)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {displayName}
              </div>
              {displayEmail && (
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--tx2)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {displayEmail}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={toggleTheme}
              style={{
                flex: 1,
                height: 26,
                borderRadius: 8,
                border: '1px solid var(--line)',
                background: 'var(--panel)',
                color: 'var(--tx)',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <span aria-hidden>◐</span>
              {isDarkMode ? '深色' : '浅色'}
            </button>
            {user && (
              <button
                type="button"
                onClick={handleSignOut}
                title="退出登录"
                style={{
                  width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                  border: '1px solid var(--line)',
                  background: 'var(--panel)', color: 'var(--tx2)',
                  fontSize: 12, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                ↩
              </button>
            )}
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, overflowX: 'auto', height: '100vh' }}>
        <div style={{ minWidth: 1000, padding: 24 }}>{children}</div>
      </main>
    </div>
  );
}
