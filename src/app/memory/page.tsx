'use client';

import { useEffect, useState, useCallback } from 'react';
import { message } from 'antd';
import { getListMemories, deleteMemoryAction } from '@/app/actions/memory';
import type { MemoryOverview } from '@/lib/services/memory';
import { MemoryView } from '@/components/views';

const EMPTY: MemoryOverview = {
  effective: [],
  ineffective: [],
  expired: [],
  aiConfigured: false,
  memoryDir: 'memory/',
};

export default function MemoryPage() {
  const [data, setData] = useState<MemoryOverview>(EMPTY);
  const [loading, setLoading] = useState(true);
  // 加载失败要**留在页面上**，不能只弹 toast：解析失败时列表是空的，
  // 而空列表会渲染成「还没有任何记忆」——文件明明都在，页面却说一条都没有
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getListMemories();
      if (res.error) message.error(res.error);
      setError(res.error);
      setData(res.data);
    } catch { message.error('加载失败'); setError('加载失败'); }
    finally { setLoading(false); }
  }, []);

  // 首屏加载写成带取消标记的 async IIFE：setState 落在 await 之后，
  // 组件已经卸载就不再写状态（也顺带满足 react-hooks/set-state-in-effect）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getListMemories();
        if (cancelled) return;
        if (res.error) message.error(res.error);
        setError(res.error);
        setData(res.data);
      } catch {
        if (!cancelled) { message.error('加载失败'); setError('加载失败'); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleDelete = async (id: string) => {
    const res = await deleteMemoryAction(id);
    if (res.error) message.error(res.error);
    else { message.success('已删除'); fetchData(); }
  };

  return <MemoryView data={data} loading={loading} error={error} onDelete={handleDelete} />;
}
