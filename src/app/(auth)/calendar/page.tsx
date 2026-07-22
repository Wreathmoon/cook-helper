'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Tag,
  Badge,
  Drawer,
  Modal,
  Select,
  Input,
  Button,
  List,
  Upload,
  message,
  Spin,
  Popconfirm,
  Space,
  Typography,
  Empty,
  Image,
} from 'antd';
import {
  PlusOutlined,
  CameraOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { TEXT } from '@/lib/constants/text';
import type { CalendarEntry, CalendarStatus, StockLevel } from '@/types';
import {
  getCalendarEntriesAction,
  addCalendarEntryAction,
  completeEntryAction,
  deleteCalendarEntryAction,
  uploadCalendarPhotoAction,
  updateStockOnCookAction,
  getRecipesForCalendar,
  getRecipeDetailForCalendar,
} from '@/app/actions/calendar';
import { createClient } from '@/lib/supabase/browser';

const { Text } = Typography;

type CalendarEntryWithRecipe = CalendarEntry & {
  recipe?: { name: string };
};

type IngredientWithInventory = {
  id: string;
  recipe_id: string;
  inventory_id: string;
  role: string;
  amount: string | null;
  inventory?: { name: string; category: string; stock_level: string } | null;
};

const stockColor: Record<string, string> = {
  enough: 'green',
  low: 'orange',
  out: 'red',
};

const stockText: Record<string, string> = {
  enough: TEXT.inventory.stockLevel.enough,
  low: TEXT.inventory.stockLevel.low,
  out: TEXT.inventory.stockLevel.out,
};

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [entries, setEntries] = useState<CalendarEntryWithRecipe[]>([]);
  const [recipes, setRecipes] = useState<{ id: string; name: string }[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addStatus, setAddStatus] = useState<CalendarStatus>('completed');
  const [addRecipeId, setAddRecipeId] = useState<string>('');
  const [addNotes, setAddNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // 我做完了 - 库存更新
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockRecipeName, setStockRecipeName] = useState('');
  const [stockIngredients, setStockIngredients] = useState<IngredientWithInventory[]>([]);
  const [newLevels, setNewLevels] = useState<Record<string, StockLevel>>({});
  const [stockEntryId, setStockEntryId] = useState('');
  const [stockLoading, setStockLoading] = useState(false);

  // 照片
  const [photos, setPhotos] = useState<Record<string, { id: string; url: string }[]>>({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const supabase = createClient();

  // 加载日历条目
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const year = currentMonth.year();
      const month = currentMonth.month() + 1;
      const result = await getCalendarEntriesAction(year, month);
      if (result.data) {
        setEntries(result.data as CalendarEntryWithRecipe[]);
      }
    } catch {
      message.error(TEXT.common.error);
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  // 加载菜谱列表
  const fetchRecipes = async () => {
    try {
      const result = await getRecipesForCalendar();
      if (result.data) {
        setRecipes(result.data.map((r) => ({ id: r.id, name: r.name })));
      }
    } catch {
      // ignore
    }
  };

  // 加载某天的照片
  const fetchPhotosForEntries = async (entryIds: string[]) => {
    const newPhotos: Record<string, { id: string; url: string }[]> = {};
    for (const entryId of entryIds) {
      const { data } = await supabase
        .from('calendar_photos')
        .select('id, storage_path')
        .eq('calendar_entry_id', entryId);
      if (data && data.length > 0) {
        newPhotos[entryId] = data.map((p) => ({
          id: p.id,
          url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/calendar-photos/${p.storage_path}`,
        }));
      }
    }
    if (Object.keys(newPhotos).length > 0) {
      setPhotos((prev) => ({ ...prev, ...newPhotos }));
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    fetchRecipes();
  }, []);

  // 月份切换
  const onPanelChange = (value: Dayjs) => {
    setCurrentMonth(value);
  };

  // 点击日期
  const onSelect = (date: Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD');
    setSelectedDate(dateStr);
    setDrawerOpen(true);
  };

  // 获取某天的条目
  const getEntriesForDate = (date: string) => {
    return entries.filter((e) => e.date === date);
  };

  // 打开添加记录 modal
  const openAddModal = (status: CalendarStatus) => {
    setAddStatus(status);
    setAddRecipeId('');
    setAddNotes('');
    setAddModalOpen(true);
  };

  // 提交添加记录
  const handleAddEntry = async () => {
    if (!addRecipeId || !selectedDate) return;
    try {
      await addCalendarEntryAction({
        date: selectedDate,
        recipe_id: addRecipeId,
        status: addStatus,
        notes: addNotes || undefined,
      });
      message.success(TEXT.common.success);
      setAddModalOpen(false);
      fetchEntries();
    } catch {
      message.error(TEXT.common.error);
    }
  };

  // 标记完成
  const handleComplete = async (entryId: string) => {
    try {
      await completeEntryAction(entryId);
      message.success(TEXT.common.success);
      fetchEntries();
    } catch {
      message.error(TEXT.common.error);
    }
  };

  // 删除条目
  const handleDelete = async (entryId: string) => {
    try {
      await deleteCalendarEntryAction(entryId);
      message.success(TEXT.common.success);
      fetchEntries();
    } catch {
      message.error(TEXT.common.error);
    }
  };

  // 我做完了 - 打开库存更新
  const openStockModal = async (entry: CalendarEntryWithRecipe) => {
    try {
      const result = await getRecipeDetailForCalendar(entry.recipe_id);
      if (result.data) {
        const mainIngredients = result.data.ingredients.filter(
          (ing) => ing.role === 'main'
        );
        setStockIngredients(mainIngredients);
        setStockRecipeName(result.data.name);
        setStockEntryId(entry.id);
        const levels: Record<string, StockLevel> = {};
        mainIngredients.forEach((ing) => {
          if (ing.inventory) {
            levels[ing.inventory_id] = (ing.inventory.stock_level as StockLevel) || 'enough';
          }
        });
        setNewLevels(levels);
        setStockModalOpen(true);
      }
    } catch {
      message.error(TEXT.common.error);
    }
  };

  // 提交库存更新
  const handleStockUpdate = async () => {
    setStockLoading(true);
    try {
      const updates = Object.entries(newLevels).map(([id, stock_level]) => ({
        id,
        stock_level,
      }));
      await updateStockOnCookAction(updates);
      message.success('库存已更新');
      setStockModalOpen(false);
    } catch {
      message.error(TEXT.common.error);
    } finally {
      setStockLoading(false);
    }
  };

  // 上传照片
  const handlePhotoUpload = async (entryId: string, file: File) => {
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await uploadCalendarPhotoAction(entryId, formData);
      if (result.data) {
        message.success(TEXT.common.success);
        // 刷新照片
        const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/calendar-photos/${result.data.storage_path}`;
        setPhotos((prev) => ({
          ...prev,
          [entryId]: [...(prev[entryId] || []), { id: result.data!.id, url }],
        }));
      } else if (result.error) {
        message.error(result.error);
      }
    } catch {
      message.error(TEXT.common.error);
    } finally {
      setUploadingPhoto(false);
    }
  };

  // 自定义日历单元格渲染
  const dateCellRender = (date: Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD');
    const dayEntries = getEntriesForDate(dateStr);
    if (dayEntries.length === 0) return null;

    return (
      <div style={{ padding: '0 4px' }}>
        {dayEntries.slice(0, 2).map((entry) => (
          <div key={entry.id} style={{ marginBottom: 2 }}>
            <Badge
              count={entry.recipe?.name || '未知菜谱'}
              style={{
                backgroundColor: entry.status === 'completed' ? '#52c41a' : '#1677ff',
                fontSize: 11,
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                boxShadow: 'none',
              }}
            />
          </div>
        ))}
        {dayEntries.length > 2 && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            +{dayEntries.length - 2} 更多
          </Text>
        )}
      </div>
    );
  };

  const cellRender = (date: Dayjs, info: { type: string }) => {
    if (info.type !== 'date') return null;
    return dateCellRender(date);
  };

  const selectedDayEntries = selectedDate ? getEntriesForDate(selectedDate) : [];
  const isFutureDate = selectedDate ? dayjs(selectedDate).isAfter(dayjs(), 'day') : false;

  return (
    <div>
      <Spin spinning={loading}>
        <Calendar
          cellRender={cellRender}
          onSelect={onSelect}
          onPanelChange={onPanelChange}
          style={{ minHeight: 600 }}
        />
      </Spin>

      {/* 日期详情 Drawer */}
      <Drawer
        title={selectedDate ? `${dayjs(selectedDate).format('YYYY年M月D日')}` : ''}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={420}
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openAddModal('completed')}
            >
              {TEXT.calendar.addEntry}
            </Button>
            {isFutureDate && (
              <Button
                icon={<ClockCircleOutlined />}
                onClick={() => openAddModal('planned')}
              >
                {TEXT.calendar.planEntry}
              </Button>
            )}
          </Space>
        }
      >
        {selectedDayEntries.length === 0 ? (
          <Empty description={TEXT.common.noData} />
        ) : (
          <List
            dataSource={selectedDayEntries}
            renderItem={(entry) => (
              <List.Item
                actions={[
                  entry.status === 'planned' ? (
                    <Button
                      key="complete"
                      type="link"
                      size="small"
                      icon={<CheckCircleOutlined />}
                      onClick={() => handleComplete(entry.id)}
                    >
                      标记完成
                    </Button>
                  ) : (
                    <Button
                      key="done"
                      type="link"
                      size="small"
                      onClick={() => openStockModal(entry)}
                    >
                      {TEXT.calendar.completed}
                    </Button>
                  ),
                  <Popconfirm
                    key="delete"
                    title="确定删除这条记录？"
                    onConfirm={() => handleDelete(entry.id)}
                  >
                    <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                      {TEXT.common.delete}
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Tag color={entry.status === 'completed' ? 'green' : 'blue'}>
                        {entry.status === 'completed' ? '已完成' : '计划中'}
                      </Tag>
                      <span>{entry.recipe?.name || '未知菜谱'}</span>
                    </Space>
                  }
                  description={entry.notes || undefined}
                />
                {/* 照片区域 */}
                {photos[entry.id] && photos[entry.id].length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Image.PreviewGroup>
                      <Space wrap>
                        {photos[entry.id].map((photo) => (
                          <Image
                            key={photo.id}
                            src={photo.url}
                            width={80}
                            height={80}
                            style={{ objectFit: 'cover', borderRadius: 6 }}
                          />
                        ))}
                      </Space>
                    </Image.PreviewGroup>
                  </div>
                )}
                {/* 上传照片按钮 */}
                <div style={{ marginTop: 8 }}>
                  <Upload
                    showUploadList={false}
                    beforeUpload={(file) => {
                      handlePhotoUpload(entry.id, file);
                      return false;
                    }}
                    accept="image/*"
                  >
                    <Button
                      size="small"
                      icon={<CameraOutlined />}
                      loading={uploadingPhoto}
                    >
                      上传成品照
                    </Button>
                  </Upload>
                </div>
              </List.Item>
            )}
          />
        )}
      </Drawer>

      {/* 添加记录 Modal */}
      <Modal
        title={addStatus === 'completed' ? TEXT.calendar.addEntry : TEXT.calendar.planEntry}
        open={addModalOpen}
        onOk={handleAddEntry}
        onCancel={() => setAddModalOpen(false)}
        okText={TEXT.common.confirm}
        cancelText={TEXT.common.cancel}
        okButtonProps={{ disabled: !addRecipeId }}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>选择菜谱</Text>
          <Select
            showSearch
            style={{ width: '100%', marginTop: 8 }}
            placeholder="搜索菜谱..."
            value={addRecipeId || undefined}
            onChange={setAddRecipeId}
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
            options={recipes.map((r) => ({ value: r.id, label: r.name }))}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text strong>备注（可选）</Text>
          <Input.TextArea
            style={{ marginTop: 8 }}
            value={addNotes}
            onChange={(e) => setAddNotes(e.target.value)}
            placeholder="添加备注..."
            rows={3}
          />
        </div>
      </Modal>

      {/* 我做完了 - 库存更新 Modal */}
      <Modal
        title="做完啦！更新食材库存"
        open={stockModalOpen}
        onOk={handleStockUpdate}
        onCancel={() => setStockModalOpen(false)}
        okText="确认更新"
        cancelText={TEXT.common.cancel}
        confirmLoading={stockLoading}
      >
        <p>
          「{stockRecipeName}」用到了以下主要食材，请更新剩余量：
        </p>
        {stockIngredients.length === 0 ? (
          <Empty description="该菜谱没有主要食材" />
        ) : (
          <List
            dataSource={stockIngredients}
            renderItem={(ing) => (
              <List.Item>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <span style={{ fontWeight: 500 }}>
                    {ing.inventory?.name || '未知食材'}
                  </span>
                  <Space>
                    <Text type="secondary">当前:</Text>
                    <Tag color={stockColor[ing.inventory?.stock_level || 'enough']}>
                      {stockText[ing.inventory?.stock_level || 'enough']}
                    </Tag>
                    <Select
                      value={newLevels[ing.inventory_id] || 'enough'}
                      onChange={(v) =>
                        setNewLevels((prev) => ({
                          ...prev,
                          [ing.inventory_id]: v,
                        }))
                      }
                      options={[
                        { value: 'enough', label: TEXT.inventory.stockLevel.enough },
                        { value: 'low', label: TEXT.inventory.stockLevel.low },
                        { value: 'out', label: TEXT.inventory.stockLevel.out },
                      ]}
                      style={{ width: 110 }}
                    />
                  </Space>
                </div>
              </List.Item>
            )}
          />
        )}
      </Modal>
    </div>
  );
}
