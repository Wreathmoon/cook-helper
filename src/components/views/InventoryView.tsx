'use client';

import { useState, useMemo } from 'react';
import { Segmented, Modal, Form, Input, InputNumber, Select, DatePicker, message, Button } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { InventoryItem, InventoryCategory, StockLevel } from '@/types';
import { StatusDot } from '@/components/shared/StatusDot';
import { EmptyState } from '@/components/shared/EmptyState';
import { useReadOnly, READ_ONLY_TIP } from '@/components/layout/read-only-provider';

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
  if (item.stock_level === 'out') return { text: '已提示购物清单', color: 'var(--warn)' };
  const threshold = item.category === 'vegetable' ? 3 : item.category === 'meat' ? 5 : 7;
  if (days >= threshold && days > 0) return { text: `${days}天前入库 · 建议先吃`, color: 'var(--notice)' };
  if (days > 0) return { text: `${days}天前入库`, color: 'var(--tx2)' };
  // 没写入库日期 ≠ 刚买回来。vault 里 last_restocked_at 是可选的，
  // 没有它就是「不知道多久了」——也因此永远不会被判为该清库存
  if (days < 0) return { text: '未记录入库时间', color: 'var(--tx2)' };
  return { text: '刚入库', color: 'var(--tx2)' };
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface InventoryViewProps {
  items: InventoryItem[];
  loading: boolean;
  onAdd: (values: Record<string, unknown>) => void;
  onEdit: (id: string, values: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onStockChange: (id: string, level: StockLevel) => void;
  readOnly?: boolean;
}

// ─── View ─────────────────────────────────────────────────────────────────────

export function InventoryView({
  items,
  loading: _loading,
  onAdd,
  onEdit,
  onDelete,
  onStockChange,
  readOnly: readOnlyProp,
}: InventoryViewProps) {
  // 页面不必逐个传：只读状态从根布局的 ReadOnlyProvider 兜底。
  // hook 必须无条件调用，不能写成 `readOnlyProp ?? useReadOnly()`——`??` 会短路掉它
  const contextReadOnly = useReadOnly();
  const readOnly = readOnlyProp ?? contextReadOnly;
  const [activeCat, setActiveCat] = useState<InventoryCategory | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [pulsingId, setPulsingId] = useState<string | null>(null);

  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; alert: boolean }> = { all: { count: 0, alert: false } };
    CATEGORIES.forEach((c) => { if (c.key !== 'all') stats[c.key] = { count: 0, alert: false }; });
    items.forEach((item) => {
      stats.all.count += 1;
      stats[item.category].count += 1;
      if (item.stock_level !== 'enough') { stats.all.alert = true; stats[item.category].alert = true; }
    });
    return stats;
  }, [items]);

  const visibleItems = useMemo(
    () => (activeCat === 'all' ? items : items.filter((i) => i.category === activeCat)),
    [items, activeCat],
  );

  const openAdd = () => {
    if (readOnly) { message.info(READ_ONLY_TIP); return; }
    setEditing(null); form.resetFields(); form.setFieldsValue({ stock_level: 'enough' }); setModalOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    if (readOnly) { message.info(READ_ONLY_TIP); return; }
    setEditing(item);
    form.setFieldsValue({ ...item, last_restocked_at: item.last_restocked_at ? dayjs(item.last_restocked_at) : null });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload = { ...values, last_restocked_at: values.last_restocked_at ? values.last_restocked_at.toISOString() : null };
      if (editing) onEdit(editing.id, payload);
      else onAdd(payload);
      message.success('已保存'); setModalOpen(false);
    } catch { /* validation */ }
    finally { setSubmitting(false); }
  };

  const handleStockChange = (item: InventoryItem, level: StockLevel) => {
    if (readOnly) { message.info(READ_ONLY_TIP); return; }
    setPulsingId(item.id);
    onStockChange(item.id, level);
    setTimeout(() => setPulsingId(null), 500);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div style={{ fontSize: 19, fontWeight: 700 }}>食材库存</div>
          <div style={{ fontSize: 11.5, color: 'var(--tx2)', marginTop: 2 }}>
            {items.length} 种食材 · {items.filter(i => i.stock_level === 'out').length} 种没了 · {items.filter(i => i.stock_level === 'low').length} 种不多了
          </div>
        </div>
        <span style={{ flex: 1 }} />
        <span style={{ width: 180, display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid var(--line)', borderRadius: 10, padding: '6px 11px', fontSize: 12, color: 'var(--tx2)', background: 'var(--panel)' }}>
          🔍 搜索食材…
        </span>
        <button type="button" onClick={openAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 10, border: '1px solid var(--primary-btn)', background: 'var(--primary-btn)', color: 'var(--primary-btn-tx)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          ＋ 添加食材
        </button>
      </div>

      <div className="page-body">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* 左侧分类 */}
          <div style={{ flex: '0 0 172px', borderRadius: 14, background: 'var(--panel)', border: '1px solid var(--line)', overflow: 'hidden' }}>
            {CATEGORIES.map((cat) => {
              const active = activeCat === cat.key;
              const stat = categoryStats[cat.key] ?? { count: 0, alert: false };
              return (
                <div key={cat.key} onClick={() => setActiveCat(cat.key)} style={{
                  padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                  background: active ? 'var(--primary-soft)' : 'transparent',
                  color: active ? 'var(--primary)' : 'var(--tx)', fontWeight: active ? 600 : 400,
                  borderBottom: '1px solid var(--line2)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span>{cat.label}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {stat.alert && <StatusDot status="bad" />}
                    <span style={{ fontSize: 11.5, color: active ? 'var(--primary)' : 'var(--tx2)' }}>{stat.count}</span>
                  </span>
                </div>
              );
            })}
          </div>

          {/* 右侧表格 */}
          <div style={{ flex: '1 1 460px', minWidth: 0, borderRadius: 14, background: 'var(--panel)', border: '1px solid var(--line)', overflow: 'hidden' }}>
            {visibleItems.length === 0 ? (
              <EmptyState
                icon="🥬"
                title={activeCat === 'all' ? '库存还是空的' : '这个分类下还没有食材'}
                description="推荐是按「你现在有什么」算出来的——库存空着，首页就没菜可推。先把冰箱里常备的几样填进来，剩下的随手补。"
                actionLabel={readOnly ? undefined : '＋ 添加食材'}
                onAction={readOnly ? undefined : openAdd}
              />
            ) : (
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', background: 'var(--hover)', fontSize: 11.5, color: 'var(--tx2)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>
                  <div style={{ width: 110, padding: '10px 14px' }}>名称</div>
                  <div style={{ width: 176, padding: '10px 14px' }}>库存档位·点击即存</div>
                  <div style={{ flex: 1, padding: '10px 14px' }}>提示</div>
                </div>
                {visibleItems.map((item) => {
                  const hint = getHint(item);
                  return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--line2)', fontSize: 12.5, cursor: 'pointer' }}
                      onClick={() => openEdit(item)}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}>
                      <div style={{ width: 110, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <StatusDot status={getStockDot(item.stock_level)} />
                        <span style={{ color: 'var(--tx)' }}>{item.name}</span>
                      </div>
                      <div style={{ width: 176, padding: '8px 14px' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ animation: pulsingId === item.id ? 'savedpulse 0.5s ease' : undefined }}>
                          <Segmented
                            value={item.stock_level}
                            onChange={(val) => handleStockChange(item, val as StockLevel)}
                            options={STOCK_LEVELS.map((opt) => ({
                              ...opt,
                              style: { background: item.stock_level === opt.value ? getStockBg(opt.value) : undefined, color: item.stock_level === opt.value ? 'var(--tx)' : undefined },
                            }))}
                            size="small"
                          />
                        </div>
                      </div>
                      <div style={{ flex: 1, padding: '10px 14px', fontSize: 11.5, color: hint.color }}>{hint.text}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <Modal title={editing ? '编辑食材' : '添加食材'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} confirmLoading={submitting} destroyOnHidden>
          <Form form={form} layout="vertical">
            <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}><Input /></Form.Item>
            <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}><Select options={CATEGORY_OPTIONS} /></Form.Item>
            <Form.Item name="stock_level" label="库存档位"><Select options={STOCK_LEVELS} /></Form.Item>
            <Form.Item name="last_restocked_at" label="入库时间"><DatePicker style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="price" label="参考价（元）" tooltip="随手记一下平时多少钱，购物清单里会显示，方便估算这趟要花多少">
              <InputNumber min={0} step={1} style={{ width: '100%' }} placeholder="可不填" />
            </Form.Item>
            {editing && (
              <Form.Item>
                <Button danger icon={<DeleteOutlined />} onClick={() => { onDelete(editing.id); setModalOpen(false); }}>删除</Button>
              </Form.Item>
            )}
          </Form>
        </Modal>
      </div>
    </>
  );
}
