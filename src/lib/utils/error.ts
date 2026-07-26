/**
 * 错误分类 —— 让每一类失败都说人话，并且说的是**不一样的**人话。
 *
 * 本地化之后错误的种类整批换了（Task/04 §5 P1-2）：网络错误和权限错误基本消失，
 * 取而代之的是「用户把 vault 文件改坏了」。这一类的报错质量是有分量的——
 * 「你可以拿记事本打开、改对」这个承诺，兑现处就是**改错时能不能自己找回来**。
 */
import { VaultError } from '@/lib/vault/errors';

export type AppErrorKind =
  /** vault 文件格式非法 —— 手改坏了 YAML / frontmatter。必须指出文件与行号 */
  | 'vault_format'
  /** 数据校验错误 —— 字段非法、名称重复。指向具体字段，可重试 */
  | 'validation'
  /** 文件读写失败 —— 权限、磁盘、被占用。是环境问题不是数据问题 */
  | 'io'
  /** 只读模式拒绝 —— 演示实例。这是预期行为，文案要引导而不是报错 */
  | 'read_only'
  /** 兜底 —— 至少给出能复制的信息 */
  | 'unknown';

export interface AppError {
  kind: AppErrorKind;
  /** 一句话说清出了什么事 */
  message: string;
  /** 怎么办 */
  hint?: string;
  /** 出问题的文件（相对 vault 根） */
  file?: string;
  line?: number;
  field?: string;
}

const KIND_BY_VAULT_KIND: Record<string, AppErrorKind> = {
  parse: 'vault_format',
  schema: 'validation',
  io: 'io',
  read_only: 'read_only',
};

/** 把任意异常归类成一个结构化的 AppError */
export function describeError(err: unknown): AppError {
  if (err instanceof VaultError) {
    return {
      kind: KIND_BY_VAULT_KIND[err.kind] ?? 'unknown',
      message: err.message,
      hint: err.hint,
      file: err.file,
      line: err.line,
      field: err.field,
    };
  }

  if (err instanceof Error) {
    return {
      kind: 'unknown',
      message: err.message || '出了点意外',
      hint: '如果反复出现，把这条信息贴进 issue 里会很有帮助。',
    };
  }

  return { kind: 'unknown', message: String(err) };
}

/** 拼成一条可直接展示给用户的信息：位置 + 问题 + 怎么办 */
export function formatError(err: unknown): string {
  if (err instanceof VaultError) return err.toDisplayString();

  const described = describeError(err);
  const location = [described.file, described.line ? `第 ${described.line} 行` : null, described.field]
    .filter(Boolean)
    .join(' ');

  return [location ? `${location}：` : '', described.message, described.hint ? `\n${described.hint}` : '']
    .join('')
    .trim();
}

/**
 * Server Action 的统一外壳（列表型：失败时给出空数据 + 错误文案）。
 *
 * 没有这层的话，vault 加载失败会**直接抛出 Server Action**，用户看到的是
 * Next 的通用报错页——精心写好的「哪个文件第几行」全烂在服务端日志里。
 */
export async function guardData<T>(
  empty: T,
  run: () => Promise<{ data: T; error: string | null }>
): Promise<{ data: T; error: string | null }> {
  try {
    return await run();
  } catch (err) {
    return { data: empty, error: formatError(err) };
  }
}

/** Server Action 的统一外壳（写入型：只关心成没成）*/
export async function guardResult<T extends { error: string | null }>(
  run: () => Promise<T>,
  empty: Omit<T, 'error'> = {} as Omit<T, 'error'>
): Promise<T> {
  try {
    return await run();
  } catch (err) {
    return { ...empty, error: formatError(err) } as T;
  }
}
