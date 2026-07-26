/**
 * ULID —— 26 字符、Crockford base32、按时间可排序的稳定 ID。
 *
 * 手写而不是加包：整个实现 20 行，而依赖每多一个，「clone 完就能跑」这条
 * 承诺就多一分被 native 编译 / 版本冲突破坏的风险（Task/04 决策：仅新增 yaml）。
 *
 * 只用于**菜谱**和**日历条目**——库存与厨具的 join key 是名称本身
 * （docs/vault-format.md §5）。
 */
import { randomBytes } from 'node:crypto';

/** Crockford base32：去掉了容易看混的 I / L / O / U */
const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TIME_CHARS = 10;
const RANDOM_CHARS = 16;
export const ULID_LENGTH = TIME_CHARS + RANDOM_CHARS;

function encodeTime(time: number): string {
  let str = '';
  for (let i = 0; i < TIME_CHARS; i++) {
    // 用取模而不是位运算：时间戳有 48 位，`>>>` 会在 32 位处截断
    str = BASE32[time % 32] + str;
    time = Math.floor(time / 32);
  }
  return str;
}

function encodeRandom(): string {
  const bytes = randomBytes(RANDOM_CHARS);
  let str = '';
  for (let i = 0; i < RANDOM_CHARS; i++) {
    str += BASE32[bytes[i] % 32];
  }
  return str;
}

export function generateUlid(): string {
  return encodeTime(Date.now()) + encodeRandom();
}

const ULID_PATTERN = new RegExp(`^[${BASE32}]{${ULID_LENGTH}}$`);

export function isValidUlid(value: string): boolean {
  return ULID_PATTERN.test(value);
}
