'use client';

import { createContext, useContext } from 'react';

/**
 * 只读沙盒开关，从服务端的 `READ_ONLY` 环境变量一路传到客户端组件。
 *
 * ⚠️ **这只是 UX**：真正拦住写入的是服务端的 `assertWritable()`（`src/lib/vault/writer.ts`）。
 * 客户端这层的作用是**别让用户白填一个表单再被拒绝**，不是安全边界。
 */
const ReadOnlyContext = createContext(false);

export function ReadOnlyProvider({
  value,
  children,
}: {
  value: boolean;
  children: React.ReactNode;
}) {
  return <ReadOnlyContext.Provider value={value}>{children}</ReadOnlyContext.Provider>;
}

export function useReadOnly(): boolean {
  return useContext(ReadOnlyContext);
}

/** 只读模式下所有写操作的统一文案 —— 说明这是演示实例，并给出出路 */
export const READ_ONLY_TIP = '这是只读演示实例，改动不会被保存。想自己用的话，把仓库 clone 到本地跑一份。';
