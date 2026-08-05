/**
 * 首次启动的种子复制。
 *
 * 守的是 Docker 那个坑：`docker compose up` 会先把宿主机的 `./data` 建成**空目录**
 * 再挂进容器。判断条件如果是「目录存在 = 已初始化」，用户拿到的就是一个空 vault
 * 加一句「找不到 kitchen/」——而且删不掉重来，因为挂载点每次都会被重建。
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ensureVaultInitialized } from '../init';

let workdir: string;

beforeEach(() => {
  workdir = mkdtempSync(path.join(tmpdir(), 'cook-init-'));
});

afterEach(() => {
  delete process.env.VAULT_PATH;
  delete process.env.READ_ONLY;
  rmSync(workdir, { recursive: true, force: true });
});

/** seed/ 是从 process.cwd() 拼的，所以只能用相对 VAULT_PATH 指到临时目录 */
function initAt(target: string): string {
  process.env.VAULT_PATH = target;
  return ensureVaultInitialized();
}

describe('ensureVaultInitialized', () => {
  it('目录不存在时，从 seed/ 复制一份', () => {
    const target = path.join(workdir, 'data');

    const root = initAt(target);

    expect(root).toBe(target);
    expect(existsSync(path.join(target, 'kitchen', 'utensils.yaml'))).toBe(true);
  });

  it('目录存在但是空的（Docker 绑定挂载）时，照样复制', () => {
    const target = path.join(workdir, 'data');
    mkdirSync(target);

    initAt(target);

    expect(existsSync(path.join(target, 'kitchen', 'utensils.yaml'))).toBe(true);
  });

  it('目录里已经有东西时，一个字节都不动', () => {
    const target = path.join(workdir, 'data');
    mkdirSync(path.join(target, 'kitchen'), { recursive: true });
    writeFileSync(path.join(target, 'kitchen', 'utensils.yaml'), 'items: []\n');

    initAt(target);

    // 复制过一次的话这里会变成 seed 里那 4 件厨具
    expect(existsSync(path.join(target, 'kitchen', 'recipes'))).toBe(false);
  });

  it('READ_ONLY 时直接用 seed/，不碰目标目录', () => {
    process.env.READ_ONLY = '1';
    const target = path.join(workdir, 'data');

    const root = initAt(target);

    expect(root).toBe(path.join(process.cwd(), 'seed'));
    expect(existsSync(target)).toBe(false);
  });

  it('不复制 seed/README.md —— 那是讲种子模板的，进用户数据只会让人困惑', () => {
    const target = path.join(workdir, 'data');

    initAt(target);

    expect(existsSync(path.join(target, 'README.md'))).toBe(false);
  });
});
