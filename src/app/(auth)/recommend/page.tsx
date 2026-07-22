'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Tag,
  Select,
  Checkbox,
  Button,
  Spin,
  Drawer,
  List,
  Typography,
  Space,
  message,
  Empty,
  Divider,
  Row,
  Col,
} from 'antd';
import {
  ShoppingCartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FireOutlined,
} from '@ant-design/icons';
import { TEXT } from '@/lib/constants/text';
import {
  getRecommendations,
  generateShoppingListAction,
  checkoutShoppingListAction,
} from '@/app/actions/recommend';
import type { RecommendedRecipe, ShoppingListItem, RecommendTier } from '@/types';

const { Title, Text } = Typography;

// 档位配置
const TIER_CONFIG: Record<
  RecommendTier,
  { label: string; emoji: string; color: string; tagColor: string }
> = {
  can_make_now: {
    label: TEXT.recommend.tiers.can_make_now,
    emoji: '🟢',
    color: '#52c41a',
    tagColor: 'green',
  },
  clear_stock: {
    label: TEXT.recommend.tiers.clear_stock,
    emoji: '🟡',
    color: '#faad14',
    tagColor: 'orange',
  },
  need_shopping: {
    label: TEXT.recommend.tiers.need_shopping,
    emoji: '🔵',
    color: '#1677ff',
    tagColor: 'blue',
  },
};

// 难度映射
const DIFFICULTY_MAP: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

