import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { normalizeIngredientName, buildAliasMap } from '../normalize-name';
import { loadVault } from '@/lib/vault';

const aliasesPath = resolve(process.cwd(), 'seed/kitchen/aliases.yaml');
const aliasesData = parseYaml(readFileSync(aliasesPath, 'utf8'));
const aliases = buildAliasMap(aliasesData);
/** 别名表的规范名称必须对得上**实际的**种子库存，所以基准取 vault 而不是任何 TS 常量 */
const seedInventoryNames = new Set(loadVault('seed').inventory.map((item) => item.name));

describe('normalizeIngredientName — 字面归一', () => {
  it('全角字母数字转半角', () => {
    expect(normalizeIngredientName('ｐｃ')).toBe('pc');
    expect(normalizeIngredientName('２００ｇ')).toBe('200g');
    expect(normalizeIngredientName('ＡＢＣ')).toBe('ABC');
  });

  it('去掉首尾空格', () => {
    expect(normalizeIngredientName('  猪肉 ')).toBe('猪肉');
    expect(normalizeIngredientName('\t西红柿\n')).toBe('西红柿');
  });

  it('全角空格也算空格', () => {
    expect(normalizeIngredientName('　猪肉　')).toBe('猪肉');
  });

  it('连续空格合并为一个', () => {
    expect(normalizeIngredientName('鸡  胸肉')).toBe('鸡 胸肉');
    expect(normalizeIngredientName('a   b    c')).toBe('a b c');
  });

  it('空输入返回空串，不抛错', () => {
    expect(normalizeIngredientName('')).toBe('');
    expect(normalizeIngredientName('   ')).toBe('');
  });

  it('已经规范的名称原样返回', () => {
    expect(normalizeIngredientName('西红柿')).toBe('西红柿');
  });
});

describe('normalizeIngredientName — 别名匹配', () => {
  it('命中别名表 → 替换为规范名称', () => {
    expect(normalizeIngredientName('番茄', aliases)).toBe('西红柿');
    expect(normalizeIngredientName('马铃薯', aliases)).toBe('土豆');
    expect(normalizeIngredientName('洋芋', aliases)).toBe('土豆');
    expect(normalizeIngredientName('酱油', aliases)).toBe('生抽');
    expect(normalizeIngredientName('芝麻油', aliases)).toBe('香油');
  });

  it('别名查表在字面归一之后 → 带空格/全角的别名也能命中', () => {
    expect(normalizeIngredientName(' 番茄 ', aliases)).toBe('西红柿');
  });

  it('未知名称原样返回，不做模糊匹配', () => {
    expect(normalizeIngredientName('火龙果', aliases)).toBe('火龙果');
    expect(normalizeIngredientName('鸭', aliases)).toBe('鸭');
  });

  it('不做上下位关系：花生油 ≠ 食用油，大葱 ≠ 葱姜蒜', () => {
    expect(normalizeIngredientName('花生油', aliases)).toBe('花生油');
    expect(normalizeIngredientName('大葱', aliases)).toBe('大葱');
  });

  it('别名是精确匹配：番茄酱不会被改写成西红柿酱', () => {
    expect(normalizeIngredientName('番茄酱', aliases)).toBe('番茄酱');
  });

  it('不传别名表时只做字面归一', () => {
    expect(normalizeIngredientName(' 番茄 ')).toBe('番茄');
  });
});

describe('buildAliasMap — 冲突检测', () => {
  it('别名与规范名称重名 → 抛错', () => {
    expect(() => buildAliasMap({ 西红柿: ['番茄'], 番茄: ['洋柿子'] })).toThrow(/规范名称/);
  });

  it('同一别名指向两个规范名称 → 抛错', () => {
    expect(() => buildAliasMap({ 面条: ['面'], 面粉: ['面'] })).toThrow(/只能有一个规范名称/);
  });

  it('别名与自己的规范名称相同 → 忽略，不抛错', () => {
    const map = buildAliasMap({ 西红柿: ['西红柿', '番茄'] });
    expect(map.get('番茄')).toBe('西红柿');
    expect(map.has('西红柿')).toBe(false);
  });

  it('空输入 → 空表', () => {
    expect(buildAliasMap(null).size).toBe(0);
    expect(buildAliasMap(undefined).size).toBe(0);
  });
});

describe('seed/kitchen/aliases.yaml — 种子别名表质量', () => {
  it('能被解析且无冲突（buildAliasMap 不抛错）', () => {
    expect(aliases.size).toBeGreaterThan(30);
  });

  it('每个规范名称都是种子库存里真实存在的食材', () => {
    const unknown = Object.keys(aliasesData as Record<string, unknown>).filter(
      (name) => !seedInventoryNames.has(name)
    );
    expect(unknown).toEqual([]);
  });

  it('没有别名与种子食材名撞车', () => {
    const collisions = [...aliases.keys()].filter((alias) => seedInventoryNames.has(alias));
    expect(collisions).toEqual([]);
  });
});
