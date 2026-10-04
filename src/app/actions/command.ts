'use server';

/**
 * 命令层的 Server Actions。
 *
 * 和 Task/11 一样的形状：**跑 agent（不写库）** 与 **落库（写）** 是两个 action，
 * 中间隔着用户确认。区别只在于提案是模型编排出来的，而不是从一张照片里读出来的。
 */
import { revalidatePath } from 'next/cache';
import { runAgent, type AgentTurn } from '@/lib/ai/agent';
import { describeMissing, readAiConfig } from '@/lib/ai/config';
import { READ_ONLY_MESSAGE } from '@/lib/ai/text';
import { undoCapture, type CaptureSnapshot } from '@/lib/services/capture';
import {
  applyProposal,
  validateProposal,
  type ConfirmedChange,
} from '@/lib/services/command';
import { guardData, guardResult } from '@/lib/utils/error';
import { getVault, isReadOnly } from '@/lib/vault';

export interface CommandResult extends AgentTurn {
  /** 校验后被剔掉的改动 + 原因。**要显示出来**——静默丢弃等于骗用户 */
  rejected: { label: string; why: string }[];
}

const EMPTY_SNAPSHOT: CaptureSnapshot = { restore: [], added: [], calendarEntries: [] };

/** 跑一轮 agent。**不写库** */
export async function runCommandAction(
  input: string
): Promise<{ data: CommandResult | null; error: string | null }> {
  const { missing } = readAiConfig();
  if (missing.length > 0) return { data: null, error: describeMissing(missing) };

  const text = input.trim();
  if (!text) return { data: null, error: '说点什么吧' };

  return guardData(null as CommandResult | null, async () => {
    const vault = getVault();
    // 只读沙盒下照样能查——查询不写盘，也不该被拦。
    // 拦的是提案工具（`buildTools` 的 readOnly 分支），模型因此根本提不出改动来
    const readOnly = isReadOnly();

    const res = await runAgent(vault, text, { readOnly });
    if (res.error || !res.data) return { data: null, error: res.error };

    const proposal = res.data.proposal;
    if (!proposal) return { data: { ...res.data, rejected: [] }, error: null };

    const { valid, rejected } = validateProposal(vault, proposal.changes as ConfirmedChange[]);

    return {
      data: {
        ...res.data,
        proposal: valid.length > 0 ? { ...proposal, changes: valid } : null,
        rejected: rejected.map((item) => ({ label: labelOf(item.change), why: item.why })),
      },
      error: null,
    };
  });
}

/** 落库一份用户确认过的提案 */
export async function applyProposalAction(changes: ConfirmedChange[]) {
  if (isReadOnly()) return { data: EMPTY_SNAPSHOT, error: READ_ONLY_MESSAGE };

  const result = await guardResult(() => applyProposal(getVault(), changes), {
    data: EMPTY_SNAPSHOT,
  });
  revalidatePath('/calendar');
  revalidatePath('/inventory');
  revalidatePath('/recommend');
  return result;
}

/** 撤销。**和拍照录入共用同一个实现**，不另写一份 */
export async function undoProposalAction(snapshot: CaptureSnapshot) {
  const result = await guardResult(() => undoCapture(getVault(), snapshot));
  revalidatePath('/calendar');
  revalidatePath('/inventory');
  revalidatePath('/recommend');
  return result;
}

/** 给命令栏用的开关状态 */
export async function commandStatusAction(): Promise<{ enabled: boolean; reason: string | null }> {
  const { missing } = readAiConfig();
  if (missing.length > 0) return { enabled: false, reason: describeMissing(missing) };
  return { enabled: true, reason: null };
}

function labelOf(change: ConfirmedChange): string {
  return change.kind === 'calendar'
    ? `${change.date} ${change.recipe_name}`
    : `${change.name} → ${change.stock_level}`;
}
