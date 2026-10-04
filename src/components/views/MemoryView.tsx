'use client';

/**
 * 记忆管理页 —— 项目第一个设置类页面。
 *
 * 三条不能省的东西，每一条都对应 Task/10 里一个被写下来的失败态：
 *
 * 1. **免责声明**（决策 ③）：过敏与禁忌由模型判断，不保证准确。
 * 2. **「未生效」独立分区**（决策 ⑤）：没配 key 时记忆**完全不影响推荐**。
 *    「用户以为过敏记忆在保护自己、实际什么都没发生」是本任务最不可接受的失败态，
 *    所以这个状态是一个占满宽度的横幅 + 一个独立分区，不是角落里的小灰字。
 * 3. **只有删除，没有新增 / 编辑表单**（决策 ⑦）：信任来自「文件是你的」，
 *    不是「我给你做了个好用的编辑器」。新增引导用户去 `memory/` 新建文件。
 */

import { useState } from 'react';
import { Modal, message } from 'antd';
import type { Memory } from '@/types';
import type { MemoryOverview } from '@/lib/services/memory';
import { MEMORY_DISCLAIMER, MEMORY_INEFFECTIVE_LABEL, MEMORY_TYPE_LABEL } from '@/lib/memory/text';
import { EmptyState } from '@/components/shared/EmptyState';
import { useReadOnly, READ_ONLY_TIP } from '@/components/layout/read-only-provider';

export interface MemoryViewProps {
  data: MemoryOverview;
  loading: boolean;
  /**
   * 加载失败的文案（通常是某个记忆文件被改坏了）。
   *
   * ⚠️ 必须**常驻渲染**，不能只弹一个 toast：解析失败时 `data` 是空的，而空的
   * `data` 会渲染成「还没有任何记忆」——用户的文件明明还躺在 `memory/` 里，页面却
   * 说一条都没有。toast 几秒后消失，剩下的就是这句自信的错话。
   */
  error?: string | null;
  onDelete: (id: string) => void;
  readOnly?: boolean;
}

const TYPE_COLOR: Record<Memory['type'], string> = {
  preference: 'var(--primary)',
  goal: 'var(--notice)',
  constraint: 'var(--danger)',
};

