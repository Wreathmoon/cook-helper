'use client';
import React from 'react';
import { useServerInsertedHTML } from 'next/navigation';
import { StyleProvider, createCache, extractStyle } from '@ant-design/cssinjs';

export function AntdRegistry({ children }: { children: React.ReactNode }) {
  const cache = React.useMemo(() => createCache(), []);
  useServerInsertedHTML(() => {
    return <style id="antd-cssinjs">{extractStyle(cache, true)}</style>;
  });
  return <StyleProvider cache={cache}>{children}</StyleProvider>;
}
