'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button, Segmented, Modal, Form, Input, Select, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { TEXT } from '@/lib/constants/text';
import { getListInventory, addInventoryItemAction, updateInventoryItemAction, deleteInventoryItemAction } from '@/app/actions/inventory';
import type { InventoryItem, InventoryCategory, StockLevel } from '@/types';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusDot } from '@/components/shared/StatusDot';

const CATEGORIES: { key: InventoryCategory | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'vegetable', label: '蔬菜' },
  { key: 'meat', label: '肉类' },
  { key: 'egg_dairy_bean', label: '蛋奶豆' },
  { key: 'staple', label: '主食干货' },
  { key: 'seasoning', label: '调料' },
];

const CATEGORY_OPTIONS = CATEGORIES.filter((c) => c.key !== 'all').map((c) => ({ value: c.key, label: c.label }));

const STOCK_LEVELS: { value: StockLevel; label: string }[] = [
  { value: 'enough', label: '充足' },
  { value: 'low', label: '不多' },
  { value: 'out', label: '没了' },
];

function getStockDot(s: StockLevel): 'good' | 'warn' | 'bad' {
  return s === 'enough' ? 'good' : s === 'low' ? 'warn' : 'bad';
}

function getStockBg(s: StockLevel): string {
  return s === 'enough' ? 'var(--success-bg)' : s === 'low' ? 'var(--warn-bg)' : 'var(--danger-bg)';
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return -1;
  const d = new Date(dateStr);
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function getHint(item: InventoryItem): { text: string; color: string } {
  const days = daysSince(item.last_restocked_at);
  if (item.stock_level === 'out') return { text: '已提示到购物清单', color: 'var(--warn)' };

  const threshold = item.category === 'vegetable' ? 3 : item.category === 'meat' ? 5 : 7;
  if (days >= threshold && days > 0) return { text: `${days}天前入库 · 建议先吃`, color: 'var(--notice)' };
  if (days > 0) return { text: `${days}天前入库`, color: 'var(--tx2)' };
  return { text: '刚入库', color: 'var(--tx2)' };
}

const categoryCount: Record<string, number> = {};

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<InventoryCategory | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const cat = activeCat === 'all' ? undefined : activeCat;
      const res = await getListInventory(cat);
      if (res.data) setItems(res.data);
      else if (res.error) message.error(res.error);
    } catch {
      message.error(TEXT.common.error);
    } finally {
      setLoading(false);
    }
  }, [activeCat]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalItems = items.length;

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ stock_level: 'enough' });
    setModalOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditing(item);
    form.setFieldsValue(item);
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const res = editing
        ? await updateInventoryItemAction(editing.id, values)
        : await addInventoryItemAction(values);
      if (res.error) message.error(res.error);
      else { message.success(TEXT.common.success); setModalOpen(false); fetchData(); }
    } catch { /* validation */ } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    const res = await deleteInventoryItemAction(id);
    if (res.error) message.error(res.error);
    else { message.success(TEXT.common.success); fetchData(); }
  };

  const handleStockChange = async (item: InventoryItem, level: StockLevel) => {
    const res = await updateInventoryItemAction(item.id, { ...item, stock_level: level });
    if (res.error) message.error(res.error);
    else fetchData();
  };

  return (
    <div>
      <PageHeader title="食材库存" subtitle={`${totalItems} 项食材`}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>{TEXT.inventory.addIngredient}</Button>
      </PageHeader>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* 左侧分类 */}
        <div style={{ width: 172, flexShrink: 0, borderRadius: 14, background: 'var(--panel)', border: '1px solid var(--line)', overflow: 'hidden' }}>
          {CATEGORIES.map((cat) => {
            const active = activeCat === cat.key;
            return (
              <div
                key={cat.key}
                onClick={() => setActiveCat(cat.key)}
                style={{
                  padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                  background: active ? 'var(--primary-soft)' : 'transparent',
                  color: active ? 'var(--primary)' : 'var(--tx)',
                  fontWeight: active ? 600 : 400,
                  borderBottom: '1px solid var(--line2)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span>{cat.label}</span>
              </div>
            );
          })}
        </div>

        {/* 右侧表格 */}
        <div style={{ flex: 1, borderRadius: 14, background: 'var(--panel)', border: '1px solid var(--line)', overflow: 'hidden' }}>
          {items.length === 0 && !loading ? (
            <div style={{ textAlign: 'center', padding: 60, fontSize: 13, color: 'var(--tx2)' }}>暂无食材</div>
          ) : (
            <div style={{ width: '100%' }}>
              {/* 表头 */}
              <div style={{ display: 'flex', background: 'var(--hover)', fontSize: 11.5, color: 'var(--tx2)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>
                <div style={{ width: 130, padding: '10px 14px' }}>名称</div>
                <div style={{ width: 90, padding: '10px 14px' }}>总量</div>
                <div style={{ width: 190, padding: '10px 14px' }}>库存档位</div>
                <div style={{ flex: 1, padding: '10px 14px' }}>提示</div>
                <div style={{ width: 60, padding: '10px 14px' }}>操作</div>
              </div>
              {/* 行 */}
              {items.map((item) => {
                const hint = getHint(item);
                return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--line2)', fontSize: 12.5 }}>
                    <div style={{ width: 130, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StatusDot status={getStockDot(item.stock_level)} />
                      <span style={{ color: 'var(--tx)' }}>{item.name}</span>
                    </div>
                    <div style={{ width: 90, padding: '10px 14px', color: 'var(--tx2)' }}>{item.total_amount || '-'}</div>
                    <div style={{ width: 190, padding: '8px 14px' }}>
                      <Segmented
                        value={item.stock_level}
                        onChange={(val) => handleStockChange(item, val as StockLevel)}
                        options={STOCK_LEVELS.map((opt) => ({
                          ...opt,
                          style: {
                            background: item.stock_level === opt.value ? getStockBg(opt.value) : undefined,
                            color: item.stock_level === opt.value ? 'var(--tx)' : undefined,
                          },
                        }))}
                        size="small"
                      />
                    </div>
                    <div style={{ flex: 1, padding: '10px 14px', fontSize: 11.5, color: hint.color }}>{hint.text}</div>
                    <div style={{ width: 60, padding: '10px 14px' }}>
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx2)', fontSize: 14 }}
                      >
                        ✏
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 编辑弹窗 */}
      <Modal
        title={editing ? '编辑食材' : '添加食材'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select options={CATEGORY_OPTIONS} />
          </Form.Item>
          <Form.Item name="total_amount" label="大概总量">
            <Input placeholder="如：300g、2个" />
          </Form.Item>
          <Form.Item name="stock_level" label="库存档位">
            <Select options={STOCK_LEVELS} />
          </Form.Item>
          {editing && (
            <Form.Item>
              <Button danger icon={<DeleteOutlined />} onClick={() => { handleDelete(editing.id); setModalOpen(false); }}>
                删除
              </Button>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