export function MemoryView({ data, loading, error, onDelete, readOnly: readOnlyProp }: MemoryViewProps) {
  // hook 必须无条件调用，不能写成 `readOnlyProp ?? useReadOnly()`——`??` 会短路掉它
  const contextReadOnly = useReadOnly();
  const readOnly = readOnlyProp ?? contextReadOnly;
  const [pendingDelete, setPendingDelete] = useState<Memory | null>(null);

  const total = data.effective.length + data.ineffective.length + data.expired.length;
  const live = data.effective.length + data.ineffective.length;

  const askDelete = (memory: Memory) => {
    if (readOnly) { message.info(READ_ONLY_TIP); return; }
    setPendingDelete(memory);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    onDelete(pendingDelete.id);
    setPendingDelete(null);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div style={{ fontSize: 19, fontWeight: 700 }}>记忆</div>
          <div style={{ fontSize: 11.5, color: 'var(--tx2)', marginTop: 2 }}>
            {total} 条 · 存在 <code style={{ fontSize: 11 }}>{data.memoryDir}</code> 下，
            一条一个 markdown 文件，随时可以自己打开改
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* ① 某个记忆文件被改坏了 —— 常驻，且盖过空态 */}
        {error && (
          <div style={{
            borderRadius: 12, border: '1px solid var(--danger)', background: 'var(--danger-bg)',
            padding: '12px 15px', marginBottom: 14, fontSize: 12.5, lineHeight: 1.75, color: 'var(--tx)',
          }}>
            <b style={{ color: 'var(--danger)' }}>有记忆文件读不了，下面这个列表是不全的</b>
            <div style={{ marginTop: 4, color: 'var(--tx2)', whiteSpace: 'pre-wrap' }}>{error}</div>
            <div style={{ marginTop: 4, color: 'var(--tx2)' }}>
              你的文件都还在 <code style={{ fontSize: 11.5 }}>{data.memoryDir}</code> 里，一个都没丢。
            </div>
          </div>
        )}

        {/* ② 没配 key —— 全宽横幅。这是默认状态，不是边界情况 */}
        {!data.aiConfigured && live > 0 && (
          <div style={{
            borderRadius: 12, border: '1px solid var(--warn)', background: 'var(--warn-bg)',
            padding: '12px 15px', marginBottom: 14, fontSize: 12.5, lineHeight: 1.75, color: 'var(--tx)',
          }}>
            <b style={{ color: 'var(--warn)' }}>⚠ 记忆当前不影响任何推荐</b>
            <div style={{ marginTop: 4, color: 'var(--tx2)' }}>
              记忆全部交给 AI 模型判断，而这台机器还没配好模型（需要{' '}
              <code style={{ fontSize: 11.5 }}>AI_BASE_URL</code> +{' '}
              <code style={{ fontSize: 11.5 }}>AI_API_KEY</code> +{' '}
              <code style={{ fontSize: 11.5 }}>AI_MODEL</code>，见 README）。
              下面这 {live} 条记忆能写能看，但<b style={{ color: 'var(--tx)' }}>不会</b>改变推荐结果。
              推荐本身（库存分档、清库存、不重样）不需要 key，照常工作。
            </div>
          </div>
        )}

        {/* ③ 免责声明 —— 常驻，不随 key 状态消失 */}
        <div style={{
          borderRadius: 12, border: '1px solid var(--line)', background: 'var(--panel)',
          padding: '12px 15px', marginBottom: 16, fontSize: 12.5, lineHeight: 1.75,
        }}>
          <b style={{ color: 'var(--danger)' }}>{MEMORY_DISCLAIMER.title}</b>
          <div style={{ marginTop: 4, color: 'var(--tx2)' }}>{MEMORY_DISCLAIMER.body}</div>
        </div>

        {/* 空态只在「真的空」时才对：加载中、或读取失败时它都是假话 */}
        {(loading || error) && total === 0 ? null : total === 0 ? (
          <div style={{ borderRadius: 14, background: 'var(--panel)', border: '1px solid var(--line)' }}>
            <EmptyState
              icon="🧠"
              title="还没有任何记忆"
              description={`「我不吃辣」「这个月想少吃肉」这类偏好写在这里，推荐时会带上。在 ${data.memoryDir} 下新建一个 .md 文件就行——它就是个文件夹，没有别的机关。`}
            />
          </div>
        ) : (
          <>
            <Section
              title="生效中"
              /* ⚠️ 必须说清楚**在哪里**生效。Task/12 之前这里写的是「会随推荐一起交给模型判断」，
                 而当时记忆其实什么都不影响。现在它真的生效了，但仍然只在这两处——
                 含糊的「已生效」会让用户以为菜谱页、购物清单也被筛查过。 */
              hint="推荐页会按它们标注并把冲突的下沉；命令栏（⌘K）问问题时也会带上"
              tone="var(--success)"
              items={data.effective}
              onDelete={askDelete}
              readOnly={readOnly}
            />
            <Section
              title="未生效"
              hint={MEMORY_INEFFECTIVE_LABEL}
              tone="var(--warn)"
              items={data.ineffective}
              onDelete={askDelete}
              readOnly={readOnly}
              muted
            />
            <Section
              title="已过期"
              hint="读取时自动跳过，文件原样留着——删不删你说了算"
              tone="var(--tx2)"
              items={data.expired}
              onDelete={askDelete}
              readOnly={readOnly}
              muted
            />
          </>
        )}

        {/* ④ 新增引导 —— 决策 ⑦：这里刻意没有「＋ 添加记忆」按钮 */}
        <div style={{ fontSize: 11.5, color: 'var(--tx2)', marginTop: 14, lineHeight: 1.8 }}>
          想加一条记忆？在 <code style={{ fontSize: 11 }}>{data.memoryDir}</code> 里新建一个{' '}
          <code style={{ fontSize: 11 }}>.md</code> 文件，格式见{' '}
          <code style={{ fontSize: 11 }}>docs/vault-format.md §3.9</code>。
          这里只做「看」和「删」——记忆是你的文件，用你惯用的编辑器写它更合适。
        </div>
      </div>

      <Modal
        title="删掉这条记忆？"
        open={!!pendingDelete}
        onOk={confirmDelete}
        onCancel={() => setPendingDelete(null)}
        okText="删除"
        okButtonProps={{ danger: true }}
        cancelText="取消"
      >
        <div style={{ fontSize: 13, lineHeight: 1.8 }}>
          <div style={{ marginBottom: 8 }}>{pendingDelete?.content}</div>
          <div style={{ color: 'var(--tx2)', fontSize: 12 }}>
            会直接删掉磁盘上的 <code>{data.memoryDir}{pendingDelete?.fileName}</code>，不进回收站。
          </div>
        </div>
      </Modal>
    </>
  );
}

