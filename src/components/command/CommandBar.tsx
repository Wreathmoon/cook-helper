'use client';

/**
 * 命令栏（⌘K / Ctrl+K）。
 *
 * **形态本身就是一句声明**：命令栏是加速器，不是新界面。
 * 它盖在现有 GUI 之上、随手唤出、用完就消失——而一个全屏聊天页会宣告
 * 「对话才是主入口」，那正是 DESIGN.md §13 反模式 1 明确拒绝的方向。
 *
 * 四个态：
 *
 *   idle ──▶ working ──▶ answer ──(有提案)──▶ 确认 ──▶ done(可撤销)
 *                            └──(无提案)──────────────▶ 就停在 answer
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Input, Button, message } from 'antd';
import {
  applyProposalAction,
  commandStatusAction,
  runCommandAction,
  undoProposalAction,
  type CommandResult,
} from '@/app/actions/command';
import type { ConfirmedChange } from '@/lib/services/command';
import type { CaptureSnapshot } from '@/lib/services/capture';
import { MAX_STEPS } from '@/lib/ai/limits';

const TOOL_LABEL: Record<string, string> = {
  list_inventory: '查库存',
  list_recipes: '翻菜谱',
  get_recipe_detail: '看菜谱详情',
  list_utensils: '查厨具',
  get_calendar: '查日历',
  get_recommendations: '跑推荐引擎',
  generate_shopping_list: '算购物清单',
  propose_changes: '提出改动',
};

const EXAMPLES = [
  '帮我排三天的菜，避开最近吃过的',
  '用掉那块快坏的肉，今晚做什么',
  '这周还缺什么菜要买',
];

type Stage =
  | { name: 'idle' }
  | { name: 'working' }
  | { name: 'answer'; result: CommandResult }
  | { name: 'done'; snapshot: CaptureSnapshot; summary: string };

export function CommandBar() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<{ enabled: boolean; reason: string | null } | null>(null);
  const [input, setInput] = useState('');
  const [stage, setStage] = useState<Stage>({ name: 'idle' });
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ⌘K / Ctrl+K，以及侧边栏那个看得见的入口派发的事件
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('cook-helper:open-command', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('cook-helper:open-command', onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open || status !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await commandStatusAction();
        if (!cancelled) setStatus(res);
      } catch {
        if (!cancelled) setStatus({ enabled: false, reason: '读取 AI 配置失败' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, status]);

  const reset = useCallback(() => {
    setStage({ name: 'idle' });
    setInput('');
  }, []);

  const close = () => {
    reset();
    setOpen(false);
  };

  const run = async (text: string) => {
    if (!text.trim()) return;
    setStage({ name: 'working' });
    const res = await runCommandAction(text);
    if (res.error || !res.data) {
      message.error(res.error ?? '没跑通');
      setStage({ name: 'idle' });
      return;
    }
    setStage({ name: 'answer', result: res.data });
  };

  const confirm = async (changes: ConfirmedChange[], summary: string) => {
    setSubmitting(true);
    try {
      const res = await applyProposalAction(changes);
      if (res.error) {
        message.error(res.error);
        // 可能已经写进去一部分——必须能撤销
        if (res.data.calendarEntries.length > 0 || res.data.restore.length > 0) {
          setStage({ name: 'done', snapshot: res.data, summary: '部分执行后失败' });
        }
        return;
      }
      setStage({ name: 'done', snapshot: res.data, summary });
    } finally {
      setSubmitting(false);
    }
  };

  const undo = async (snapshot: CaptureSnapshot) => {
    setSubmitting(true);
    try {
      const res = await undoProposalAction(snapshot);
      if (res.error) message.error(res.error);
      else {
        message.success('已撤销');
        reset();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={close}
      footer={null}
      width={560}
      destroyOnHidden
      closable={false}
      styles={{ body: { padding: 4 } }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input.TextArea
          ref={inputRef as never}
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="想干什么？例如：帮我排三天的菜，避开最近吃过的"
          autoSize={{ minRows: 1, maxRows: 4 }}
          disabled={stage.name === 'working' || status?.enabled === false}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              void run(input);
            }
          }}
          style={{ fontSize: 14 }}
        />

        {status?.enabled === false && (
          <div style={{ fontSize: 12, color: 'var(--warn)', lineHeight: 1.7 }}>{status.reason}</div>
        )}

        {stage.name === 'idle' && status?.enabled !== false && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 11, color: 'var(--tx2)' }}>试试：</div>
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setInput(example);
                  void run(example);
                }}
                style={{
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  padding: '2px 0',
                  fontSize: 12.5,
                  color: 'var(--primary)',
                  cursor: 'pointer',
                }}
              >
                {example}
              </button>
            ))}
          </div>
        )}

        {stage.name === 'working' && (
          <div style={{ fontSize: 12.5, color: 'var(--tx2)', padding: '8px 0' }}>
            正在查资料、编排…（最多 {MAX_STEPS} 步）
          </div>
        )}

        {stage.name === 'answer' && (
          <AnswerView
            result={stage.result}
            submitting={submitting}
            onConfirm={confirm}
            onDismiss={reset}
          />
        )}

        {stage.name === 'done' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>
              {stage.summary} 🎉
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--tx2)' }}>
              关掉之后就只能自己去改文件了。
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button size="small" danger loading={submitting} onClick={() => undo(stage.snapshot)}>
                撤销
              </Button>
              <Button size="small" onClick={reset}>
                再问一句
              </Button>
              <Button size="small" type="primary" onClick={close}>
                完成
              </Button>
            </div>
          </div>
        )}

        <div style={{ fontSize: 10.5, color: 'var(--tx2)', textAlign: 'right' }}>
          ⌘K / Ctrl+K 开关 · Esc 关闭
        </div>
      </div>
    </Modal>
  );
}

function AnswerView({
  result,
  submitting,
  onConfirm,
  onDismiss,
}: {
  result: CommandResult;
  submitting: boolean;
  onConfirm: (changes: ConfirmedChange[], summary: string) => void;
  onDismiss: () => void;
}) {
  const proposal = result.proposal;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* 它干了什么 —— 让工具调用可见。看不见过程的 agent 没法被信任，也没法被排错 */}
      {result.steps.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--tx2)' }}>
          {result.steps.map((step) => TOOL_LABEL[step] ?? step).join(' → ')}
        </div>
      )}

      {result.text && (
        <div style={{ fontSize: 13, color: 'var(--tx)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
          {result.text}
        </div>
      )}

      {/* 被校验剔掉的改动必须显示。静默丢弃 = 用户以为做了、其实没做 */}
      {result.rejected.length > 0 && (
        <div
          style={{
            borderRadius: 10,
            border: '1px solid var(--warn)',
            background: 'var(--warn-bg)',
            padding: '8px 11px',
            fontSize: 11.5,
            lineHeight: 1.7,
          }}
        >
          <b style={{ color: 'var(--warn)' }}>这几条没法执行，已跳过：</b>
          {result.rejected.map((item) => (
            <div key={item.label} style={{ color: 'var(--tx2)' }}>
              · {item.label} —— {item.why}
            </div>
          ))}
        </div>
      )}

      {proposal && (
        <div
          style={{
            borderRadius: 10,
            border: '1px solid var(--line)',
            background: 'var(--panel)',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--tx)' }}>{proposal.summary}</div>
          {proposal.changes.map((change, index) => (
            <div key={index} style={{ fontSize: 12, color: 'var(--tx2)' }}>
              {change.kind === 'calendar'
                ? `📅 ${change.date} · ${change.recipe_name}（${change.status === 'completed' ? '已做' : '计划'}）`
                : `🥬 ${change.name} → ${change.stock_level}`}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <Button size="small" onClick={onDismiss} disabled={submitting}>
              不用了
            </Button>
            <Button
              size="small"
              type="primary"
              loading={submitting}
              onClick={() => onConfirm(proposal.changes as ConfirmedChange[], proposal.summary)}
            >
              执行（{proposal.changes.length}）
            </Button>
          </div>
        </div>
      )}

      {!proposal && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button size="small" onClick={onDismiss}>
            再问一句
          </Button>
        </div>
      )}
    </div>
  );
}
