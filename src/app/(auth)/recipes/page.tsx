'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Typography,
  Card,
  Row,
  Col,
  Tag,
  Button,
  Space,
  Input,
  Select,
  Modal,
  Drawer,
  Form,
  InputNumber,
  Upload,
  Image,
  Popconfirm,
  message,
  Steps,
  Empty,
  Spin,
  Tooltip,
  Descriptions,
  List,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  EyeOutlined,
  UploadOutlined,
  MinusCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Table } from 'antd';
import { TEXT } from '@/lib/constants/text';
import type {
  Recipe,
  RecipeAttributes,
  Difficulty,
  CookingMethod,
  Spiciness,
  Greasiness,
  Flavor,
  DietType,
  Nutrition,
  Scene,
  Cuisine,
  InventoryItem,
  Utensil,
  StockLevel,
} from '@/types';
import {
  getListRecipes,
  getRecipeDetailAction,
  createRecipeAction,
  updateRecipeAction,
  deleteRecipeAction,
  getInventoryForRecipe,
  getUtensilsForRecipe,
  uploadRecipePhotoAction,
  deleteRecipePhotoAction,
  getPhotoUrl,
} from '@/app/actions/recipe';
import type { RecipeDetail } from '@/lib/services/recipe';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ─── 常量 ────────────────────────────────────────────────────────────────────

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '困难' },
];
const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  easy: 'green',
  medium: 'orange',
  hard: 'red',
};
const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

const METHOD_OPTIONS: { value: CookingMethod; label: string }[] = [
  { value: '炒', label: '炒' },
  { value: '炖', label: '炖' },
  { value: '蒸', label: '蒸' },
  { value: '煮', label: '煮' },
  { value: '烤', label: '烤' },
  { value: '凉拌', label: '凉拌' },
  { value: '炸', label: '炸' },
];

const SPICINESS_OPTIONS: { value: Spiciness; label: string }[] = [
  { value: '不辣', label: '不辣' },
  { value: '微辣', label: '微辣' },
  { value: '中辣', label: '中辣' },
  { value: '重辣', label: '重辣' },
];

const GREASINESS_OPTIONS: { value: Greasiness; label: string }[] = [
  { value: '清爽', label: '清爽' },
  { value: '适中', label: '适中' },
  { value: '重油', label: '重油' },
];

const FLAVOR_OPTIONS: { value: Flavor; label: string }[] = [
  { value: '咸鲜', label: '咸鲜' },
  { value: '清淡', label: '清淡' },
  { value: '带甜', label: '带甜' },
];

const DIET_OPTIONS: { value: DietType; label: string }[] = [
  { value: '纯荤', label: '纯荤' },
  { value: '荤素搭配', label: '荤素搭配' },
  { value: '纯素', label: '纯素' },
];

const NUTRITION_OPTIONS: { value: Nutrition; label: string }[] = [
  { value: '高蛋白', label: '高蛋白' },
  { value: '高碳水主食', label: '高碳水主食' },
  { value: '多蔬菜纤维', label: '多蔬菜纤维' },
  { value: '汤水', label: '汤水' },
];

const SCENE_OPTIONS: { value: Scene; label: string }[] = [
  { value: '工作日快手', label: '工作日快手' },
  { value: '周末慢做', label: '周末慢做' },
  { value: '宴客硬菜', label: '宴客硬菜' },
  { value: '夜宵', label: '夜宵' },
];

const CUISINE_OPTIONS: { value: Cuisine; label: string }[] = [
  { value: '川', label: '川' },
  { value: '粤', label: '粤' },
  { value: '鲁', label: '鲁' },
  { value: '家常', label: '家常' },
  { value: '其他', label: '其他' },
];

const STOCK_COLOR: Record<StockLevel, string> = {
  enough: 'green',
  low: 'orange',
  out: 'red',
};
const STOCK_LABEL: Record<StockLevel, string> = {
  enough: '充足',
  low: '不多了',
  out: '没了',
};

// ─── 成分行类型 ──────────────────────────────────────────────────────────────

interface IngredientRow {
  inventory_id: string;
  role: 'main' | 'auxiliary' | 'seasoning';
  amount: string;
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

export default function RecipesPage() {
  // 列表数据
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  // 搜索/筛选
  const [searchText, setSearchText] = useState('');
  const [filterMethod, setFilterMethod] = useState<CookingMethod[]>([]);
  const [filterSpiciness, setFilterSpiciness] = useState<Spiciness | undefined>();
  const [filterDiet, setFilterDiet] = useState<DietType | undefined>();
  const [filterScene, setFilterScene] = useState<Scene[]>([]);

  // 新增/编辑 Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [formStep, setFormStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // 食材行
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>([]);

  // 厨具
  const [selectedUtensils, setSelectedUtensils] = useState<string[]>([]);
  const [customUtensils, setCustomUtensils] = useState<string>('');

  // 步骤
  const [stepItems, setStepItems] = useState<{ description: string }[]>([]);

  // 照片（新建/编辑时）
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);

