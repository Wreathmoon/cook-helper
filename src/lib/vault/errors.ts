/**
 * vault 的错误分类。
 *
 * 「你可以拿记事本打开、看懂、改对」这个承诺，兑现处就在这里：用户手改坏了
 * 一个文件，应用必须说清楚**是哪个文件、哪一行、哪个字段**，而不是白屏或一坨堆栈。
 * 见 Task/04 §5 P1-2 的错误分类表。
 */

export type VaultErrorKind =
  /** vault 文件格式非法 —— 用户手改坏了 YAML / frontmatter */
  | 'parse'
  /** 数据校验错误 —— 字段缺失、枚举值非法、名称重复 */
  | 'schema'
  /** 文件读写失败 —— 权限不足、磁盘满、文件被占用 */
  | 'io'
  /** 只读模式拒绝 —— 沙盒实例里尝试写入 */
  | 'read_only';

export class VaultError extends Error {
  readonly kind: VaultErrorKind;
  /** 出问题的文件，相对 vault 根目录 */
  readonly file?: string;
  /** 1-based 行号，YAML 解析错误自带；schema 校验时可能没有 */
  readonly line?: number;
  /** 出问题的字段路径，如 `[3].stock_level` */
  readonly field?: string;
  /** 怎么修 —— 面向用户的一句话 */
  readonly hint?: string;

  constructor(
    kind: VaultErrorKind,
    message: string,
    options: { file?: string; line?: number; field?: string; hint?: string; cause?: unknown } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = 'VaultError';
    this.kind = kind;
    this.file = options.file;
    this.line = options.line;
    this.field = options.field;
    this.hint = options.hint;
  }

  /** 拼成一条可直接展示给用户的信息：位置 + 问题 + 怎么办 */
  toDisplayString(): string {
    const location = [this.file, this.line !== undefined ? `第 ${this.line} 行` : null, this.field]
      .filter(Boolean)
      .join(' ');
    return [location ? `${location}：` : '', this.message, this.hint ? `\n${this.hint}` : '']
      .join('')
      .trim();
  }
}

/** 只读沙盒里拦截写入用 —— 这是预期行为，不是故障，所以文案要引导而不是报错 */
export function readOnlyError(action: string): VaultError {
  return new VaultError('read_only', `这是只读演示实例，${action}不会被保存。`, {
    hint: '想改数据的话，把仓库 clone 到本地跑一份自己的：README 里有三行命令。',
  });
}
