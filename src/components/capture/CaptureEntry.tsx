'use client';

/**
 * AI 录入的入口按钮。
 *
 * 三个状态，每一个都对应 Task/11 里一条写下来的决策：
 *
 * | 状态 | 表现 | 决策 |
 * |------|------|------|
 * | 只读沙盒 | 灰掉，点了说明为什么 | ⑪ 拦在入口，不烧 token |
 * | 没配好 | **显示但灰掉**，点了告诉你缺哪个环境变量 | ⑩ |
 * | 可用 | 正常 | — |
 *
 * ⚠️ **不要在没配好时把按钮藏起来。** 藏起来的功能等于不存在——用户不会知道
 * 配了 key 能换来什么。这和 Task/10 记忆页那条「未生效要明示」是同一条原则。
 */

import { useEffect, useState } from 'react';
import { Button, message } from 'antd';
import { aiCaptureStatusAction } from '@/app/actions/capture';
import { CapturePanel } from './CapturePanel';

export interface CaptureEntryProps {
  defaultMode?: 'photo' | 'receipt' | 'text';
  label?: string;
  onApplied?: () => void;
}

export function CaptureEntry({ defaultMode = 'photo', label = 'AI 录入', onApplied }: CaptureEntryProps) {
  const [status, setStatus] = useState<{ enabled: boolean; reason: string | null } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await aiCaptureStatusAction();
        if (!cancelled) setStatus(res);
      } catch {
        // 状态查不到就当不可用——比让用户点进去再失败好
        if (!cancelled) setStatus({ enabled: false, reason: '读取 AI 配置失败' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const disabled = status !== null && !status.enabled;

  const handleClick = () => {
    if (status === null) return;
    if (!status.enabled) {
      // 用 info 不用 error：没配 key 不是错误，是还没配
      message.info(status.reason ?? 'AI 录入当前不可用', 6);
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <Button
        size="small"
        onClick={handleClick}
        loading={status === null}
        style={disabled ? { opacity: 0.55 } : undefined}
        title={disabled ? (status?.reason ?? undefined) : undefined}
      >
        {label}
      </Button>
      <CapturePanel
        open={open}
        onClose={() => setOpen(false)}
        defaultMode={defaultMode}
        onApplied={onApplied}
      />
    </>
  );
}
