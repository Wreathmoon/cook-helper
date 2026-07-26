'use client';

import { useEffect, useState, useCallback } from 'react';
import { message } from 'antd';
import { getListUtensils, addUtensilAction, updateUtensilAction, deleteUtensilAction } from '@/app/actions/utensil';
import type { Utensil } from '@/types';
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

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async (values: Record<string, unknown>) => {
    const res = await addUtensilAction(values as any);
    if (res.error) message.error(res.error);
    else { message.success('添加成功'); fetchData(); }
  };

  const handleEdit = async (id: string, values: Record<string, unknown>) => {
    const res = await updateUtensilAction(id, values as any);
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
