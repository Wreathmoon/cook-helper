'use client';
import React from 'react';
import { Layout, Menu, Button, theme as antTheme } from 'antd';
import {
  HomeOutlined,
  ShoppingCartOutlined,
  ToolOutlined,
  BookOutlined,
  CalendarOutlined,
  ExperimentOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SunOutlined,
  MoonOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { usePathname, useRouter } from 'next/navigation';
import { useUIStore } from '@/store/ui-store';
import { useThemeStore } from '@/store/theme-store';
import { TEXT } from '@/lib/constants/text';
import { signOut } from '@/app/actions/auth';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/recommend', icon: <HomeOutlined />, label: TEXT.nav.recommend },
  { key: '/inventory', icon: <ShoppingCartOutlined />, label: TEXT.nav.inventory },
  { key: '/utensils', icon: <ToolOutlined />, label: TEXT.nav.utensils },
  { key: '/recipes', icon: <BookOutlined />, label: TEXT.nav.recipes },
  { key: '/calendar', icon: <CalendarOutlined />, label: TEXT.nav.calendar },
  { key: '/demo', icon: <ExperimentOutlined />, label: TEXT.nav.demo },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { isDarkMode, toggleTheme } = useThemeStore();
  const { token } = antTheme.useToken();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={sidebarCollapsed}
        breakpoint="md"
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: sidebarCollapsed ? 16 : 20,
            fontWeight: 'bold',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {sidebarCollapsed ? 'CH' : TEXT.common.appName}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[pathname]}
          items={menuItems}
          onClick={({ key }) => router.push(key)}
        />
      </Sider>
      <Layout style={{ marginLeft: sidebarCollapsed ? 80 : 200, transition: 'all 0.2s' }}>
        <Header
          style={{
            padding: '0 24px',
            background: token.colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}
        >
          <Button
            type="text"
            icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={toggleSidebar}
            style={{ fontSize: 16 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button
              type="text"
              icon={isDarkMode ? <SunOutlined /> : <MoonOutlined />}
              onClick={toggleTheme}
              style={{ fontSize: 16 }}
            />
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={() => signOut()}
              title={TEXT.nav.logout}
              style={{ fontSize: 16 }}
            />
          </div>
        </Header>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            background: token.colorBgContainer,
            borderRadius: token.borderRadiusLG,
            minHeight: 280,
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
