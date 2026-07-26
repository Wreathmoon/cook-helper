'use client';

import { useEffect, useState, useCallback } from 'react';
import { message } from 'antd';
import { getListInventory, addInventoryItemAction, updateInventoryItemAction, deleteInventoryItemAction } from '@/app/actions/inventory';
import type { InventoryItem, StockLevel } from '@/types';
import { InventoryView } from '@/components/views';

/** 表单交上来的形状 —— 与 addInventoryItemAction 的入参一致 */
interface InventoryFormValues {
  name: string;
  category: string;
  total_amount?: string;
  stock_level?: string;
  unit?: string;
  note?: string;
  price?: number;
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getListInventory();
      if (res.data) setItems(res.data);
      if (res.error) message.error(res.error);
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  }, []);

  // 首屏加载写成带取消标记的 async IIFE：setState 落在 await 之后，
  // 组件已经卸载就不再写状态（也顺带满足 react-hooks/set-state-in-effect）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getListInventory();
        if (cancelled) return;
        if (res.data) setItems(res.data);
        if (res.error) message.error(res.error);
      } catch {
        if (!cancelled) message.error('加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleAdd = async (values: Record<string, unknown>) => {
    const res = await addInventoryItemAction(values as unknown as InventoryFormValues);
    if (res.error) message.error(res.error);
    else { message.success('添加成功'); fetchData(); }
  };

  const handleEdit = async (id: string, values: Record<string, unknown>) => {
    const res = await updateInventoryItemAction(id, values);
    if (res.error) message.error(res.error);
    else { message.success('已更新'); fetchData(); }
  };

  const handleDelete = async (id: string) => {
    const res = await deleteInventoryItemAction(id);
    if (res.error) message.error(res.error);
    else { message.success('已删除'); fetchData(); }
  };

  const handleStockChange = async (id: string, level: StockLevel) => {
    const res = await updateInventoryItemAction(id, { stock_level: level });
    if (res.error) message.error(res.error);
    else { message.success('库存已更新'); fetchData(); }
  };

  return (
    <InventoryView
      items={items} loading={loading}
      onAdd={handleAdd} onEdit={handleEdit} onDelete={handleDelete}
      onStockChange={handleStockChange}
    />
  );
}
