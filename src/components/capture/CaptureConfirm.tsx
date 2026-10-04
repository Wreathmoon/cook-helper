'use client';

/**
 * 通用确认列表 —— 视觉管线和文本管线**共用同一个**（Task/11 决策 ①）。
 *
 * 这个组件是整个 AI 录入功能的安全带。它存在的唯一理由是决策 ⑦：
 * **任何 AI 产生的写入，落库前都必须经过用户过目。** 没有高置信度旁路。
 *
 * 两条设计约束，都不是装饰：
 *
 * 1. **「已有」和「新食材」必须分区显示。** 改一个已有食材的档位是低风险操作；
 *    往库存里凭空加一样东西是高风险的（它会长期参与推荐分档）。混在一个列表里，
 *    用户会用同一种注意力扫过去。
 * 2. **新食材的分类必须是可见可改的下拉，不能是隐藏的默认值。** 分类决定了
 *    库存页把它归到哪一档、`tiering.ts` 怎么算它。模型猜错了而用户看不见，
 *    这条错误会一直躺在 vault 里。
 */

import { useMemo, useState } from 'react';
import { Segmented, Select, Button } from 'antd';
import type { InventoryCategory, StockLevel } from '@/types';
import type { CaptureDecision, ProposedIngredient } from '@/lib/services/capture';
import { TEXT } from '@/lib/constants/text';
import { FRESH_HINT } from '@/lib/ai/text';
import { StatusDot } from '@/components/shared/StatusDot';

const LEVEL_OPTIONS: { value: StockLevel; label: string }[] = [
  { value: 'enough', label: TEXT.inventory.stockLevel.enough },
  { value: 'low', label: TEXT.inventory.stockLevel.low },
  { value: 'out', label: TEXT.inventory.stockLevel.out },
];

const CATEGORY_OPTIONS = (
  Object.entries(TEXT.inventory.categories) as [InventoryCategory, string][]
).map(([value, label]) => ({ value, label }));

const DOT: Record<StockLevel, 'good' | 'warn' | 'bad'> = {
  enough: 'good',
  low: 'warn',
  out: 'bad',
};

/** 一行的可变状态：要不要、什么档位、（新食材）哪个分类 */
interface RowState {
  included: boolean;
  level: StockLevel;
  category: InventoryCategory;
}

export interface CaptureConfirmProps {
  existing: ProposedIngredient[];
  fresh: ProposedIngredient[];
  submitting?: boolean;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (decisions: CaptureDecision[]) => void;
  /** 顶部额外说明（例如「做完了 X」）*/
  header?: React.ReactNode;
}

export function CaptureConfirm({
  existing,
  fresh,
  submitting,
  submitLabel = '确认录入',
  onCancel,
  onSubmit,
  header,
}: CaptureConfirmProps) {
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const initial: Record<string, RowState> = {};
    for (const item of [...existing, ...fresh]) {
      initial[item.id] = {
        included: true,
        level: item.suggestedLevel,
        category: item.category,
      };
    }
    return initial;
  });

  const update = (id: string, patch: Partial<RowState>) =>
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const includedCount = useMemo(
    () => Object.values(rows).filter((row) => row.included).length,
    [rows]
  );

  const submit = () => {
    const decisions: CaptureDecision[] = [];
    for (const item of existing) {
      const row = rows[item.id];
      if (!row?.included) continue;
      decisions.push({
        id: item.id,
        name: item.name,
        category: row.category,
        stock_level: row.level,
        isNew: false,
      });
    }
    for (const item of fresh) {
      const row = rows[item.id];
      if (!row?.included) continue;
      decisions.push({
        id: item.id,
        name: item.name,
        category: row.category,
        stock_level: row.level,
        isNew: true,
      });
    }
    onSubmit(decisions);
  };

  const renderRow = (item: ProposedIngredient, isNew: boolean) => {
    const row = rows[item.id];
    if (!row) return null;

    return (
      <div
        key={item.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 0',
          opacity: row.included ? 1 : 0.4,
          borderBottom: '1px solid var(--line)',
        }}
      >
        <input
          type="checkbox"
          checked={row.included}
          onChange={(e) => update(item.id, { included: e.target.checked })}
          style={{ cursor: 'pointer', flexShrink: 0 }}
          aria-label={`要不要录入 ${item.name}`}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {!isNew && <StatusDot status={DOT[item.currentLevel ?? 'enough']} />}
            <span style={{ fontSize: 13, color: 'var(--tx)' }}>{item.name}</span>
          </div>
          {/* 原文和归一化后的名字不一样 = 别名表起作用了。让用户看见，
              否则「我明明拍的是番茄，怎么变成西红柿了」会被当成 bug */}
          {item.rawName !== item.name && (
            <div style={{ fontSize: 11, color: 'var(--tx2)' }}>识别为「{item.rawName}」</div>
          )}
        </div>

        {isNew && (
          <Select
            size="small"
            value={row.category}
            onChange={(value) => update(item.id, { category: value })}
            options={CATEGORY_OPTIONS}
            style={{ width: 110, flexShrink: 0 }}
            disabled={!row.included}
          />
        )}

        <Segmented
          size="small"
          value={row.level}
          onChange={(value) => update(item.id, { level: value as StockLevel })}
          options={LEVEL_OPTIONS}
          disabled={!row.included}
        />
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {header}

      <div style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.6 }}>
        AI 认出了下面这些。<b style={{ color: 'var(--tx)' }}>落库前请过一眼</b>
        —— 改错的库存会直接影响推荐。
      </div>

      {existing.length > 0 && (
        <section>
          <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx2)', margin: '0 0 4px' }}>
            已有食材 · 改档位（{existing.length}）
          </h4>
          {existing.map((item) => renderRow(item, false))}
        </section>
      )}

      {fresh.length > 0 && (
        <section>
          <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--notice)', margin: '0 0 2px' }}>
            新食材 · 会新增（{fresh.length}）
          </h4>
          <div style={{ fontSize: 11, color: 'var(--tx2)', marginBottom: 4 }}>{FRESH_HINT}</div>
          {fresh.map((item) => renderRow(item, true))}
        </section>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
        <Button size="small" onClick={onCancel} disabled={submitting}>
          取消
        </Button>
        <Button
          size="small"
          type="primary"
          onClick={submit}
          loading={submitting}
          disabled={includedCount === 0}
        >
          {submitLabel}（{includedCount}）
        </Button>
      </div>
    </div>
  );
}
