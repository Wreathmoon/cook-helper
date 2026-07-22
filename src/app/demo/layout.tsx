'use client';
import React from 'react';
import { Layout, Menu, Button, Tag, theme as antTheme } from 'antd';
import {
  HomeOutlined,
  ShoppingCartOutlined,
  ToolOutlined,
  BookOutlined,
  CalendarOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SunOutlined,
  MoonOutlined,
  LoginOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/ui-store';
import { useThemeStore } from '@/store/theme-store';
import { TEXT } from '@/lib/constants/text';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: 'recommend', icon: <HomeOutlined />, label: TEXT.nav.recommend },
  { key: 'inventory', icon: <ShoppingCartOutlined />, label: TEXT.nav.inventory },
  { key: 'utensils', icon: <ToolOutlined />, label: TEXT.nav.utensils },
  { key: 'recipes', icon: <BookOutlined />, label: TEXT.nav.recipes },
  { key: 'calendar', icon: <CalendarOutlined />, label: TEXT.nav.calendar },
];

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
          items={menuItems}
          onClick={({ key }) => router.push(`/demo?tab=${key}`)}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            width: '100%',
            padding: '16px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <Button
            type="primary"
            block
            icon={<LoginOutlined />}
            onClick={() => router.push('/login')}
          >
            {!sidebarCollapsed && TEXT.nav.login}
          </Button>
          <Button
            block
            icon={<UserAddOutlined />}
            onClick={() => router.push('/register')}
            style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}
          >
            {!sidebarCollapsed && TEXT.nav.register}
          </Button>
        </div>
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
            <Tag color="orange" style={{ fontSize: 13, padding: '2px 10px' }}>
              {TEXT.demo.title}
            </Tag>
            <Button
              type="text"
              icon={isDarkMode ? <SunOutlined /> : <MoonOutlined />}
              onClick={toggleTheme}
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
