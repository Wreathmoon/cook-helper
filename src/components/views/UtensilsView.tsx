'use client';

import { useState, useMemo } from 'react';
import { Modal, Form, Input, Select, message, Button } from 'antd';
import type { Utensil } from '@/types';
import { StatusDot } from '@/components/shared/StatusDot';

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: '锅具', label: '锅具' },
  { key: '电器', label: '电器' },
  { key: '其他', label: '其他' },
];

const CATEGORY_OPTIONS = [
  { value: '锅具', label: '锅具' },
  { value: '电器', label: '电器' },
  { value: '其他', label: '其他' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

export interface UtensilsViewProps {
  items: Utensil[];
  loading: boolean;
  onAdd: (values: Record<string, unknown>) => void;
  onEdit: (id: string, values: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  readOnly?: boolean;
}

// ─── View ─────────────────────────────────────────────────────────────────────

export function UtensilsView({
  items,
  loading: _loading,
  onAdd,
  onEdit,
  onDelete,
  readOnly,
}: UtensilsViewProps) {
  const [activeCat, setActiveCat] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Utensil | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = { all: 0, '锅具': 0, '电器': 0, '其他': 0 };
    items.forEach((item) => {
      stats.all += 1;
      const cat = item.category || '其他';
      if (stats[cat] !== undefined) stats[cat] += 1;
    });
    return stats;
  }, [items]);

  const visibleItems = useMemo(
    () => (activeCat === 'all' ? items : items.filter((i) => (i.category || '其他') === activeCat)),
    [items, activeCat],
  );

  const openAdd = () => {
    if (readOnly) { message.info('请登录后添加厨具'); return; }
    setEditing(null); form.resetFields(); setModalOpen(true);
  };

  const openEdit = (item: Utensil) => {
    if (readOnly) { message.info('请登录后编辑'); return; }
    setEditing(item);
    form.setFieldsValue({ name: item.name, category: item.category || '其他', note: item.note || '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editing) onEdit(editing.id, values);
      else onAdd(values);
      message.success('已保存'); setModalOpen(false);
    } catch { /* validation */ }
    finally { setSubmitting(false); }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div style={{ fontSize: 19, fontWeight: 700 }}>我的厨具</div>
          <div style={{ fontSize: 11.5, color: 'var(--tx2)', marginTop: 2 }}>
            {items.length} 件 · 菜谱可关联厨具，缺厨具的菜会提示
          </div>
        </div>
        <span style={{ flex: 1 }} />
        <span style={{ width: 180, display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid var(--line)', borderRadius: 10, padding: '6px 11px', fontSize: 12, color: 'var(--tx2)', background: 'var(--panel)' }}>
          🔍 搜索厨具…
        </span>
        <button type="button" onClick={openAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 10, border: '1px solid var(--primary-btn)', background: 'var(--primary-btn)', color: 'var(--primary-btn-tx)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          ＋ 添加厨具
        </button>
      </div>

      <div className="page-body">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '0 0 172px', borderRadius: 14, background: 'var(--panel)', border: '1px solid var(--line)', overflow: 'hidden' }}>
            {CATEGORIES.map((cat) => {
              const active = activeCat === cat.key;
              const count = categoryStats[cat.key] ?? 0;
              return (
                <div key={cat.key} onClick={() => setActiveCat(cat.key)} style={{
                  padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                  background: active ? 'var(--primary-soft)' : 'transparent',
                  color: active ? 'var(--primary)' : 'var(--tx)', fontWeight: active ? 600 : 400,
                  borderBottom: '1px solid var(--line2)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span>{cat.label}</span>
                  <span style={{ fontSize: 11.5, color: active ? 'var(--primary)' : 'var(--tx2)' }}>{count}</span>
                </div>
              );
            })}
          </div>

          <div style={{ flex: '1 1 460px', minWidth: 0, borderRadius: 14, background: 'var(--panel)', border: '1px solid var(--line)', overflow: 'hidden' }}>
            {visibleItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, fontSize: 13, color: 'var(--tx2)' }}>暂无厨具</div>
            ) : (
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', background: 'var(--hover)', fontSize: 11.5, color: 'var(--tx2)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>
                  <div style={{ width: 110, padding: '10px 14px' }}>名称</div>
                  <div style={{ width: 120, padding: '10px 14px' }}>备注</div>
                  <div style={{ flex: 1, padding: '10px 14px' }}>关联菜谱</div>
                  <div style={{ width: 80, padding: '10px 14px' }}>操作</div>
                </div>
                {visibleItems.map((item) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--line2)', fontSize: 12.5 }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}>
                    <div style={{ width: 110, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary-soft)', flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ color: 'var(--tx)' }}>{item.name}</span>
                    </div>
                    <div style={{ width: 120, padding: '10px 14px', color: 'var(--tx2)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.note || '-'}
                    </div>
                    <div style={{ flex: 1, padding: '10px 14px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10.5, borderRadius: 7, padding: '1px 8px', background: 'var(--hover)', color: 'var(--tx2)', whiteSpace: 'nowrap' }}>
                        暂无关联
                      </span>
                    </div>
                    <div style={{ width: 80, padding: '10px 14px' }}>
                      <button type="button" onClick={() => openEdit(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: 12, textDecoration: 'underline', padding: 0 }}>
                        ✏ 编辑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--tx2)', marginTop: 12, textAlign: 'center' }}>
          缺厨具的菜谱会在推荐里标红提示；删除入口在编辑弹窗内
        </div>

        <Modal title={editing ? '编辑厨具' : '添加厨具'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} confirmLoading={submitting} destroyOnHidden>
          <Form form={form} layout="vertical">
            <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入厨具名称' }]}><Input /></Form.Item>
            <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}><Select options={CATEGORY_OPTIONS} /></Form.Item>
            <Form.Item name="note" label="备注"><Input.TextArea rows={2} /></Form.Item>
            {editing && (
              <Form.Item>
                <Button danger icon={<span>🗑</span>} onClick={() => { onDelete(editing.id); setModalOpen(false); }}>删除此厨具</Button>
              </Form.Item>
            )}
          </Form>
        </Modal>
      </div>
    </>
  );
}
