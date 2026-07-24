'use client';
import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useThemeStore } from '@/store/theme-store';
import { signOut } from '@/app/actions/auth';
import { Button } from 'antd';
import { UserOutlined, SunOutlined, MoonOutlined } from '@ant-design/icons';

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

const AUTH_NAV_ITEMS: NavItem[] = [
  { key: '/recommend', label: '推荐', icon: RecommendIcon },
  { key: '/calendar', label: '日历', icon: CalendarIcon },
  { key: '/recipes', label: '菜谱', icon: RecipesIcon },
  { key: '/inventory', label: '食材', icon: InventoryIcon },
  { key: '/utensils', label: '厨具', icon: UtensilsIcon },
];

const TAB_KEYS = ['recommend', 'calendar', 'recipes', 'inventory', 'utensils'];

type SidebarMode = 'full' | 'icon' | 'compact';

function GuestNav({ mode }: { mode: SidebarMode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'recommend';
  const iconOnly = mode !== 'full';

  return (
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
      {AUTH_NAV_ITEMS.map((item, i) => {
        const tabKey = TAB_KEYS[i];
        const active = pathname === '/demo' && activeTab === tabKey;
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            href={`/demo?tab=${tabKey}`}
            title={iconOnly ? item.label : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: iconOnly ? 'center' : 'flex-start',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              color: active ? 'var(--primary)' : 'var(--tx)',
              background: active ? 'var(--primary-soft)' : 'transparent',
              textDecoration: 'none',
            }}
          >
            <Icon size={16} />
            {!iconOnly && item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function AuthNav({ mode }: { mode: SidebarMode }) {
  const pathname = usePathname();
  const iconOnly = mode !== 'full';

  return (
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
      {AUTH_NAV_ITEMS.map((item) => {
        const active = pathname === item.key || pathname?.startsWith(`${item.key}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            href={item.key}
            title={iconOnly ? item.label : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: iconOnly ? 'center' : 'flex-start',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              color: active ? 'var(--primary)' : 'var(--tx)',
              background: active ? 'var(--primary-soft)' : 'transparent',
              textDecoration: 'none',
            }}
          >
            <Icon size={16} />
            {!iconOnly && item.label}
          </Link>
        );
      })}
    </nav>
  );
}

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
  const router = useRouter();
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const isGuest = !user;

  const displayName = user?.name || user?.email || '游客';
  const initial = displayName.charAt(0).toUpperCase();

  const [sidebarMode, setSidebarMode] = React.useState<SidebarMode>('full');

  React.useEffect(() => {
    const updateMode = () => {
      const w = window.innerWidth;
      if (w > 820) setSidebarMode('full');
      else if (w > 560) setSidebarMode('icon');
      else setSidebarMode('compact');
    };
    updateMode();
    window.addEventListener('resize', updateMode);
    return () => window.removeEventListener('resize', updateMode);
  }, []);

  const iconOnly = sidebarMode !== 'full';
  const paddingSize = sidebarMode === 'compact' ? '12px' : '24px 20px';

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)' }}>
      <aside
        style={{
          width: iconOnly ? 56 : 214,
          flexShrink: 0,
          background: 'var(--side)',
          borderRight: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
        }}
      >
        {!iconOnly && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px 16px 16px',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--tx)' }}>做饭小助手</div>
          </div>
        )}

        {isGuest ? (
          <Suspense fallback={<nav style={{ flex: 1 }} />}>
            <GuestNav mode={sidebarMode} />
          </Suspense>
        ) : (
          <AuthNav mode={sidebarMode} />
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: '12px 16px 16px',
            borderTop: '1px solid var(--line)',
          }}
        >
          {isGuest ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
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
                  游
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: 'var(--tx)',
                    }}
                  >
                    游客
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleTheme}
                  title={isDarkMode ? '切换到浅色' : '切换到深色'}
                  style={{
                    width: 24,
                    height: 24,
                    marginLeft: 'auto',
                    flexShrink: 0,
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    background: 'var(--panel)',
                    color: 'var(--tx)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isDarkMode ? <MoonOutlined /> : <SunOutlined />}
                </button>
              </div>
              <Button
                type="primary"
                block
                size="small"
                icon={<UserOutlined />}
                onClick={() => router.push('/login')}
              >
                登录 / 注册
              </Button>
            </>
          ) : (
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
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                title={isDarkMode ? '切换到浅色' : '切换到深色'}
                style={{
                  width: 24,
                  height: 24,
                  marginLeft: 'auto',
                  flexShrink: 0,
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  background: 'var(--panel)',
                  color: 'var(--tx)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isDarkMode ? <MoonOutlined /> : <SunOutlined />}
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                title="退出登录"
                style={{
                  width: 24,
                  height: 24,
                  flexShrink: 0,
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  background: 'var(--panel)',
                  color: 'var(--tx2)',
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ↩
              </button>
            </div>
          )}
        </div>
      </aside>

      <main style={{ flex: 1, overflow: 'hidden', height: '100vh', position: 'relative' }}>
        <div style={{ height: '100%', overflow: 'auto', padding: paddingSize }}>{children}</div>
      </main>
    </div>
  );
}