export default function RecommendPage() {
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<RecommendedRecipe[]>([]);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<Set<string>>(new Set());
  const [shoppingListOpen, setShoppingListOpen] = useState(false);
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);
  const [shoppingLoading, setShoppingLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  // 筛选状态
  const [maxCookTime, setMaxCookTime] = useState<number | undefined>(undefined);
  const [spiciness, setSpiciness] = useState<string | undefined>(undefined);
  const [dietType, setDietType] = useState<string | undefined>(undefined);
  const [method, setMethod] = useState<string[]>([]);

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      const filters: Record<string, unknown> = {};
      if (maxCookTime) filters.maxCookTime = maxCookTime;
      if (spiciness) filters.spiciness = spiciness;
      if (dietType) filters.dietType = dietType;
      if (method.length > 0) filters.method = method;

      const res = await getRecommendations(filters as Parameters<typeof getRecommendations>[0]);
      if (res.data) {
        setRecommendations(res.data);
      }
    } catch {
      message.error(TEXT.common.error);
    } finally {
      setLoading(false);
    }
  }, [maxCookTime, spiciness, dietType, method]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  // 按档位分组
  const groupedByTier = recommendations.reduce(
    (acc, r) => {
      if (!acc[r.tier]) acc[r.tier] = [];
      acc[r.tier].push(r);
      return acc;
    },
    {} as Record<string, RecommendedRecipe[]>
  );

  const handleRecipeToggle = (recipeId: string) => {
    setSelectedRecipeIds((prev) => {
      const next = new Set(prev);
      if (next.has(recipeId)) {
        next.delete(recipeId);
      } else {
        next.add(recipeId);
      }
      return next;
    });
  };

  const handleGenerateShoppingList = async () => {
    if (selectedRecipeIds.size === 0) {
      message.warning(TEXT.recommend.selectRecipes);
      return;
    }
    setShoppingLoading(true);
    try {
      const res = await generateShoppingListAction(Array.from(selectedRecipeIds));
      if (res.data) {
        setShoppingList(res.data);
        setCheckedItems(new Set());
        setShoppingListOpen(true);
      } else if (res.error) {
        message.error(res.error);
      }
    } catch {
      message.error(TEXT.common.error);
    } finally {
      setShoppingLoading(false);
    }
  };

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const ids = Array.from(checkedItems);
      const res = await checkoutShoppingListAction(ids);
      if (res.error) {
        message.error(res.error);
      } else {
        message.success('库存已更新');
        setShoppingListOpen(false);
        setSelectedRecipeIds(new Set());
        fetchRecommendations();
      }
    } catch {
      message.error(TEXT.common.error);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleShoppingItemToggle = (itemId: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <Title level={2}>{TEXT.recommend.title}</Title>

      {/* 筛选器 */}
      <Card size="small" style={{ marginBottom: 24 }}>
        <Row gutter={[16, 12]} align="middle">
          <Col>
            <Text type="secondary">{TEXT.recommend.filters}：</Text>
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Select
              placeholder="烹饪时间"
              allowClear
              style={{ width: '100%' }}
              value={maxCookTime}
              onChange={(v) => setMaxCookTime(v)}
              options={[
                { label: '30分钟内', value: 30 },
                { label: '1小时内', value: 60 },
                { label: '不限', value: undefined as unknown as number },
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Select
              placeholder="辣度"
              allowClear
              style={{ width: '100%' }}
              value={spiciness}
              onChange={(v) => setSpiciness(v)}
              options={[
                { label: '不辣', value: '不辣' },
                { label: '微辣', value: '微辣' },
                { label: '中辣', value: '中辣' },
                { label: '重辣', value: '重辣' },
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Select
              placeholder="荤素"
              allowClear
              style={{ width: '100%' }}
              value={dietType}
              onChange={(v) => setDietType(v)}
              options={[
                { label: '纯荤', value: '纯荤' },
                { label: '荤素搭配', value: '荤素搭配' },
                { label: '纯素', value: '纯素' },
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              mode="multiple"
              placeholder="烹饪方式"
              allowClear
              style={{ width: '100%' }}
              value={method}
              onChange={(v) => setMethod(v)}
              options={[
                { label: '炒', value: '炒' },
                { label: '炖', value: '炖' },
                { label: '蒸', value: '蒸' },
                { label: '煮', value: '煮' },
                { label: '烤', value: '烤' },
                { label: '凉拌', value: '凉拌' },
                { label: '炸', value: '炸' },
              ]}
            />
          </Col>
        </Row>
      </Card>

      {/* 推荐内容 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin size="large" tip={TEXT.common.loading} />
        </div>
      ) : recommendations.length === 0 ? (
        <Empty description="暂无推荐，去添加一些食材和菜谱吧" style={{ padding: 80 }} />
      ) : (
        <>
          {/* 按档位分组显示 */}
          {(['can_make_now', 'clear_stock', 'need_shopping'] as RecommendTier[]).map((tier) => {
            const tierRecipes = groupedByTier[tier];
            if (!tierRecipes || tierRecipes.length === 0) return null;
            const config = TIER_CONFIG[tier];

            return (
              <div key={tier} style={{ marginBottom: 32 }}>
                <Title level={4}>
                  {config.emoji} {config.label}
                </Title>
                <Row gutter={[16, 16]}>
                  {tierRecipes.map((rec) => (
                    <Col xs={24} sm={12} lg={6} key={rec.recipe.id}>
                      <Card
                        hoverable
                        size="small"
                        style={{
                          borderLeft: `3px solid ${config.color}`,
                          height: '100%',
                        }}
                      >
                        <div style={{ marginBottom: 8 }}>
                          <Tag color={config.tagColor}>{config.label}</Tag>
                          {rec.recipe.difficulty && (
                            <Tag>{DIFFICULTY_MAP[rec.recipe.difficulty] || rec.recipe.difficulty}</Tag>
                          )}
                        </div>

                        <Title level={5} style={{ marginBottom: 8 }}>
                          {rec.recipe.name}
                        </Title>

                        <Space size={4} wrap style={{ marginBottom: 8 }}>
                          {rec.recipe.cook_time_minutes && (
                            <Tag icon={<ClockCircleOutlined />}>
                              {rec.recipe.cook_time_minutes}分钟
                            </Tag>
                          )}
                          {rec.recipe.attributes?.method?.map((m) => (
                            <Tag key={m} icon={<FireOutlined />}>
                              {m}
                            </Tag>
                          ))}
                          {rec.recipe.attributes?.spiciness && (
                            <Tag color="red">{rec.recipe.attributes.spiciness}</Tag>
                          )}
                        </Space>

                        {/* 需额外购买档：缺少食材 */}
                        {tier === 'need_shopping' && rec.missingIngredients && (
                          <div style={{ marginBottom: 8 }}>
                            <Text type="danger" style={{ fontSize: 12 }}>
                              缺少：{rec.missingIngredients.join('、')}
                            </Text>
                          </div>
                        )}
                        {tier === 'need_shopping' && rec.missingUtensils && (
                          <div style={{ marginBottom: 8 }}>
                            <Text type="danger" style={{ fontSize: 12 }}>
                              缺少厨具：{rec.missingUtensils.join('、')}
                            </Text>
                          </div>
                        )}

                        {/* 清库存档：需消耗食材 */}
                        {tier === 'clear_stock' && rec.clearStockIngredients && (
                          <div style={{ marginBottom: 8 }}>
                            <Text style={{ fontSize: 12, color: '#fa8c16' }}>
                              尽快消耗：{rec.clearStockIngredients.join('、')}
                            </Text>
                          </div>
                        )}

                        <Checkbox
                          checked={selectedRecipeIds.has(rec.recipe.id)}
                          onChange={() => handleRecipeToggle(rec.recipe.id)}
                        >
                          想做
                        </Checkbox>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </div>
            );
          })}

          {/* 生成购物清单按钮 */}
          {selectedRecipeIds.size > 0 && (
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Button
                type="primary"
                size="large"
                icon={<ShoppingCartOutlined />}
                loading={shoppingLoading}
                onClick={handleGenerateShoppingList}
              >
                {TEXT.recommend.generateList}（已选 {selectedRecipeIds.size} 道菜）
              </Button>
            </div>
          )}
        </>
      )}

      {/* 购物清单 Drawer */}
      <Drawer
        title={TEXT.recommend.shoppingList}
        open={shoppingListOpen}
        onClose={() => setShoppingListOpen(false)}
        width={480}
        footer={
          checkedItems.size > 0 ? (
            <div style={{ textAlign: 'right' }}>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={checkoutLoading}
                onClick={handleCheckout}
              >
                {TEXT.recommend.checkout}（{checkedItems.size} 项）
              </Button>
            </div>
          ) : null
        }
      >
        {shoppingList.length === 0 ? (
          <Empty description="购物清单为空" />
        ) : (
          <List
            dataSource={shoppingList}
            renderItem={(item, index) => {
              const itemKey = item.inventoryId || `${item.name}-${index}`;
              return (
                <List.Item>
                  <div style={{ width: '100%' }}>
                    <Checkbox
                      checked={checkedItems.has(itemKey)}
                      disabled={!item.inventoryId}
                      onChange={() => handleShoppingItemToggle(itemKey)}
                    >
                      <Space direction="vertical" size={0}>
                        <Text strong>{item.name}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          来源：{item.source}
                          {item.suggestedAmount && ` · 建议量：${item.suggestedAmount}`}
                        </Text>
                      </Space>
                    </Checkbox>
                  </div>
                </List.Item>
              );
            }}
          />
        )}
      </Drawer>
    </div>
  );
}
