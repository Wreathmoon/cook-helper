'use client';

/**
 * AI 录入面板 —— 三种输入（拍照 / 小票 / 一句话）汇进**同一个确认层**。
 *
 * 状态机只有四个态，刻意保持得这么小：
 *
 *   idle ──(选图 / 敲一句话)──▶ working ──▶ review ──(确认)──▶ done
 *     ▲                                       │                 │
 *     └───────────────(取消 / 再录一条)────────┴─────────────────┘
 *
 * `done` 态不是终点而是一个**带撤销的停留**（决策 ⑨）：录完了但还能反悔。
 * 关掉面板才真正结束——撤销状态只活在这次会话里，不落盘。
 */

import { useState } from 'react';
import { Modal, Segmented, Input, Button, Select, message } from 'antd';
import {
  applyCookedCaptureAction,
  applyInventoryCaptureAction,
  captureFromImageAction,
  captureFromTextAction,
  ingredientsForRecipeAction,
  undoCaptureAction,
  type TextCaptureResult,
} from '@/app/actions/capture';
import type {
  CaptureDecision,
  CaptureSnapshot,
  CookedProposal,
  InventoryProposal,
} from '@/lib/services/capture';
import { compressImage, formatBytes } from '@/lib/utils/compress-image';
import { CaptureConfirm } from './CaptureConfirm';

type Mode = 'photo' | 'receipt' | 'text';

const MODE_OPTIONS = [
  { value: 'photo', label: '拍照' },
  { value: 'receipt', label: '小票' },
  { value: 'text', label: '一句话' },
];

const PLACEHOLDER: Record<Mode, string> = {
  photo: '选一张购物袋或冰箱的照片',
  receipt: '选一张超市小票',
  text: '例如：我做完了红烧肉 / 西红柿没了',
};

type Stage =
  | { name: 'idle' }
  | { name: 'working'; hint: string }
  | { name: 'review-inventory'; proposal: InventoryProposal }
  | { name: 'review-cooked'; proposal: CookedProposal; recipeId: string | null }
  | { name: 'done'; snapshot: CaptureSnapshot; summary: string };

export interface CapturePanelProps {
  open: boolean;
  onClose: () => void;
  /** 打开时默认停在哪个模式 */
  defaultMode?: Mode;
  /** 落库成功后通知宿主页面刷新数据 */
  onApplied?: () => void;
}

