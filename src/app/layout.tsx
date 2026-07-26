import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { AntdRegistry } from '@/components/layout/antd-registry';
import { AppLayout } from '@/components/layout/app-layout';
import { ReadOnlyProvider } from '@/components/layout/read-only-provider';
import { isReadOnly } from '@/lib/vault';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Cook Helper',
  description: '智能烹饪助手',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const readOnly = isReadOnly();

  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body>
        <AntdRegistry>
          <ThemeProvider>
            <ReadOnlyProvider value={readOnly}>
              <AppLayout readOnly={readOnly}>{children}</AppLayout>
            </ReadOnlyProvider>
          </ThemeProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
