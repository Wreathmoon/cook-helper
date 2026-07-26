'use client';

import { useEffect, useState, useCallback } from 'react';
import { message } from 'antd';
import { getListUtensils, addUtensilAction, updateUtensilAction, deleteUtensilAction } from '@/app/actions/utensil';
import type { Utensil } from '@/types';

/** 表单交上来的形状 —— 与 addUtensilAction / updateUtensilAction 的入参一致 */
interface UtensilFormValues {
  name: string;
  category?: string;
  note?: string;
}
import { UtensilsView } from '@/components/views';

export default function UtensilsPage() {
  const [items, setItems] = useState<Utensil[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getListUtensils();
      if (res.data) setItems(res.data);
      else if (res.error) message.error(res.error);
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  }, []);

  // 首屏加载写成带取消标记的 async IIFE：setState 落在 await 之后，
  // 组件已经卸载就不再写状态（也顺带满足 react-hooks/set-state-in-effect）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getListUtensils();
        if (cancelled) return;
        if (res.data) setItems(res.data);
        else if (res.error) message.error(res.error);
      } catch {
        if (!cancelled) message.error('加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleAdd = async (values: Record<string, unknown>) => {
    const res = await addUtensilAction(values as unknown as UtensilFormValues);
    if (res.error) message.error(res.error);
    else { message.success('添加成功'); fetchData(); }
  };

  const handleEdit = async (id: string, values: Record<string, unknown>) => {
    const res = await updateUtensilAction(id, values as unknown as UtensilFormValues);
    if (res.error) message.error(res.error);
    else { message.success('已更新'); fetchData(); }
  };

  const handleDelete = async (id: string) => {
    const res = await deleteUtensilAction(id);
    if (res.error) message.error(res.error);
    else { message.success('已删除'); fetchData(); }
  };

  return (
    <UtensilsView
      items={items} loading={loading}
      onAdd={handleAdd} onEdit={handleEdit} onDelete={handleDelete}
    />
  );
}
