'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button, Modal, Form, Input, Popconfirm, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { TEXT } from '@/lib/constants/text';
import { getListUtensils, addUtensilAction, deleteUtensilAction } from '@/app/actions/utensil';
import type { Utensil } from '@/types';
import { PageHeader } from '@/components/shared/PageHeader';

export default function UtensilsPage() {
  const [items, setItems] = useState<Utensil[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
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

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const res = await addUtensilAction(values);
      if (res.error) message.error(res.error);
      else { message.success(TEXT.common.success); setModalOpen(false); fetchData(); }
    } catch { /* validation */ } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    const res = await deleteUtensilAction(id);
    if (res.error) message.error(res.error);
    else { message.success(TEXT.common.success); fetchData(); }
  };

  return (
    <div>
      <PageHeader title="我的厨具" subtitle={`${items.length} 件厨具`}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>
          {TEXT.utensils.addUtensil}
        </Button>
      </PageHeader>

      <div style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: 60, fontSize: 13, color: 'var(--tx2)' }}>
              还没有厨具
            </div>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 14,
                background: 'var(--panel)', border: '1px solid var(--line)',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx)' }}>{item.name}</div>
                {item.note && <div style={{ fontSize: 11, color: 'var(--tx2)', marginTop: 2 }}>{item.note}</div>}
              </div>
              <span
                style={{
                  fontSize: 10.5, borderRadius: 7, padding: '1px 8px',
                  background: 'var(--hover)', color: 'var(--tx2)', whiteSpace: 'nowrap',
                }}
              >
                N道菜在用
              </span>
              <Popconfirm title="确认删除？" onConfirm={() => handleDelete(item.id)} okText="确认" cancelText="取消">
                <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 13 }}>
                  🗑
                </button>
              </Popconfirm>
            </div>
          ))}
        </div>
      </div>

      <Modal
        title={TEXT.utensils.addUtensil}
        open={modalOpen}
        onOk={handleAdd}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={TEXT.utensils.name} rules={[{ required: true, message: '请输入厨具名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="note" label={TEXT.utensils.note}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