function Section({
  title,
  hint,
  tone,
  items,
  onDelete,
  readOnly,
  muted = false,
}: {
  title: string;
  hint: string;
  tone: string;
  items: Memory[];
  onDelete: (memory: Memory) => void;
  readOnly: boolean;
  muted?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <b style={{ fontSize: 13.5, color: tone }}>{title}</b>
        <span style={{ fontSize: 11.5, color: 'var(--tx2)' }}>{items.length} 条 · {hint}</span>
      </div>

      <div style={{ borderRadius: 14, background: 'var(--panel)', border: '1px solid var(--line)', overflow: 'hidden' }}>
        {items.map((memory, index) => (
          <div
            key={memory.id}
            style={{
              padding: '12px 15px',
              borderTop: index === 0 ? 'none' : '1px solid var(--line2)',
              opacity: muted ? 0.75 : 1,
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 5 }}>
                <span style={{
                  fontSize: 10.5, fontWeight: 700, borderRadius: 7, padding: '1px 8px',
                  background: 'var(--hover)', color: TYPE_COLOR[memory.type],
                }}>
                  {MEMORY_TYPE_LABEL[memory.type]}
                </span>
                {memory.scope.map((scope) => (
                  <span key={scope} style={{
                    fontSize: 10.5, borderRadius: 7, border: '1px solid var(--line)',
                    padding: '1px 7px', color: 'var(--tx2)',
                  }}>
                    {scope === 'global' ? '全局' : '厨房'}
                  </span>
                ))}
                {memory.enforcement === 'hard' && (
                  <span style={{ fontSize: 10.5, borderRadius: 7, padding: '1px 7px', background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                    要求排除
                  </span>
                )}
                {memory.source === 'inferred' && (
                  <span style={{ fontSize: 10.5, borderRadius: 7, padding: '1px 7px', background: 'var(--hover)', color: 'var(--tx2)' }}>
                    AI 推断 · {memory.confidence}
                  </span>
                )}
              </div>

              <div style={{ fontSize: 13, color: 'var(--tx)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {memory.content}
              </div>

              <div style={{ fontSize: 11, color: 'var(--tx2)', marginTop: 5 }}>
                {memory.created} 记下
                {memory.expires ? ` · ${memory.expires} 失效` : ' · 长期有效'}
                {memory.status !== 'active' ? ' · 已归档' : ''}
                {' · '}
                <code style={{ fontSize: 10.5 }}>{memory.fileName}</code>
              </div>
            </div>

            {!readOnly && (
              <button
                type="button"
                onClick={() => onDelete(memory)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)',
                  fontSize: 12, padding: 0, flexShrink: 0,
                }}
              >
                🗑 删除
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
