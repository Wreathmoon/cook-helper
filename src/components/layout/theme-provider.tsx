'use client';
import React from 'react';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useThemeStore } from '@/store/theme-store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
      }}
    >
      {children}
    </ConfigProvider>
  );
}