  // 详情 Drawer
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<RecipeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  // 库存/厨具选项（供表单 Select 用）
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [utensilList, setUtensilList] = useState<Utensil[]>([]);

  // ─── 数据加载 ─────────────────────────────────────────────────────────────

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    try {
      const attributes: Record<string, unknown> = {};
      if (filterMethod.length > 0) attributes.method = filterMethod;
      if (filterSpiciness) attributes.spiciness = filterSpiciness;
      if (filterDiet) attributes.diet_type = filterDiet;
      if (filterScene.length > 0) attributes.scene = filterScene;

      const res = await getListRecipes(
        searchText || Object.keys(attributes).length > 0
          ? { search: searchText || undefined, attributes: Object.keys(attributes).length > 0 ? (attributes as any) : undefined }
          : undefined
      );
      if (res.error) message.error(res.error);
      else setRecipes(res.data || []);
    } catch {
      message.error(TEXT.common.error);
    } finally {
      setLoading(false);
    }
  }, [searchText, filterMethod, filterSpiciness, filterDiet, filterScene]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  const fetchFormData = useCallback(async () => {
    try {
      const [invRes, utRes] = await Promise.all([
        getInventoryForRecipe(),
        getUtensilsForRecipe(),
      ]);
      if (invRes.data) setInventoryList(invRes.data);
      if (utRes.data) setUtensilList(utRes.data);
    } catch {
      // silent
    }
  }, []);

  // ─── 新增/编辑 ─────────────────────────────────────────────────────────────

  const openAddModal = () => {
    setEditingRecipe(null);
    setFormStep(0);
    form.resetFields();
    setIngredientRows([]);
    setSelectedUtensils([]);
    setCustomUtensils('');
    setStepItems([]);
    setPhotoFiles([]);
    fetchFormData();
    setFormOpen(true);
  };

  const openEditModal = async (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setFormStep(0);
    fetchFormData();

    // 加载详情
    const res = await getRecipeDetailAction(recipe.id);
    if (res.error || !res.data) {
      message.error(res.error || '加载失败');
      return;
    }
    const detail = res.data;

    // 填充表单
    form.setFieldsValue({
      name: detail.name,
      cook_time_minutes: detail.cook_time_minutes,
      difficulty: detail.difficulty,
      tips: detail.tips || '',
      method: detail.attributes?.method || [],
      spiciness: detail.attributes?.spiciness,
      greasiness: detail.attributes?.greasiness,
      flavor: detail.attributes?.flavor,
      diet_type: detail.attributes?.diet_type,
      nutrition: detail.attributes?.nutrition || [],
      scene: detail.attributes?.scene || [],
      cuisine: detail.attributes?.cuisine,
    });

    // 食材行
    setIngredientRows(
      detail.ingredients.map((ing) => ({
        inventory_id: ing.inventory_id,
        role: ing.role,
        amount: ing.amount || '',
      }))
    );

    // 厨具
    const existingNames = utensilList.map((u) => u.name);
    const fromList = detail.utensils
      .map((u) => u.utensil_name)
      .filter((n) => existingNames.includes(n));
    const custom = detail.utensils
      .map((u) => u.utensil_name)
      .filter((n) => !existingNames.includes(n));
    setSelectedUtensils(fromList);
    setCustomUtensils(custom.join('、'));

    // 步骤
    setStepItems(
      (detail.steps || []).sort((a, b) => a.step_number - b.step_number).map((s) => ({
        description: s.description,
      }))
    );

    // 照片 URLs
    if (detail.photos.length > 0) {
      const urlMap: Record<string, string> = {};
      for (const p of detail.photos) {
        const url = await getPhotoUrl(p.storage_path);
        urlMap[p.id] = url;
      }
      setPhotoUrls(urlMap);
    }

    setPhotoFiles([]);
    setFormOpen(true);
  };

  const handleFormSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      // 合并所有 utensils
      const allUtensils = [...selectedUtensils];
      if (customUtensils.trim()) {
        allUtensils.push(...customUtensils.split(/[、,，]/).map((s) => s.trim()).filter(Boolean));
      }

      // 构建步骤
      const steps = stepItems.map((s, i) => ({
        step_number: i + 1,
        description: s.description,
      }));

      // 构建 attributes
      const attributes: RecipeAttributes = {
        ...(values.method?.length > 0 && { method: values.method }),
        ...(values.spiciness && { spiciness: values.spiciness }),
        ...(values.greasiness && { greasiness: values.greasiness }),
        ...(values.flavor && { flavor: values.flavor }),
        ...(values.diet_type && { diet_type: values.diet_type }),
        ...(values.nutrition?.length > 0 && { nutrition: values.nutrition }),
        ...(values.scene?.length > 0 && { scene: values.scene }),
        ...(values.cuisine && { cuisine: values.cuisine }),
      };

      const payload = {
        name: values.name,
        cook_time_minutes: values.cook_time_minutes || undefined,
        difficulty: values.difficulty || undefined,
        steps: steps.length > 0 ? steps : undefined,
        attributes: attributes as unknown as Record<string, unknown>,
        tips: values.tips || undefined,
        ingredients: ingredientRows.length > 0
          ? ingredientRows.map((r) => ({
              inventory_id: r.inventory_id,
              role: r.role,
              amount: r.amount || undefined,
            }))
          : undefined,
        utensils: allUtensils.length > 0 ? allUtensils : undefined,
      };

      let result;
      if (editingRecipe) {
        result = await updateRecipeAction(editingRecipe.id, payload);
      } else {
        result = await createRecipeAction(payload);
      }

      if (result.error) {
        message.error(result.error);
      } else {
        // 上传新照片
        if (photoFiles.length > 0 && result.data) {
          for (const file of photoFiles) {
            await uploadRecipePhotoAction(result.data.id, file);
          }
        }
        message.success(TEXT.common.success);
        setFormOpen(false);
        fetchRecipes();
      }
    } catch {
      // validation error
    } finally {
      setSubmitting(false);
    }
  };

  // ─── 删除 ──────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    const res = await deleteRecipeAction(id);
    if (res.error) message.error(res.error);
    else {
      message.success(TEXT.common.success);
      fetchRecipes();
    }
  };

  // ─── 详情 ──────────────────────────────────────────────────────────────────

  const openDetail = async (recipe: Recipe) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await getRecipeDetailAction(recipe.id);
      if (res.error || !res.data) {
        message.error(res.error || '加载失败');
      } else {
        setDetailData(res.data);
        // 获取照片 URL
        const urlMap: Record<string, string> = {};
        for (const p of res.data.photos || []) {
          const url = await getPhotoUrl(p.storage_path);
          urlMap[p.id] = url;
        }
        setPhotoUrls(urlMap);
      }
    } catch {
      message.error(TEXT.common.error);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    const res = await deleteRecipePhotoAction(photoId);
    if (res.error) message.error(res.error);
    else {
      message.success('照片已删除');
      // 刷新详情
      if (detailData) {
        const refreshed = await getRecipeDetailAction(detailData.id);
        if (refreshed.data) {
          setDetailData(refreshed.data);
          const urlMap: Record<string, string> = {};
          for (const p of refreshed.data.photos || []) {
            const url = await getPhotoUrl(p.storage_path);
            urlMap[p.id] = url;
          }
          setPhotoUrls(urlMap);
        }
      }
    }
  };

  // ─── 食材行操作 ────────────────────────────────────────────────────────────

  const addIngredientRow = (role: 'main' | 'auxiliary' | 'seasoning') => {
    setIngredientRows((prev) => [...prev, { inventory_id: '', role, amount: '' }]);
  };

  const updateIngredientRow = (index: number, field: keyof IngredientRow, value: string) => {
    setIngredientRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const removeIngredientRow = (index: number) => {
    setIngredientRows((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── 步骤操作 ──────────────────────────────────────────────────────────────

  const addStep = () => setStepItems((prev) => [...prev, { description: '' }]);
  const removeStep = (index: number) =>
    setStepItems((prev) => prev.filter((_, i) => i !== index));
  const updateStep = (index: number, desc: string) =>
    setStepItems((prev) => prev.map((s, i) => (i === index ? { description: desc } : s)));
  const moveStep = (index: number, direction: 'up' | 'down') => {
    setStepItems((prev) => {
      const arr = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= arr.length) return arr;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr;
    });
  };

  // ─── 表单步骤配置 ──────────────────────────────────────────────────────────

  const formStepItems = [
    { title: '基本信息' },
    { title: '食材关联' },
    { title: '厨具 & 步骤' },
    { title: '标签 & 照片' },
  ];

  // ─── 渲染表单步骤 ──────────────────────────────────────────────────────────

  const renderFormStep = () => {
    switch (formStep) {
      case 0:
        return (
          <>
            <Form.Item
              name="name"
              label="菜名"
              rules={[{ required: true, message: '请输入菜名' }]}
            >
              <Input placeholder="例如：番茄炒蛋" />
            </Form.Item>
            <Form.Item name="cook_time_minutes" label={TEXT.recipes.cookTime}>
              <InputNumber min={1} placeholder="分钟" style={{ width: '100%' }} addonAfter="分钟" />
            </Form.Item>
            <Form.Item name="difficulty" label={TEXT.recipes.difficulty}>
              <Select options={DIFFICULTY_OPTIONS} allowClear placeholder="选择难度" />
            </Form.Item>
            <Form.Item name="tips" label={TEXT.recipes.tips}>
              <TextArea rows={3} placeholder="小贴士、注意事项等" />
            </Form.Item>
          </>
        );

      case 1:
        return (
          <div>
            {/* 主要食材 */}
            <Divider orientation="left" style={{ marginTop: 0 }}>
              {TEXT.recipes.ingredients}
            </Divider>
            {ingredientRows
              .map((row, idx) => ({ row, idx }))
              .filter(({ row }) => row.role === 'main')
              .map(({ row, idx }) => (
                <IngredientRowInput
                  key={idx}
                  row={row}
                  originalIndex={ingredientRows.indexOf(row)}
                  inventoryList={inventoryList}
                  onUpdate={updateIngredientRow}
                  onRemove={removeIngredientRow}
                  showAmount
                />
              ))}
            <Button
              type="dashed"
              onClick={() => addIngredientRow('main')}
              icon={<PlusOutlined />}
              block
              style={{ marginBottom: 16 }}
            >
              添加主要食材
            </Button>

            {/* 辅助食材 */}
            <Divider orientation="left">{TEXT.recipes.auxiliaryIngredients}</Divider>
            {ingredientRows
              .map((row, idx) => ({ row, idx }))
              .filter(({ row }) => row.role === 'auxiliary')
              .map(({ row, idx }) => (
                <IngredientRowInput
                  key={idx}
                  row={row}
                  originalIndex={ingredientRows.indexOf(row)}
                  inventoryList={inventoryList}
                  onUpdate={updateIngredientRow}
                  onRemove={removeIngredientRow}
                />
              ))}
            <Button
              type="dashed"
              onClick={() => addIngredientRow('auxiliary')}
              icon={<PlusOutlined />}
              block
              style={{ marginBottom: 16 }}
            >
              添加辅助食材
            </Button>

            {/* 调料 */}
            <Divider orientation="left">{TEXT.recipes.seasonings}</Divider>
            {ingredientRows
              .map((row, idx) => ({ row, idx }))
              .filter(({ row }) => row.role === 'seasoning')
              .map(({ row, idx }) => (
                <IngredientRowInput
                  key={idx}
                  row={row}
                  originalIndex={ingredientRows.indexOf(row)}
                  inventoryList={inventoryList}
                  onUpdate={updateIngredientRow}
                  onRemove={removeIngredientRow}
                />
              ))}
            <Button
              type="dashed"
              onClick={() => addIngredientRow('seasoning')}
              icon={<PlusOutlined />}
              block
            >
              添加调料
            </Button>
          </div>
        );

      case 2:
        return (
          <>
            <Divider orientation="left">{TEXT.recipes.utensils}</Divider>
            <Form.Item label="选择已有厨具">
              <Select
                mode="multiple"
                placeholder="选择厨具"
                value={selectedUtensils}
                onChange={setSelectedUtensils}
                options={utensilList.map((u) => ({ value: u.name, label: u.name }))}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item label="手动输入其他厨具">
              <Input
                value={customUtensils}
                onChange={(e) => setCustomUtensils(e.target.value)}
                placeholder="多个用顿号分隔，如：砂锅、蒸笼"
              />
            </Form.Item>

            <Divider orientation="left">{TEXT.recipes.steps}</Divider>
            {stepItems.map((step, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'flex-start' }}>
                <Text strong style={{ minWidth: 28, marginTop: 4 }}>{idx + 1}.</Text>
                <TextArea
                  rows={2}
                  value={step.description}
                  onChange={(e) => updateStep(idx, e.target.value)}
                  placeholder={`步骤 ${idx + 1} 的描述`}
                  style={{ flex: 1 }}
                />
                <Space direction="vertical" size={2}>
                  <Tooltip title="上移">
                    <Button
                      size="small"
                      icon={<ArrowUpOutlined />}
                      disabled={idx === 0}
                      onClick={() => moveStep(idx, 'up')}
                    />
                  </Tooltip>
                  <Tooltip title="下移">
                    <Button
                      size="small"
                      icon={<ArrowDownOutlined />}
                      disabled={idx === stepItems.length - 1}
                      onClick={() => moveStep(idx, 'down')}
                    />
                  </Tooltip>
                  <Tooltip title="删除">
                    <Button
                      size="small"
                      danger
                      icon={<MinusCircleOutlined />}
                      onClick={() => removeStep(idx)}
                    />
                  </Tooltip>
                </Space>
              </div>
            ))}
            <Button type="dashed" onClick={addStep} icon={<PlusOutlined />} block>
              添加步骤
            </Button>
          </>
        );

      case 3:
        return (
          <>
            <Divider orientation="left">标签</Divider>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="method" label={TEXT.recipes.attributes.method}>
                  <Select mode="multiple" options={METHOD_OPTIONS} placeholder="选择烹饪方式" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="spiciness" label={TEXT.recipes.attributes.spiciness}>
                  <Select options={SPICINESS_OPTIONS} allowClear placeholder="选择辣度" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="greasiness" label={TEXT.recipes.attributes.greasiness}>
                  <Select options={GREASINESS_OPTIONS} allowClear placeholder="选择油腻度" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="flavor" label={TEXT.recipes.attributes.flavor}>
                  <Select options={FLAVOR_OPTIONS} allowClear placeholder="选择口味" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="diet_type" label={TEXT.recipes.attributes.dietType}>
                  <Select options={DIET_OPTIONS} allowClear placeholder="选择荤素" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="nutrition" label={TEXT.recipes.attributes.nutrition}>
                  <Select mode="multiple" options={NUTRITION_OPTIONS} placeholder="选择营养" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="scene" label={TEXT.recipes.attributes.scene}>
                  <Select mode="multiple" options={SCENE_OPTIONS} placeholder="选择场景" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="cuisine" label={TEXT.recipes.attributes.cuisine}>
                  <Select options={CUISINE_OPTIONS} allowClear placeholder="选择菜系" />
                </Form.Item>
              </Col>
            </Row>

            <Divider orientation="left">{TEXT.recipes.photos}</Divider>
            <Upload
              listType="picture-card"
              beforeUpload={(file) => {
                setPhotoFiles((prev) => [...prev, file]);
                return false;
              }}
              showUploadList={{
                showPreviewIcon: true,
                showRemoveIcon: true,
              }}
              onRemove={(file) => {
                const idx = photoFiles.findIndex((_, i) => `new-${i}` === file.uid);
                if (idx >= 0) setPhotoFiles((prev) => prev.filter((_, i) => i !== idx));
              }}
              fileList={photoFiles.map((f, i) => ({
                uid: `new-${i}`,
                name: f.name,
                status: 'done' as const,
                url: URL.createObjectURL(f),
                originFileObj: f as any,
              }))}
            >
              {photoFiles.length < 9 && (
                <div>
                  <UploadOutlined />
                  <div style={{ marginTop: 8 }}>上传照片</div>
                </div>
              )}
            </Upload>
          </>
        );

      default:
        return null;
    }
  };

  // ─── 列表视图列定义 ────────────────────────────────────────────────────────

  const columns: ColumnsType<Recipe> = [
    {
      title: '菜名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: TEXT.recipes.difficulty,
      dataIndex: 'difficulty',
      key: 'difficulty',
      render: (d: Difficulty | null) =>
        d ? <Tag color={DIFFICULTY_COLOR[d]}>{DIFFICULTY_LABEL[d]}</Tag> : '-',
    },
    {
      title: TEXT.recipes.cookTime,
      dataIndex: 'cook_time_minutes',
      key: 'cook_time_minutes',
      render: (v: number | null) => (v ? `${v}分钟` : '-'),
    },
    {
      title: TEXT.recipes.attributes.method,
      key: 'method',
      render: (_, record) => {
        const methods = record.attributes?.method;
        return methods?.length ? methods.map((m) => <Tag key={m}>{m}</Tag>) : '-';
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
            查看
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
            {TEXT.common.edit}
          </Button>
          <Popconfirm
            title="确认删除该菜谱？"
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

  // ─── 渲染 ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>{TEXT.recipes.title}</Title>

      {/* 搜索 & 筛选 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col flex="auto">
            <Space wrap>
              <Input
                placeholder="搜索菜名"
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 200 }}
                allowClear
              />
              <Select
                mode="multiple"
                placeholder={TEXT.recipes.attributes.method}
                value={filterMethod}
                onChange={setFilterMethod}
                options={METHOD_OPTIONS}
                style={{ minWidth: 160 }}
                allowClear
                maxTagCount={2}
              />
              <Select
                placeholder={TEXT.recipes.attributes.spiciness}
                value={filterSpiciness}
                onChange={setFilterSpiciness}
                options={SPICINESS_OPTIONS}
                style={{ width: 120 }}
                allowClear
              />
              <Select
                placeholder={TEXT.recipes.attributes.dietType}
                value={filterDiet}
                onChange={setFilterDiet}
                options={DIET_OPTIONS}
                style={{ width: 120 }}
                allowClear
              />
              <Select
                mode="multiple"
                placeholder={TEXT.recipes.attributes.scene}
                value={filterScene}
                onChange={setFilterScene}
                options={SCENE_OPTIONS}
                style={{ minWidth: 160 }}
                allowClear
                maxTagCount={1}
              />
            </Space>
          </Col>
          <Col>
            <Space>
              <Button
                icon={viewMode === 'card' ? <AppstoreOutlined /> : <UnorderedListOutlined />}
                onClick={() => setViewMode((v) => (v === 'card' ? 'list' : 'card'))}
              >
                {viewMode === 'card' ? '列表视图' : '卡片视图'}
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
                {TEXT.recipes.addRecipe}
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 列表 */}
      <Spin spinning={loading}>
        {recipes.length === 0 && !loading ? (
          <Empty description={TEXT.common.noData} style={{ marginTop: 64 }} />
        ) : viewMode === 'card' ? (
          <Row gutter={[16, 16]}>
            {recipes.map((recipe) => (
              <Col key={recipe.id} xs={24} sm={12} lg={8} xl={6}>
                <RecipeCard
                  recipe={recipe}
                  onView={() => openDetail(recipe)}
                  onEdit={() => openEditModal(recipe)}
                  onDelete={() => handleDelete(recipe.id)}
                />
              </Col>
            ))}
          </Row>
        ) : (
          <Table
            columns={columns}
            dataSource={recipes}
            rowKey="id"
            pagination={{ pageSize: 20 }}
          />
        )}
      </Spin>

      {/* 新增/编辑 Modal */}
      <Modal
        title={editingRecipe ? `编辑菜谱` : TEXT.recipes.addRecipe}
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        width={720}
        destroyOnClose
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              {formStep > 0 && (
                <Button onClick={() => setFormStep((s) => s - 1)}>上一步</Button>
              )}
            </div>
            <Space>
              <Button onClick={() => setFormOpen(false)}>{TEXT.common.cancel}</Button>
              {formStep < formStepItems.length - 1 ? (
                <Button type="primary" onClick={() => setFormStep((s) => s + 1)}>
                  下一步
                </Button>
              ) : (
                <Button type="primary" loading={submitting} onClick={handleFormSubmit}>
                  {TEXT.common.save}
                </Button>
              )}
            </Space>
          </div>
        }
      >
        <Steps
          current={formStep}
          items={formStepItems}
          size="small"
          style={{ marginBottom: 24 }}
        />
        <Form form={form} layout="vertical">
          {renderFormStep()}
        </Form>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title={TEXT.recipes.recipeDetail}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailData(null);
        }}
        width={560}
        extra={
          detailData && (
            <Space>
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  setDetailOpen(false);
                  openEditModal(detailData);
                }}
              >
                {TEXT.common.edit}
              </Button>
              <Popconfirm
                title="确认删除该菜谱？"
                onConfirm={() => {
                  handleDelete(detailData.id);
                  setDetailOpen(false);
                }}
                okText={TEXT.common.confirm}
                cancelText={TEXT.common.cancel}
              >
                <Button danger icon={<DeleteOutlined />}>
                  {TEXT.common.delete}
                </Button>
              </Popconfirm>
            </Space>
          )
        }
      >
        {detailLoading ? (
          <Spin style={{ display: 'block', margin: '64px auto' }} />
        ) : detailData ? (
          <RecipeDetailContent
            data={detailData}
            photoUrls={photoUrls}
            onDeletePhoto={handleDeletePhoto}
          />
        ) : null}
      </Drawer>
    </div>
  );
}

