'use client';

import { useEffect, useState, useCallback, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { message } from 'antd';
import { createRecipeAction, getInventoryForRecipe } from '@/app/actions/recipe';
import type { CookingMethod, Spiciness, IngredientRole, InventoryItem } from '@/types';

const METHOD_OPTIONS: CookingMethod[] = ['炒', '炖', '蒸', '煮', '烤', '凉拌', '炸'];
const SPICY_OPTIONS: Spiciness[] = ['不辣', '微辣', '中辣', '重辣'];
const TIME_OPTIONS: { label: string; value: number }[] = [
  { label: '15分钟', value: 15 },
  { label: '30分钟', value: 30 },
  { label: '45分钟', value: 45 },
  { label: '60分钟+', value: 60 },
];
const ROLE_OPTIONS: { label: string; value: IngredientRole }[] = [
  { label: '主料', value: 'main' },
  { label: '辅料', value: 'auxiliary' },
  { label: '调料', value: 'seasoning' },
];

interface IngredientRow {
  key: string;
  inventoryId: string;
  role: IngredientRole;
  amount: string;
}

interface StepRow {
  key: string;
  description: string;
}

function makeKey() {
  return Math.random().toString(36).slice(2);
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        border: `1px solid ${active ? 'var(--primary)' : 'var(--line)'}`,
        background: active ? 'var(--primary-soft)' : 'var(--panel)',
        color: active ? 'var(--primary)' : 'var(--tx)',
        fontWeight: active ? 600 : 400,
        borderRadius: 99,
        padding: '5px 14px',
        fontSize: 12.5,
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {label}
    </span>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--tx)', marginBottom: 8 }}>
      {children}
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid var(--line)',
  background: 'var(--panel)',
  color: 'var(--tx)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

export default function NewRecipePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [method, setMethod] = useState<CookingMethod | ''>('');
  const [spiciness, setSpiciness] = useState<Spiciness | ''>('');
  const [cookTime, setCookTime] = useState<number | ''>('');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [ingredients, setIngredients] = useState<IngredientRow[]>([
    { key: makeKey(), inventoryId: '', role: 'main', amount: '' },
  ]);
  const [steps, setSteps] = useState<StepRow[]>([{ key: makeKey(), description: '' }]);
  const [tips, setTips] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchInventory = useCallback(async () => {
    try {
      const res = await getInventoryForRecipe();
      if (res.data) setInventory(res.data);
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const updateIngredient = (key: string, patch: Partial<IngredientRow>) => {
    setIngredients((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const removeIngredient = (key: string) => {
    setIngredients((rows) => rows.filter((r) => r.key !== key));
  };

  const addIngredient = () => {
    setIngredients((rows) => [...rows, { key: makeKey(), inventoryId: '', role: 'main', amount: '' }]);
  };

  const updateStep = (key: string, description: string) => {
    setSteps((rows) => rows.map((r) => (r.key === key ? { ...r, description } : r)));
  };

  const removeStep = (key: string) => {
    setSteps((rows) => rows.filter((r) => r.key !== key));
  };

  const addStep = () => {
    setSteps((rows) => [...rows, { key: makeKey(), description: '' }]);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      message.error('先给这道菜起个名字');
      return;
    }
    const validIngredients = ingredients.filter((r) => r.inventoryId);
    if (validIngredients.length === 0) {
      message.error('至少填一种食材');
      return;
    }

    setSubmitting(true);
    try {
      const validSteps = steps.filter((s) => s.description.trim());
      const res = await createRecipeAction({
        name: name.trim(),
        steps: validSteps.map((s, i) => ({ step_number: i + 1, description: s.description.trim() })),
        cook_time_minutes: cookTime === '' ? undefined : cookTime,
        attributes: {
          ...(method ? { method: [method] } : {}),
          ...(spiciness ? { spiciness } : {}),
        },
        tips: tips.trim() || undefined,
        ingredients: validIngredients.map((r) => ({
          inventory_id: r.inventoryId,
          role: r.role,
          amount: r.amount.trim() || undefined,
        })),
      });
      if (res.error) {
        message.error(res.error);
      } else {
        message.success('菜谱已保存');
        router.push('/recipes');
      }
    } catch {
      message.error('操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div
        onClick={() => router.push('/recipes')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 12.5,
          color: 'var(--tx2)',
          cursor: 'pointer',
          marginBottom: 12,
        }}
      >
        ‹ 返回
      </div>
      <h1 style={{ fontSize: 19, fontWeight: 700, color: 'var(--tx)', margin: '0 0 20px' }}>新建菜谱</h1>

      <div
        style={{
          width: 560,
          margin: '0 auto',
          borderRadius: 14,
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          boxShadow: 'var(--shadow-card)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* 菜名 */}
        <div>
          <FieldLabel>菜名 *</FieldLabel>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="给这道菜起个名字"
            style={inputStyle}
          />
        </div>

        {/* 烹饪方式 */}
        <div>
          <FieldLabel>烹饪方式</FieldLabel>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {METHOD_OPTIONS.map((opt) => (
              <Chip key={opt} label={opt} active={method === opt} onClick={() => setMethod(method === opt ? '' : opt)} />
            ))}
          </div>
        </div>

        {/* 辣度 */}
        <div>
          <FieldLabel>辣度</FieldLabel>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SPICY_OPTIONS.map((opt) => (
              <Chip key={opt} label={opt} active={spiciness === opt} onClick={() => setSpiciness(spiciness === opt ? '' : opt)} />
            ))}
          </div>
        </div>

        {/* 烹饪时间 */}
        <div>
          <FieldLabel>烹饪时间</FieldLabel>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TIME_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                active={cookTime === opt.value}
                onClick={() => setCookTime(cookTime === opt.value ? '' : opt.value)}
              />
            ))}
          </div>
        </div>

        {/* 食材 */}
        <div>
          <FieldLabel>食材</FieldLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ingredients.map((row) => (
              <div key={row.key} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <select
                  value={row.inventoryId}
                  onChange={(e) => updateIngredient(row.key, { inventoryId: e.target.value })}
                  style={{ ...inputStyle, flex: 1.4, padding: '7px 10px' }}
                >
                  <option value="">选择食材</option>
                  {inventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <select
                  value={row.role}
                  onChange={(e) => updateIngredient(row.key, { role: e.target.value as IngredientRole })}
                  style={{ ...inputStyle, flex: 0.8, padding: '7px 10px' }}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={row.amount}
                  onChange={(e) => updateIngredient(row.key, { amount: e.target.value })}
                  placeholder="用量"
                  style={{ ...inputStyle, flex: 0.8, padding: '7px 10px' }}
                />
                <button
                  type="button"
                  onClick={() => removeIngredient(row.key)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx2)', fontSize: 14, flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addIngredient}
              style={{
                alignSelf: 'flex-start',
                padding: '5px 12px',
                borderRadius: 10,
                border: '1px dashed var(--line)',
                background: 'transparent',
                color: 'var(--primary)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              + 添加食材
            </button>
          </div>
        </div>

        {/* 步骤 */}
        <div>
          <FieldLabel>步骤</FieldLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {steps.map((row, i) => (
              <div key={row.key} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span
                  style={{
                    flex: 'none',
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: 'var(--primary-soft)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </span>
                <input
                  type="text"
                  value={row.description}
                  onChange={(e) => updateStep(row.key, e.target.value)}
                  placeholder={`第 ${i + 1} 步`}
                  style={{ ...inputStyle, flex: 1, padding: '7px 10px' }}
                />
                <button
                  type="button"
                  onClick={() => removeStep(row.key)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx2)', fontSize: 14, flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addStep}
              style={{
                alignSelf: 'flex-start',
                padding: '5px 12px',
                borderRadius: 10,
                border: '1px dashed var(--line)',
                background: 'transparent',
                color: 'var(--primary)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              + 添加步骤
            </button>
          </div>
        </div>

        {/* Tips */}
        <div>
          <FieldLabel>Tips</FieldLabel>
          <textarea
            value={tips}
            onChange={(e) => setTips(e.target.value)}
            placeholder="备注一些小技巧..."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        {/* 提交 */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            padding: 10,
            borderRadius: 10,
            border: '1px solid var(--primary-btn)',
            background: 'var(--primary-btn)',
            color: 'var(--primary-btn-tx)',
            fontWeight: 600,
            fontSize: 13.5,
            cursor: submitting ? 'default' : 'pointer',
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? '保存中...' : '保存菜谱'}
        </button>
      </div>
    </div>
  );
}
