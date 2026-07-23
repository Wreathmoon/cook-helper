'use client';
import React, { useEffect } from 'react';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useThemeStore } from '@/store/theme-store';

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', Roboto, sans-serif";

const lightToken = {
  colorPrimary: '#c25742',
  colorInfo: '#c25742',
  colorBgBase: '#f7f0e9',
  colorBgLayout: '#f7f0e9',
  colorBgContainer: '#ffffff',
  colorBgElevated: '#ffffff',
  colorBorder: '#ead9c9',
  colorBorderSecondary: '#f1e4d6',
  colorText: '#2f2a21',
  colorTextSecondary: '#98907f',
  colorTextTertiary: '#98907f',
  colorSuccess: '#67923d',
  colorWarning: '#c79016',
  colorError: '#c9503c',
  colorLink: '#bc4f38',
  borderRadius: 10,
  borderRadiusLG: 14,
  borderRadiusSM: 7,
  fontFamily: FONT_FAMILY,
  fontSize: 13,
};

const darkToken = {
  colorPrimary: '#d0664c',
  colorInfo: '#d0664c',
  colorBgBase: '#191310',
  colorBgLayout: '#191310',
  colorBgContainer: '#211a15',
  colorBgElevated: '#211a15',
  colorBorder: '#32271f',
  colorBorderSecondary: '#2c2119',
  colorText: '#ece5d7',
  colorTextSecondary: '#8f8574',
  colorTextTertiary: '#8f8574',
  colorSuccess: '#8fbf5e',
  colorWarning: '#d9aa3c',
  colorError: '#e07a62',
  colorLink: '#e08268',
  borderRadius: 10,
  borderRadiusLG: 14,
  borderRadiusSM: 7,
  fontFamily: FONT_FAMILY,
  fontSize: 13,
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const isDarkMode = useThemeStore((state) => state.isDarkMode);

  useEffect(() => {
    document.documentElement.classList.toggle('dk', isDarkMode);
  }, [isDarkMode]);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: isDarkMode ? darkToken : lightToken,
        components: {
          Button: {
            colorTextLightSolid: isDarkMode ? '#fff7f2' : '#ffffff',
          },
          Layout: {
            siderBg: isDarkMode ? '#140f0c' : '#faf5ef',
            bodyBg: isDarkMode ? '#191310' : '#f7f0e9',
          },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
