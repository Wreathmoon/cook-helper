'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Typography,
  Tabs,
  Table,
  Tag,
  Button,
  Space,
  Input,
  Modal,
  Form,
  Select,
  Popconfirm,
  message,
  Card,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SwapOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { TEXT } from '@/lib/constants/text';
import type { InventoryItem, InventoryCategory, StockLevel } from '@/types';
import {
  getListInventory,
  addInventoryItemAction,
  updateInventoryItemAction,
  deleteInventoryItemAction,
  batchUpdateStockLevelAction,
} from '@/app/actions/inventory';

const { Title } = Typography;

const CATEGORIES: (InventoryCategory | 'all')[] = [
  'all',
  'vegetable',
  'meat',
  'egg_dairy_bean',
  'staple',
  'seasoning',
];

const STOCK_LEVEL_COLORS: Record<StockLevel, string> = {
  enough: 'green',
  low: 'orange',
  out: 'red',
};

const STOCK_LEVEL_OPTIONS: { value: StockLevel; label: string }[] = [
  { value: 'enough', label: TEXT.inventory.stockLevel.enough },
  { value: 'low', label: TEXT.inventory.stockLevel.low },
  { value: 'out', label: TEXT.inventory.stockLevel.out },
];

const CATEGORY_OPTIONS: { value: InventoryCategory; label: string }[] = (
  Object.entries(TEXT.inventory.categories) as [InventoryCategory, string][]
).map(([value, label]) => ({ value, label }));

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchText, setSearchText] = useState('');

  // Add/Edit modal
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // Batch update modal
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchItems, setBatchItems] = useState<
    { id: string; name: string; stock_level: StockLevel }[]
  >([]);
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  const fetchData = useCallback(async (category: string) => {
    setLoading(true);
    try {
      const cat = category === 'all' ? undefined : category;
      const res = await getListInventory(cat);
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
    fetchData(activeCategory);
  }, [activeCategory, fetchData]);

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // --- Add / Edit ---
  const openAddModal = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({ stock_level: 'enough' });
    setFormModalOpen(true);
  };

  const openEditModal = (record: InventoryItem) => {
    setEditingItem(record);
    form.setFieldsValue({
      name: record.name,
      category: record.category,
      total_amount: record.total_amount || '',
      stock_level: record.stock_level,
      unit: record.unit || '',
      note: record.note || '',
    });
    setFormModalOpen(true);
  };

  const handleFormSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editingItem) {
        const res = await updateInventoryItemAction(editingItem.id, values);
        if (res.error) {
          message.error(res.error);
        } else {
          message.success(TEXT.common.success);
        }
      } else {
        const res = await addInventoryItemAction(values);
        if (res.error) {
          message.error(res.error);
        } else {
          message.success(TEXT.common.success);
        }
      }
      setFormModalOpen(false);
      fetchData(activeCategory);
    } catch {
      // validation error
    } finally {
      setSubmitting(false);
    }
  };

  // --- Delete ---
  const handleDelete = async (id: string) => {
    const res = await deleteInventoryItemAction(id);
    if (res.error) {
      message.error(res.error);
    } else {
      message.success(TEXT.common.success);
      fetchData(activeCategory);
    }
  };

  // --- Batch update ---
  const openBatchModal = () => {
    setBatchItems(
      filteredItems.map((item) => ({
        id: item.id,
        name: item.name,
        stock_level: item.stock_level,
      }))
    );
    setBatchModalOpen(true);
  };

  const handleBatchSubmit = async () => {
    setBatchSubmitting(true);
    try {
      const res = await batchUpdateStockLevelAction(
        batchItems.map((item) => ({ id: item.id, stock_level: item.stock_level }))
      );
      if (res.error) {
        message.error(res.error);
      } else {
        message.success(TEXT.common.success);
        setBatchModalOpen(false);
        fetchData(activeCategory);
      }
    } catch {
      message.error(TEXT.common.error);
    } finally {
      setBatchSubmitting(false);
    }
  };

  const columns: ColumnsType<InventoryItem> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (cat: InventoryCategory) =>
        TEXT.inventory.categories[cat] || cat,
    },
    {
      title: '总量',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (v: string | null) => v || '-',
    },
    {
      title: '库存档位',
      dataIndex: 'stock_level',
      key: 'stock_level',
      render: (level: StockLevel) => (
        <Tag color={STOCK_LEVEL_COLORS[level]}>
          {TEXT.inventory.stockLevel[level]}
        </Tag>
      ),
    },
    {
      title: '单位',
      dataIndex: 'unit',
      key: 'unit',
      render: (v: string | null) => v || '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            {TEXT.common.edit}
          </Button>
          <Popconfirm
            title="确认删除该食材？"
            onConfirm={() => handleDelete(record.id)}
            okText={TEXT.common.confirm}
            cancelText={TEXT.common.cancel}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              {TEXT.common.delete}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tabItems = CATEGORIES.map((cat) => ({
    key: cat,
    label: cat === 'all' ? '全部' : TEXT.inventory.categories[cat],
  }));

  return (
    <div style={{ padding: '24px' }}>
      <Title level={3}>{TEXT.inventory.title}</Title>

      <Card style={{ marginBottom: 16 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Input
            placeholder={`${TEXT.common.search}食材名称`}
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Space>
            <Button
              icon={<SwapOutlined />}
              onClick={openBatchModal}
              disabled={filteredItems.length === 0}
            >
              {TEXT.inventory.updateStock}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
              {TEXT.inventory.addIngredient}
            </Button>
          </Space>
        </Space>
      </Card>

      <Tabs
        activeKey={activeCategory}
        onChange={(key) => {
          setActiveCategory(key);
          setSearchText('');
        }}
        items={tabItems}
        style={{ marginBottom: 16 }}
      />

      <Table
        columns={columns}
        dataSource={filteredItems}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
      />

      {/* Add / Edit Modal */}
      <Modal
        title={editingItem ? TEXT.inventory.editIngredient : TEXT.inventory.addIngredient}
        open={formModalOpen}
        onOk={handleFormSubmit}
        onCancel={() => setFormModalOpen(false)}
        confirmLoading={submitting}
        okText={TEXT.common.save}
        cancelText={TEXT.common.cancel}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入食材名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select options={CATEGORY_OPTIONS} />
          </Form.Item>
          <Form.Item name="total_amount" label="总量">
            <Input />
          </Form.Item>
          <Form.Item name="stock_level" label="库存档位">
            <Select options={STOCK_LEVEL_OPTIONS} />
          </Form.Item>
          <Form.Item name="unit" label="单位">
            <Input />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Batch Update Modal */}
      <Modal
        title={TEXT.inventory.updateStock}
        open={batchModalOpen}
        onOk={handleBatchSubmit}
        onCancel={() => setBatchModalOpen(false)}
        confirmLoading={batchSubmitting}
        okText={TEXT.inventory.batchUpdate}
        cancelText={TEXT.common.cancel}
        width={520}
      >
        <div style={{ marginTop: 16 }}>
          {batchItems.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <span style={{ fontWeight: 500 }}>{item.name}</span>
              <Select
                value={item.stock_level}
                onChange={(val) =>
                  setBatchItems((prev) =>
                    prev.map((bi) =>
                      bi.id === item.id ? { ...bi, stock_level: val } : bi
                    )
                  )
                }
                options={STOCK_LEVEL_OPTIONS}
                style={{ width: 120 }}
              />
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
