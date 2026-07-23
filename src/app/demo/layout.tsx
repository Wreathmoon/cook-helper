'use client';
import React, { Suspense } from 'react';
import { Button } from 'antd';
import { LoginOutlined, UserAddOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useThemeStore } from '@/store/theme-store';
import { TEXT } from '@/lib/constants/text';

const NAV_ITEMS = [
  { key: '/demo?tab=recommend', label: '智能推荐' },
  { key: '/demo?tab=recipes', label: '菜谱库' },
  { key: '/demo?tab=inventory', label: '食材库存' },
  { key: '/demo?tab=utensils', label: '我的厨具' },
  { key: '/demo?tab=calendar', label: '烹饪日历' },
];

function DemoNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <nav style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 12px' }}>
      {NAV_ITEMS.map((item) => {
        const itemTab = new URLSearchParams(item.key.split('?')[1] || '').get('tab') || 'recommend';
        const active = pathname === '/demo' && searchParams.get('tab') === itemTab;
        return (
          <Link key={item.key} href={item.key}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 16px', borderRadius: 10,
              fontSize: 13, fontWeight: active ? 600 : 400,
              color: active ? 'var(--primary)' : 'var(--tx)',
              background: active ? 'var(--primary-soft)' : 'transparent',
              textDecoration: 'none',
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)' }}>
      <aside style={{
        width: 208, flexShrink: 0, background: 'var(--side)',
        borderRight: '1px solid var(--line)',
        display: 'flex', flexDirection: 'column', height: '100vh',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 16px 20px' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'var(--logo-gradient)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 16, fontWeight: 700,
          }}>CH</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>Cook Helper</div>
        </div>

        <Suspense fallback={<nav style={{ flex: 1 }} />}>
          <DemoNav />
        </Suspense>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 16px 16px', borderTop: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: 'var(--primary-soft)', color: 'var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700,
            }}>游</div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--tx)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>游客</div>
              <div style={{ fontSize: 11, color: 'var(--tx2)' }}>只读 Demo</div>
            </div>
          </div>
          <Button type="primary" block size="small" icon={<LoginOutlined />} onClick={() => window.location.href = '/login'}>
            登录
          </Button>
          <Button block size="small" icon={<UserAddOutlined />} onClick={() => window.location.href = '/register'}
            style={{ color: 'var(--tx)', borderColor: 'var(--line)' }}>
            免费注册
          </Button>
          <button type="button" onClick={toggleTheme}
            style={{
              height: 26, borderRadius: 8, border: '1px solid var(--line)',
              background: 'var(--panel)', color: 'var(--tx)', fontSize: 12,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
            <span aria-hidden>◐</span> {isDarkMode ? '深色' : '浅色'}
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, overflowX: 'auto', height: '100vh' }}>
        <div
          style={{
            padding: '8px 16px',
            background: 'var(--warn-bg)',
            color: 'var(--warn)',
            fontSize: 12,
            textAlign: 'center',
            fontWeight: 600,
          }}
        >
          只读体验 Demo · 演示数据 · 修改功能已锁定
        </div>
        <div style={{ minWidth: 1000, padding: 24 }}>{children}</div>
      </main>
    </div>
  );
}
