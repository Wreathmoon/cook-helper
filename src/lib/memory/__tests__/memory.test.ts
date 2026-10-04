/**
 * 记忆层。
 *
 * 这里守的是 Task/10 里写死的两条：
 *
 * 1. **过期记忆不进检索结果，而文件一个字节都不许动**（决策 ⑥）。
 *    起定时任务去改用户的 markdown 等于半夜动别人的文件——所以 md5 比对是硬验收。
 * 2. **没配 key 时，活着的记忆全部落在「未生效」**（决策 ⑤）。
 *    「用户以为过敏记忆在保护自己、实际什么都没发生」是本任务最不可接受的失败态。
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { VaultError } from '@/lib/vault/errors';
import { loadMemories } from '../reader';
import { isExpired, isLive, partitionMemories, retrieveMemories } from '../retrieve';
import { deleteMemoryFile } from '../writer';

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'cook-memory-'));
  mkdirSync(path.join(root, 'memory'), { recursive: true });
});

afterEach(() => {
  delete process.env.READ_ONLY;
  rmSync(root, { recursive: true, force: true });
});

function writeMemory(fileName: string, frontmatter: string, body = '测试记忆内容'): string {
  const filePath = path.join(root, 'memory', fileName);
  writeFileSync(filePath, `---\n${frontmatter.trim()}\n---\n\n${body}\n`, 'utf8');
  return filePath;
}

const PREFERENCE = `
type: preference
scope: [kitchen]
source: stated
confidence: high
enforcement: soft
created: 2026-07-25
expires: null
status: active
`;

const md5 = (file: string) => createHash('md5').update(readFileSync(file)).digest('hex');

describe('loadMemories', () => {
  it('没有 memory/ 目录时返回空数组，不报错', () => {
    rmSync(path.join(root, 'memory'), { recursive: true });
    expect(loadMemories(root)).toEqual([]);
  });

  it('读出 frontmatter 与正文，缺 id 时用文件名兜底', () => {
    writeMemory('no-spicy.md', PREFERENCE, '不吃辣。推荐时排除中辣重辣。');

    const [memory] = loadMemories(root);

    expect(memory.id).toBe('no-spicy');
    expect(memory.fileName).toBe('no-spicy.md');
    expect(memory.type).toBe('preference');
    expect(memory.scope).toEqual(['kitchen']);
    expect(memory.expires).toBeNull();
    expect(memory.content).toBe('不吃辣。推荐时排除中辣重辣。');
  });

  it('YAML 把 created 解析成 Date 对象时，照样收下', () => {
    writeMemory('dated.md', PREFERENCE.replace('created: 2026-07-25', 'created: 2026-07-25'));
    expect(loadMemories(root)[0].created).toBe('2026-07-25');
  });

  it('`type: goal` 少写 expires 直接报错，并指向那个字段', () => {
    writeMemory('less-meat.md', `
type: goal
scope: [kitchen]
created: 2026-07-01
status: active
`);

    // 没有失效期的临时目标会无声地压着推荐半年——这是硬校验，不是提示
    expect(() => loadMemories(root)).toThrow(VaultError);
    try {
      loadMemories(root);
    } catch (err) {
      expect((err as VaultError).field).toBe('expires');
      expect((err as VaultError).file).toBe('memory/less-meat.md');
    }
  });

  it('`type: constraint` 允许 expires 为空 —— 过敏是永久的', () => {
    writeMemory('peanut.md', `
type: constraint
scope: [kitchen]
enforcement: hard
created: 2026-08-04
status: active
`);
    expect(loadMemories(root)[0].expires).toBeNull();
  });

  it('id 撞车时报错，并说清跟谁撞了', () => {
    writeMemory('a.md', `${PREFERENCE}\nid: same`);
    writeMemory('b.md', `${PREFERENCE}\nid: same`);
    expect(() => loadMemories(root)).toThrow(/重复/);
  });

  it('scope 写了不认识的值时报错', () => {
    writeMemory('bad.md', PREFERENCE.replace('[kitchen]', '[wardrobe]'));
    expect(() => loadMemories(root)).toThrow(VaultError);
  });
});

describe('expires 读取时过滤', () => {
  it('过期的记忆不进检索结果', () => {
    writeMemory('goal.md', `
type: goal
scope: [kitchen]
created: 2026-07-01
expires: 2026-07-31
status: active
`);
    const memories = loadMemories(root);

    expect(isExpired(memories[0], '2026-08-05')).toBe(true);
    expect(retrieveMemories(memories, { scope: 'kitchen', at: '2026-08-05' })).toEqual([]);
  });

  it('失效日当天仍然有效，第二天才失效', () => {
    writeMemory('goal.md', `
type: goal
scope: [kitchen]
created: 2026-07-01
expires: 2026-07-31
status: active
`);
    const [memory] = loadMemories(root);

    expect(isLive(memory, '2026-07-31')).toBe(true);
    expect(isLive(memory, '2026-08-01')).toBe(false);
  });

  it('⚠️ 过滤掉一条过期记忆之后，文件一个字节都没变（决策 ⑥）', () => {
    const filePath = writeMemory('goal.md', `
type: goal
scope: [kitchen]
created: 2026-07-01
expires: 2026-07-31
status: active
`);
    const before = md5(filePath);

    const memories = loadMemories(root);
    retrieveMemories(memories, { scope: 'kitchen', at: '2026-12-31' });
    partitionMemories(memories, { aiConfigured: true, at: '2026-12-31' });

    expect(md5(filePath)).toBe(before);
    expect(existsSync(filePath)).toBe(true);
  });

  it('status: archived 的记忆同样不进检索结果', () => {
    writeMemory('old.md', PREFERENCE.replace('status: active', 'status: archived'));
    expect(retrieveMemories(loadMemories(root), { scope: 'kitchen', at: '2026-08-05' })).toEqual([]);
  });
});

describe('scope 过滤', () => {
  beforeEach(() => {
    writeMemory('kitchen.md', PREFERENCE, '厨房的');
    writeMemory('global.md', PREFERENCE.replace('[kitchen]', '[global]'), '全局的');
  });

  it('kitchen 域能看到 kitchen 的 + global 的', () => {
    const hit = retrieveMemories(loadMemories(root), { scope: 'kitchen', at: '2026-08-05' });
    expect(hit.map((m) => m.content).sort()).toEqual(['全局的', '厨房的']);
  });

  it('global 域看不到只属于 kitchen 的那条', () => {
    const hit = retrieveMemories(loadMemories(root), { scope: 'global', at: '2026-08-05' });
    expect(hit.map((m) => m.content)).toEqual(['全局的']);
  });
});

describe('partitionMemories', () => {
  beforeEach(() => {
    writeMemory('live.md', PREFERENCE, '活着的');
    writeMemory('gone.md', `
type: goal
scope: [kitchen]
created: 2026-07-01
expires: 2026-07-31
status: active
`, '过期的');
  });

  it('⚠️ 没配 key 时，活着的记忆全部落在「未生效」，effective 为空（决策 ⑤）', () => {
    const result = partitionMemories(loadMemories(root), { aiConfigured: false, at: '2026-08-05' });

    expect(result.effective).toEqual([]);
    expect(result.ineffective.map((m) => m.content)).toEqual(['活着的']);
    expect(result.expired.map((m) => m.content)).toEqual(['过期的']);
  });

  it('配了 key 之后同一批记忆进「生效中」', () => {
    const result = partitionMemories(loadMemories(root), { aiConfigured: true, at: '2026-08-05' });

    expect(result.effective.map((m) => m.content)).toEqual(['活着的']);
    expect(result.ineffective).toEqual([]);
  });
});

describe('deleteMemoryFile', () => {
  it('删掉磁盘上的文件', () => {
    const filePath = writeMemory('gone.md', PREFERENCE);
    deleteMemoryFile(root, 'gone.md');
    expect(existsSync(filePath)).toBe(false);
  });

  it('只读沙盒里拒绝删除，且文件还在', () => {
    const filePath = writeMemory('kept.md', PREFERENCE);
    process.env.READ_ONLY = '1';

    expect(() => deleteMemoryFile(root, 'kept.md')).toThrow(/只读/);
    expect(existsSync(filePath)).toBe(true);
  });

  it('挡下路径穿越 —— 文件名是一路从客户端传下来的', () => {
    expect(() => deleteMemoryFile(root, '../kitchen/utensils.yaml')).toThrow(VaultError);
    expect(() => deleteMemoryFile(root, 'evil.md/../../x.md')).toThrow(VaultError);
  });

  it('文件已经不在时给出「刷新一下」而不是堆栈', () => {
    expect(() => deleteMemoryFile(root, 'never-existed.md')).toThrow(/已经不在/);
  });
});