export function CapturePanel({ open, onClose, defaultMode = 'photo', onApplied }: CapturePanelProps) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [stage, setStage] = useState<Stage>({ name: 'idle' });
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setStage({ name: 'idle' });
    setText('');
  };

  const close = () => {
    reset();
    onClose();
  };

  // ------------------------------------------------------------ 抽取

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setStage({ name: 'working', hint: '正在压缩图片…' });

    // 客户端先缩图：Server Action 的 body 默认上限 1MB，手机原图必超；
    // 顺带把图像 token 也降下来（这是真金白银）
    const { file: compressed, originalBytes, compressedBytes } = await compressImage(file);

    setStage({
      name: 'working',
      hint:
        compressedBytes < originalBytes
          ? `正在识别…（${formatBytes(originalBytes)} → ${formatBytes(compressedBytes)}）`
          : '正在识别…',
    });

    const formData = new FormData();
    formData.append('image', compressed);
    formData.append('kind', mode);

    const res = await captureFromImageAction(formData);
    if (res.error) {
      message.error(res.error);
      setStage({ name: 'idle' });
      return;
    }
    setStage({ name: 'review-inventory', proposal: res.data });
  };

  const handleText = async () => {
    if (!text.trim()) return;
    setStage({ name: 'working', hint: '正在理解…' });

    const res = await captureFromTextAction(text);
    if (res.error) {
      message.error(res.error);
      setStage({ name: 'idle' });
      return;
    }

    const result: TextCaptureResult = res.data;
    if (result.kind === 'stock') {
      setStage({ name: 'review-inventory', proposal: result.inventory });
    } else if (result.kind === 'cooked') {
      setStage({
        name: 'review-cooked',
        proposal: result.cooked,
        recipeId: result.cooked.matched?.id ?? null,
      });
    } else {
      message.error('没听懂这句话');
      setStage({ name: 'idle' });
    }
  };

  // ------------------------------------------------------------ 落库

  const applyInventory = async (decisions: CaptureDecision[]) => {
    setSubmitting(true);
    try {
      const res = await applyInventoryCaptureAction(decisions);
      if (res.error) {
        message.error(res.error);
        // ⚠️ 即使报错也要进 done 态：可能已经写进去一部分，用户必须能撤销
        if (res.data.added.length > 0 || res.data.restore.length > 0) {
          setStage({ name: 'done', snapshot: res.data, summary: '部分录入后失败' });
          onApplied?.();
        }
        return;
      }
      setStage({ name: 'done', snapshot: res.data, summary: `已录入 ${decisions.length} 样` });
      onApplied?.();
    } finally {
      setSubmitting(false);
    }
  };

  const applyCookedDecisions = async (recipeId: string, decisions: CaptureDecision[]) => {
    setSubmitting(true);
    try {
      const res = await applyCookedCaptureAction({
        recipeId,
        date: new Date().toISOString().slice(0, 10),
        decisions,
      });
      if (res.error) {
        message.error(res.error);
        if (res.data.calendarEntries.length > 0) {
          setStage({ name: 'done', snapshot: res.data, summary: '部分录入后失败' });
          onApplied?.();
        }
        return;
      }
      setStage({ name: 'done', snapshot: res.data, summary: '已记进日历，库存已更新' });
      onApplied?.();
    } finally {
      setSubmitting(false);
    }
  };

  const undo = async (snapshot: CaptureSnapshot) => {
    setSubmitting(true);
    try {
      const res = await undoCaptureAction(snapshot);
      if (res.error) message.error(res.error);
      else {
        message.success('已撤销');
        onApplied?.();
        reset();
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------------------------------------ 渲染

  const body = () => {
    if (stage.name === 'working') {
      return (
        <div style={{ padding: '28px 0', textAlign: 'center', fontSize: 13, color: 'var(--tx2)' }}>
          {stage.hint}
        </div>
      );
    }

    if (stage.name === 'done') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)' }}>{stage.summary} 🎉</div>
          <div style={{ fontSize: 12, color: 'var(--tx2)' }}>
            录错了？现在还能一键撤回——关掉这个面板之后就只能自己去改文件了。
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button size="small" onClick={() => undo(stage.snapshot)} loading={submitting} danger>
              撤销
            </Button>
            <Button size="small" onClick={reset}>
              再录一条
            </Button>
            <Button size="small" type="primary" onClick={close}>
              完成
            </Button>
          </div>
        </div>
      );
    }

    if (stage.name === 'review-inventory') {
      const { existing, fresh } = stage.proposal;
      if (existing.length === 0 && fresh.length === 0) {
        return <EmptyResult onBack={reset} />;
      }
      return (
        <CaptureConfirm
          existing={existing}
          fresh={fresh}
          submitting={submitting}
          onCancel={reset}
          onSubmit={applyInventory}
        />
      );
    }

    if (stage.name === 'review-cooked') {
      return (
        <CookedReview
          stage={stage}
          submitting={submitting}
          onPickRecipe={async (recipeId) => {
            const res = await ingredientsForRecipeAction(recipeId);
            setStage({
              name: 'review-cooked',
              proposal: { ...stage.proposal, ingredients: res.data },
              recipeId,
            });
          }}
          onCancel={reset}
          onSubmit={(decisions) => applyCookedDecisions(stage.recipeId!, decisions)}
        />
      );
    }

    // idle
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Segmented
          value={mode}
          onChange={(value) => {
            setMode(value as Mode);
            reset();
          }}
          options={MODE_OPTIONS}
          block
        />

        {mode === 'text' ? (
          <>
            <Input.TextArea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={PLACEHOLDER.text}
              autoSize={{ minRows: 2, maxRows: 4 }}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  handleText();
                }
              }}
            />
            <div style={{ fontSize: 11, color: 'var(--tx2)' }}>
              想说话就用系统输入法的听写——这里不另接语音 API。
            </div>
            <Button type="primary" size="small" onClick={handleText} disabled={!text.trim()}>
              识别
            </Button>
          </>
        ) : (
          <>
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '28px 12px',
                border: '1px dashed var(--line)',
                borderRadius: 10,
                cursor: 'pointer',
                color: 'var(--tx2)',
                fontSize: 13,
              }}
            >
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              {PLACEHOLDER[mode]}
              <span style={{ fontSize: 11 }}>图片只用来识别，不会存进你的 vault</span>
            </label>
          </>
        )}
      </div>
    );
  };

  return (
    <Modal
      title="AI 录入"
      open={open}
      onCancel={close}
      footer={null}
      width={460}
      destroyOnHidden
    >
      {body()}
    </Modal>
  );
}

function EmptyResult({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ padding: '20px 0', textAlign: 'center' }}>
      <div style={{ fontSize: 13, color: 'var(--tx2)', marginBottom: 12 }}>没认出任何食材</div>
      <Button size="small" onClick={onBack}>
        再试一次
      </Button>
    </div>
  );
}

/**
 * 「我做完了 X」的确认。
 *
 * 菜谱没匹配上时**必须让用户自己选**（决策 ⑭），不做模糊匹配——猜错了会往
 * 日历里写一条假记录，而日历历史正是「不重样」推荐的输入。
 */
function CookedReview({
  stage,
  submitting,
  onPickRecipe,
  onCancel,
  onSubmit,
}: {
  stage: Extract<Stage, { name: 'review-cooked' }>;
  submitting: boolean;
  onPickRecipe: (recipeId: string) => void;
  onCancel: () => void;
  onSubmit: (decisions: CaptureDecision[]) => void;
}) {
  const { proposal, recipeId } = stage;

  const picker = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 13, color: 'var(--tx)' }}>
        {proposal.matched ? (
          <>
            做完了「<b>{proposal.matched.name}</b>」
          </>
        ) : (
          <>
            没找到叫「<b>{proposal.rawName}</b>」的菜谱，是下面哪一道？
          </>
        )}
      </div>
      <Select
        size="small"
        showSearch
        optionFilterProp="label"
        placeholder="选一道菜谱"
        value={recipeId ?? undefined}
        onChange={onPickRecipe}
        options={proposal.candidates.map((item) => ({ value: item.id, label: item.name }))}
        style={{ width: '100%' }}
      />
    </div>
  );

  if (!recipeId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {picker}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button size="small" onClick={onCancel}>
            取消
          </Button>
        </div>
      </div>
    );
  }

  return (
    <CaptureConfirm
      header={picker}
      existing={proposal.ingredients}
      fresh={[]}
      submitting={submitting}
      submitLabel="记进日历并更新库存"
      onCancel={onCancel}
      onSubmit={onSubmit}
    />
  );
}
