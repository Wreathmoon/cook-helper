'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Button, Modal, Form, Input, Select, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { TEXT } from '@/lib/constants/text';
import { getListUtensils, addUtensilAction, updateUtensilAction, deleteUtensilAction } from '@/app/actions/utensil';
import type { Utensil } from '@/types';
import { PageHeader } from '@/components/shared/PageHeader';
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

export default function UtensilsPage() {
  const [items, setItems] = useState<Utensil[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Utensil | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getListUtensils();
      if (res.data) setItems(res.data);
      else if (res.error) message.error(res.error);
    } catch {
      message.error(TEXT.common.error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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
    [items, activeCat]
  );

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (item: Utensil) => {
    setEditing(item);
    form.setFieldsValue({ name: item.name, category: item.category || '其他', note: item.note || '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const res = editing
        ? await updateUtensilAction(editing.id, values)
        : await addUtensilAction(values);
      if (res.error) message.error(res.error);
      else { message.success(TEXT.common.success); setModalOpen(false); fetchData(); }
    } catch { /* validation */ } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    const res = await deleteUtensilAction(id);
    if (res.error) message.error(res.error);
    else { message.success(TEXT.common.success); setModalOpen(false); fetchData(); }
  };

  return (
    <div>
      <PageHeader title="厨具" subtitle={`${items.length} 件厨具`}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
          {TEXT.utensils.addUtensil}
        </Button>
      </PageHeader>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* 左侧分类栏 */}
        <div style={{ flex: '0 0 172px', borderRadius: 14, background: 'var(--panel)', border: '1px solid var(--line)', overflow: 'hidden' }}>
          {CATEGORIES.map((cat) => {
            const active = activeCat === cat.key;
            const count = categoryStats[cat.key] ?? 0;
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
                <span style={{ fontSize: 11.5, color: active ? 'var(--primary)' : 'var(--tx2)' }}>{count}</span>
              </div>
            );
          })}
        </div>

        {/* 右侧表格 */}
        <div style={{ flex: '1 1 460px', minWidth: 0, borderRadius: 14, background: 'var(--panel)', border: '1px solid var(--line)', overflow: 'hidden' }}>
          {visibleItems.length === 0 && !loading ? (
            <div style={{ textAlign: 'center', padding: 60, fontSize: 13, color: 'var(--tx2)' }}>暂无厨具</div>
          ) : (
            <div style={{ width: '100%' }}>
              {/* 表头 */}
              <div style={{ display: 'flex', background: 'var(--hover)', fontSize: 11.5, color: 'var(--tx2)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>
                <div style={{ width: 110, padding: '10px 14px' }}>名称</div>
                <div style={{ width: 120, padding: '10px 14px' }}>备注</div>
                <div style={{ flex: 1, padding: '10px 14px' }}>关联菜谱</div>
                <div style={{ width: 80, padding: '10px 14px' }}>操作</div>
              </div>
              {/* 行 */}
              {visibleItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--line2)', fontSize: 12.5,
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                >
                  <div style={{ width: 110, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="status-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary-soft)', flexShrink: 0 }} />
                    <span style={{ color: 'var(--tx)' }}>{item.name}</span>
                  </div>
                  <div style={{ width: 120, padding: '10px 14px', color: 'var(--tx2)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.note || '-'}
                  </div>
                  <div style={{ flex: 1, padding: '10px 14px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        fontSize: 10.5,
                        borderRadius: 7,
                        padding: '1px 8px',
                        background: 'var(--hover)',
                        color: 'var(--tx2)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      暂无关联
                    </span>
                  </div>
                  <div style={{ width: 80, padding: '10px 14px' }}>
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--primary)',
                        fontSize: 12,
                        textDecoration: 'underline',
                        padding: 0,
                      }}
                    >
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

      {/* 编辑/添加弹窗 */}
      <Modal
        title={editing ? '编辑厨具' : '添加厨具'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={TEXT.utensils.name} rules={[{ required: true, message: '请输入厨具名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select options={CATEGORY_OPTIONS} />
          </Form.Item>
          <Form.Item name="note" label={TEXT.utensils.note}>
            <Input.TextArea rows={2} />
          </Form.Item>
          {editing && (
            <Form.Item>
              <Button
                danger
                icon={<span style={{ fontSize: 13 }}>🗑</span>}
                onClick={() => handleDelete(editing.id)}
              >
                删除此厨具
              </Button>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
