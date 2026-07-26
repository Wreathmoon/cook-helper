/**
 * Utensil Service — A 层核心纯函数
 * 签名 fn(vault, args)。数据落在 `kitchen/utensils.yaml`。
 *
 * 厨具的关联键是**名称**（菜谱 frontmatter 里 `utensils: [炒锅]`），
 * 所以 `id === name`。
 */
import type { Utensil } from '@/types';
import type { Vault } from '@/lib/vault';
import { assertWritable, VaultError, writeUtensils } from '@/lib/vault';

function toMessage(err: unknown): string {
  return err instanceof VaultError ? err.toDisplayString() : (err as Error).message;
}

/** 查询厨具列表 */
export async function listUtensils(
  vault: Vault
): Promise<{ data: Utensil[]; error: string | null }> {
  return {
    data: [...vault.utensils].sort((a, b) => a.name.localeCompare(b.name, 'zh')),
    error: null,
  };
}

/** 添加厨具 */
export async function addUtensil(
  vault: Vault,
  item: { name: string; category?: string; note?: string }
): Promise<{ data: Utensil | null; error: string | null }> {
  try {
    assertWritable('添加厨具');

    const name = item.name.trim();
    if (!name) return { data: null, error: '厨具名称不能为空' };
    if (vault.utensils.some((existing) => existing.name === name)) {
      return { data: null, error: `「${name}」已经在厨具列表里了` };
    }

    const now = new Date().toISOString();
    const created: Utensil = {
      id: name,
      name,
      category: item.category,
      note: item.note ?? null,
      created_at: now,
      updated_at: now,
    };

    vault.utensils.push(created);
    writeUtensils(vault);
    return { data: created, error: null };
  } catch (err) {
    return { data: null, error: toMessage(err) };
  }
}

/** 删除厨具 */
export async function deleteUtensil(vault: Vault, id: string): Promise<{ error: string | null }> {
  try {
    assertWritable('删除厨具');

    const index = vault.utensils.findIndex((item) => item.id === id);
    if (index === -1) return { error: '厨具不存在' };

    vault.utensils.splice(index, 1);
    writeUtensils(vault);
    return { error: null };
  } catch (err) {
    return { error: toMessage(err) };
  }
}

/** 更新厨具 */
export async function updateUtensil(
  vault: Vault,
  id: string,
  updates: { name?: string; category?: string; note?: string }
): Promise<{ data: Utensil | null; error: string | null }> {
  try {
    assertWritable('修改厨具');

    const item = vault.utensils.find((existing) => existing.id === id);
    if (!item) return { data: null, error: '厨具不存在' };

    if (updates.name !== undefined) {
      const name = updates.name.trim();
      if (!name) return { data: null, error: '厨具名称不能为空' };
      item.name = name;
      item.id = name; // 名称即关联键
    }
    if (updates.category !== undefined) item.category = updates.category;
    if (updates.note !== undefined) item.note = updates.note;
    item.updated_at = new Date().toISOString();

    writeUtensils(vault);
    return { data: item, error: null };
  } catch (err) {
    return { data: null, error: toMessage(err) };
  }
}