// ─── 子组件：食材行输入 ──────────────────────────────────────────────────────

function IngredientRowInput({
  row,
  originalIndex,
  inventoryList,
  onUpdate,
  onRemove,
  showAmount,
}: {
  row: IngredientRow;
  originalIndex: number;
  inventoryList: InventoryItem[];
  onUpdate: (index: number, field: keyof IngredientRow, value: string) => void;
  onRemove: (index: number) => void;
  showAmount?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
      <Select
        showSearch
        placeholder="选择食材"
        value={row.inventory_id || undefined}
        onChange={(v) => onUpdate(originalIndex, 'inventory_id', v)}
        options={inventoryList.map((inv) => ({
          value: inv.id,
          label: `${inv.name}`,
        }))}
        filterOption={(input, option) =>
          (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
        }
        style={{ flex: 2 }}
      />
      {showAmount && (
        <Input
          placeholder="用量，如 300g"
          value={row.amount}
          onChange={(e) => onUpdate(originalIndex, 'amount', e.target.value)}
          style={{ flex: 1 }}
        />
      )}
      <Button
        size="small"
        danger
        icon={<MinusCircleOutlined />}
        onClick={() => onRemove(originalIndex)}
      />
    </div>
  );
}

// ─── 子组件：菜谱卡片 ────────────────────────────────────────────────────────

function RecipeCard({
  recipe,
  onView,
  onEdit,
  onDelete,
}: {
  recipe: Recipe;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const methods = recipe.attributes?.method || [];
  return (
    <Card
      hoverable
      actions={[
        <Tooltip title="查看详情" key="view">
          <EyeOutlined onClick={onView} />
        </Tooltip>,
        <Tooltip title="编辑" key="edit">
          <EditOutlined onClick={onEdit} />
        </Tooltip>,
        <Popconfirm
          title="确认删除该菜谱？"
          onConfirm={onDelete}
          okText={TEXT.common.confirm}
          cancelText={TEXT.common.cancel}
          key="delete"
        >
          <Tooltip title="删除">
            <DeleteOutlined style={{ color: '#ff4d4f' }} />
          </Tooltip>
        </Popconfirm>,
      ]}
    >
      <Card.Meta
        title={recipe.name}
        description={
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Space>
              {recipe.difficulty && (
                <Tag color={DIFFICULTY_COLOR[recipe.difficulty]}>
                  {DIFFICULTY_LABEL[recipe.difficulty]}
                </Tag>
              )}
              {recipe.cook_time_minutes && (
                <Tag icon={<ClockCircleOutlined />}>{recipe.cook_time_minutes}分钟</Tag>
              )}
            </Space>
            {methods.length > 0 && (
              <div>
                {methods.map((m) => (
                  <Tag key={m} style={{ marginBottom: 4 }}>
                    {m}
                  </Tag>
                ))}
              </div>
            )}
            {recipe.attributes?.spiciness && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {recipe.attributes.spiciness}
                {recipe.attributes.greasiness ? ` · ${recipe.attributes.greasiness}` : ''}
                {recipe.attributes.diet_type ? ` · ${recipe.attributes.diet_type}` : ''}
              </Text>
            )}
          </Space>
        }
      />
    </Card>
  );
}

// ─── 子组件：详情内容 ─────────────────────────────────────────────────────────

function RecipeDetailContent({
  data,
  photoUrls,
  onDeletePhoto,
}: {
  data: RecipeDetail;
  photoUrls: Record<string, string>;
  onDeletePhoto: (photoId: string) => void;
}) {
  const mainIngs = data.ingredients.filter((i) => i.role === 'main');
  const auxIngs = data.ingredients.filter((i) => i.role === 'auxiliary');
  const seaIngs = data.ingredients.filter((i) => i.role === 'seasoning');

  const renderIngredientList = (ings: RecipeDetail['ingredients']) => (
    <List
      size="small"
      dataSource={ings}
      renderItem={(ing) => (
        <List.Item
          extra={
            ing.inventory ? (
              <Tag color={STOCK_COLOR[ing.inventory.stock_level as StockLevel]}>
                {STOCK_LABEL[ing.inventory.stock_level as StockLevel] || ing.inventory.stock_level}
              </Tag>
            ) : (
              <Tag color="default">未知</Tag>
            )
          }
        >
          <List.Item.Meta
            title={ing.inventory?.name || '已删除的食材'}
            description={ing.amount ? `用量：${ing.amount}` : undefined}
          />
        </List.Item>
      )}
    />
  );

  return (
    <div>
      <Descriptions column={2} bordered size="small">
        <Descriptions.Item label="菜名" span={2}>
          {data.name}
        </Descriptions.Item>
        <Descriptions.Item label={TEXT.recipes.difficulty}>
          {data.difficulty ? (
            <Tag color={DIFFICULTY_COLOR[data.difficulty]}>
              {DIFFICULTY_LABEL[data.difficulty]}
            </Tag>
          ) : (
            '-'
          )}
        </Descriptions.Item>
        <Descriptions.Item label={TEXT.recipes.cookTime}>
          {data.cook_time_minutes ? `${data.cook_time_minutes} 分钟` : '-'}
        </Descriptions.Item>
      </Descriptions>

      {/* 标签 */}
      {data.attributes && Object.keys(data.attributes).length > 0 && (
        <>
          <Divider orientation="left" style={{ fontSize: 14 }}>
            标签
          </Divider>
          <Space wrap>
            {data.attributes.method?.map((m) => (
              <Tag key={`m-${m}`} color="blue">
                {m}
              </Tag>
            ))}
            {data.attributes.spiciness && <Tag color="red">{data.attributes.spiciness}</Tag>}
            {data.attributes.greasiness && <Tag color="orange">{data.attributes.greasiness}</Tag>}
            {data.attributes.flavor && <Tag color="purple">{data.attributes.flavor}</Tag>}
            {data.attributes.diet_type && <Tag color="cyan">{data.attributes.diet_type}</Tag>}
            {data.attributes.nutrition?.map((n) => (
              <Tag key={`n-${n}`} color="geekblue">
                {n}
              </Tag>
            ))}
            {data.attributes.scene?.map((s) => (
              <Tag key={`s-${s}`} color="magenta">
                {s}
              </Tag>
            ))}
            {data.attributes.cuisine && <Tag color="gold">{data.attributes.cuisine}</Tag>}
          </Space>
        </>
      )}

      {/* 主要食材 */}
      {mainIngs.length > 0 && (
        <>
          <Divider orientation="left" style={{ fontSize: 14 }}>
            {TEXT.recipes.ingredients}
          </Divider>
          {renderIngredientList(mainIngs)}
        </>
      )}

      {/* 辅助食材 */}
      {auxIngs.length > 0 && (
        <>
          <Divider orientation="left" style={{ fontSize: 14 }}>
            {TEXT.recipes.auxiliaryIngredients}
          </Divider>
          {renderIngredientList(auxIngs)}
        </>
      )}

      {/* 调料 */}
      {seaIngs.length > 0 && (
        <>
          <Divider orientation="left" style={{ fontSize: 14 }}>
            {TEXT.recipes.seasonings}
          </Divider>
          {renderIngredientList(seaIngs)}
        </>
      )}

      {/* 厨具 */}
      {data.utensils.length > 0 && (
        <>
          <Divider orientation="left" style={{ fontSize: 14 }}>
            {TEXT.recipes.utensils}
          </Divider>
          <Space wrap>
            {data.utensils.map((u) => (
              <Tag key={u.id}>{u.utensil_name}</Tag>
            ))}
          </Space>
        </>
      )}

      {/* 步骤 */}
      {data.steps && data.steps.length > 0 && (
        <>
          <Divider orientation="left" style={{ fontSize: 14 }}>
            {TEXT.recipes.steps}
          </Divider>
          <List
            size="small"
            dataSource={[...data.steps].sort((a, b) => a.step_number - b.step_number)}
            renderItem={(step, idx) => (
              <List.Item>
                <Text strong style={{ marginRight: 8 }}>{idx + 1}.</Text>
                {step.description}
              </List.Item>
            )}
          />
        </>
      )}

      {/* 照片 */}
      {data.photos && data.photos.length > 0 && (
        <>
          <Divider orientation="left" style={{ fontSize: 14 }}>
            {TEXT.recipes.photos}
          </Divider>
          <Image.PreviewGroup>
            <Row gutter={[8, 8]}>
              {data.photos.map((photo) => (
                <Col key={photo.id}>
                  <div style={{ position: 'relative' }}>
                    <Image
                      src={photoUrls[photo.id] || ''}
                      width={100}
                      height={100}
                      style={{ objectFit: 'cover', borderRadius: 6 }}
                    />
                    <Popconfirm
                      title="删除此照片？"
                      onConfirm={() => onDeletePhoto(photo.id)}
                      okText={TEXT.common.confirm}
                      cancelText={TEXT.common.cancel}
                    >
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        style={{ position: 'absolute', top: 2, right: 2 }}
                      />
                    </Popconfirm>
                  </div>
                </Col>
              ))}
            </Row>
          </Image.PreviewGroup>
        </>
      )}

      {/* Tips */}
      {data.tips && (
        <>
          <Divider orientation="left" style={{ fontSize: 14 }}>
            {TEXT.recipes.tips}
          </Divider>
          <Text>{data.tips}</Text>
        </>
      )}
    </div>
  );
}
