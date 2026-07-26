/**
 * 进程内的 vault 单例。
 *
 * 加载一次、常驻内存；但**必须能感知用户在编辑器里的手改**——
 * 「你可以拿记事本打开、改对、刷新页面就生效」是这个项目的核心承诺，
 * 一个永不失效的缓存会直接把它变成谎言。
 *
 * 做法：每次取用前扫一遍 vault 的文件签名（文件数 + 最新 mtime），变了就重读。
 * 一次扫描是几十个 stat 调用，对本地单用户场景是毫秒级噪音；同时做了 500ms 节流，
 * 一次页面渲染里的多次取用只扫一次。
 */
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Vault } from './reader';
import { loadVault } from './reader';
import { ensureVaultInitialized } from './init';

let cached: Vault | null = null;
let cachedSignature = '';
let lastCheckedAt = 0;

const CHECK_INTERVAL_MS = 500;

export function getVault(): Vault {
  if (!cached) {
    const root = ensureVaultInitialized();
    cached = loadVault(root);
    cachedSignature = vaultSignature(root);
    lastCheckedAt = Date.now();
    return cached;
  }

  const now = Date.now();
  if (now - lastCheckedAt >= CHECK_INTERVAL_MS) {
    lastCheckedAt = now;
    const signature = vaultSignature(cached.root);
    if (signature !== cachedSignature) {
      cached = loadVault(cached.root);
      cachedSignature = signature;
    }
  }

  return cached;
}

export function reloadVault(): Vault {
  cached = null;
  return getVault();
}

export function invalidateVault(): void {
  cached = null;
}

/** 应用自己写完文件后调用，免得下一次读取白白重解析一遍刚写的东西 */
export function markVaultWritten(): void {
  if (cached) cachedSignature = vaultSignature(cached.root);
}

/** 文件数 + 最新修改时间。够区分「有人动过文件」，且不用读文件内容 */
function vaultSignature(root: string): string {
  let count = 0;
  let newest = 0;

  const walk = (dir: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // 目录读不了就当它没变，真正的报错留给 loadVault 去给
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        count++;
        try {
          newest = Math.max(newest, statSync(full).mtimeMs);
        } catch {
          // 扫描过程中文件被删了，count 已经变了，签名照样会变
        }
      }
    }
  };

  walk(root);
  return `${count}:${newest}`;
}
