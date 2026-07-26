import { describe, it, expect } from 'vitest';
import { describeError, formatError, guardData, guardResult } from '../error';
import { VaultError } from '@/lib/vault/errors';

describe('describeError — 分类', () => {
  it('YAML 解析失败 → vault_format，带文件与行号', () => {
    const err = new VaultError('parse', 'YAML 语法有误', {
      file: 'kitchen/inventory/vegetable.yaml',
      line: 6,
      hint: '缩进用了 Tab？',
    });
    const described = describeError(err);

    expect(described.kind).toBe('vault_format');
    expect(described.file).toBe('kitchen/inventory/vegetable.yaml');
    expect(described.line).toBe(6);
  });

  it('schema 校验失败 → validation，带字段', () => {
    const err = new VaultError('schema', '值不在允许范围内', {
      file: 'kitchen/utensils.yaml',
      field: '[第 2 条].name',
    });
    expect(describeError(err).kind).toBe('validation');
    expect(describeError(err).field).toBe('[第 2 条].name');
  });

  it('读写失败 → io', () => {
    expect(describeError(new VaultError('io', '磁盘满了')).kind).toBe('io');
  });

  it('只读拒绝 → read_only', () => {
    expect(describeError(new VaultError('read_only', '演示实例')).kind).toBe('read_only');
  });

  it('普通异常 → unknown，且给出可行动的兜底提示', () => {
    const described = describeError(new Error('boom'));
    expect(described.kind).toBe('unknown');
    expect(described.message).toBe('boom');
    expect(described.hint).toBeTruthy();
  });

  it('抛出来的不是 Error 也不炸', () => {
    expect(describeError('字符串异常').kind).toBe('unknown');
    expect(describeError('字符串异常').message).toBe('字符串异常');
  });
});

describe('formatError — 给用户看的那句话', () => {
  it('位置 + 问题 + 怎么办 三段齐全', () => {
    const text = formatError(
      new VaultError('parse', 'YAML 语法有误', {
        file: 'kitchen/inventory/meat.yaml',
        line: 12,
        hint: 'YAML 只认空格，不认 Tab。',
      })
    );

    expect(text).toContain('kitchen/inventory/meat.yaml');
    expect(text).toContain('第 12 行');
    expect(text).toContain('YAML 只认空格');
  });

  it('没有位置信息时不留下空的冒号', () => {
    expect(formatError(new Error('出错了'))).not.toMatch(/^：/);
  });
});

describe('guardData / guardResult — Server Action 的外壳', () => {
  it('正常时原样返回', async () => {
    const result = await guardData([1], async () => ({ data: [1, 2, 3], error: null }));
    expect(result.data).toEqual([1, 2, 3]);
    expect(result.error).toBeNull();
  });

  it('抛异常时给空数据 + 人话错误，而不是把异常抛穿', async () => {
    const result = await guardData([] as number[], async () => {
      throw new VaultError('parse', 'YAML 坏了', { file: 'kitchen/config.yaml', line: 3 });
    });

    expect(result.data).toEqual([]);
    expect(result.error).toContain('kitchen/config.yaml');
    expect(result.error).toContain('第 3 行');
  });

  it('写入型外壳同样不抛穿', async () => {
    const result = await guardResult<{ error: string | null }>(async () => {
      throw new VaultError('io', '磁盘满了');
    });
    expect(result.error).toContain('磁盘满了');
  });
});
