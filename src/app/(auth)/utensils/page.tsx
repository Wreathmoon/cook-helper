'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Typography,
  Table,
  Button,
  Space,
  Input,
  Modal,
  Form,
  Popconfirm,
  message,
  Card,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { TEXT } from '@/lib/constants/text';
import type { Utensil } from '@/types';
import {
  getListUtensils,
  addUtensilAction,
  deleteUtensilAction,
} from '@/app/actions/utensil';

const { Title } = Typography;

export default function UtensilsPage() {
  const [items, setItems] = useState<Utensil[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getListUtensils();
      if (res.error) {
        message.error(res.error);
      } else {
        setItems(res.data || []);
      }
    } catch {
      message.error(TEXT.common.error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const openAddModal = () => {
    form.resetFields();
    setAddModalOpen(true);
  };

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const res = await addUtensilAction(values);
      if (res.error) {
        message.error(res.error);
      } else {
        message.success(TEXT.common.success);
        setAddModalOpen(false);
        fetchData();
      }
    } catch {
      // validation error
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await deleteUtensilAction(id);
    if (res.error) {
      message.error(res.error);
    } else {
      message.success(TEXT.common.success);
      fetchData();
    }
  };

  const columns: ColumnsType<Utensil> = [
    {
      title: TEXT.utensils.name,
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: TEXT.utensils.note,
      dataIndex: 'note',
      key: 'note',
      render: (v: string | null) => v || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Popconfirm
          title="确认删除该厨具？"
          onConfirm={() => handleDelete(record.id)}
          okText={TEXT.common.confirm}
          cancelText={TEXT.common.cancel}
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            {TEXT.common.delete}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={3}>{TEXT.utensils.title}</Title>

      <Card style={{ marginBottom: 16 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Input
            placeholder={`${TEXT.common.search}厨具名称`}
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
            {TEXT.utensils.addUtensil}
          </Button>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={filteredItems}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
      />

      {/* Add Modal */}
      <Modal
        title={TEXT.utensils.addUtensil}
        open={addModalOpen}
        onOk={handleAdd}
        onCancel={() => setAddModalOpen(false)}
        confirmLoading={submitting}
        okText={TEXT.common.save}
        cancelText={TEXT.common.cancel}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label={TEXT.utensils.name}
            rules={[{ required: true, message: '请输入厨具名称' }]}
          >
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
