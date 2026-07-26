/**
 * 菜谱照片的落盘路径。
 *
 * 照片不再是对象存储里的对象，而是**菜谱目录里的一个普通文件**——
 * 整个目录可以直接打包发给别人。这里守的是：文件真的写到了那个目录里，
 * 且 frontmatter 的 photos 字段跟着更新（否则重启后照片就"丢"了）。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRecipe, uploadRecipePhoto, deleteRecipePhoto, getRecipeDetail } from '../index';
import { makeTestVault } from '@/lib/vault/__tests__/make-test-vault';
import { vaultPaths } from '@/lib/vault';

let vault: ReturnType<typeof makeTestVault>;

afterEach(() => vault?.cleanup());

function fakeJpeg(name = 'photo.jpg'): File {
  // 前两个字节是 JPEG 的 SOI 标记，内容本身不重要——这一层不解码图片
  return new File([new Uint8Array([0xff, 0xd8, 0x01, 0x02])], name, { type: 'image/jpeg' });
}

describe('uploadRecipePhoto', () => {
  it('照片写进菜谱自己的目录，并记进 frontmatter', async () => {
    vault = makeTestVault();
    const created = await createRecipe(vault, { name: '番茄炒蛋' });
    expect(created.error).toBeNull();

    const result = await uploadRecipePhoto(vault, created.data!.id, fakeJpeg());
    expect(result.error).toBeNull();

    // 落在 kitchen/recipes/番茄炒蛋/ 下
    expect(result.data!.storage_path).toMatch(/^kitchen\/recipes\/番茄炒蛋\/\d+\.jpg$/);
    expect(existsSync(path.join(vault.root, result.data!.storage_path))).toBe(true);

    // frontmatter 里记了文件名（相对 recipe.md），重启后才找得回来
    const md = readFileSync(vaultPaths.recipeFile(vault.root, '番茄炒蛋'), 'utf8');
    expect(md).toContain(path.basename(result.data!.storage_path));
  });

  it('菜谱详情能读到刚上传的照片', async () => {
    vault = makeTestVault();
    const created = await createRecipe(vault, { name: '番茄炒蛋' });
    await uploadRecipePhoto(vault, created.data!.id, fakeJpeg());

    const detail = await getRecipeDetail(vault, created.data!.id);
    expect(detail.data!.photos).toHaveLength(1);
  });

  it('菜谱不存在时报错而不是写出一个孤儿文件', async () => {
    vault = makeTestVault();
    const result = await uploadRecipePhoto(vault, '不存在的菜谱', fakeJpeg());
    expect(result.data).toBeNull();
    expect(result.error).toBe('菜谱不存在');
  });
});

describe('deleteRecipePhoto', () => {
  it('文件和 frontmatter 记录一起消失', async () => {
    vault = makeTestVault();
    const created = await createRecipe(vault, { name: '番茄炒蛋' });
    const uploaded = await uploadRecipePhoto(vault, created.data!.id, fakeJpeg());
    const absolutePath = path.join(vault.root, uploaded.data!.storage_path);

    const result = await deleteRecipePhoto(vault, uploaded.data!.id);

    expect(result.error).toBeNull();
    expect(existsSync(absolutePath)).toBe(false);
    expect(vault.recipePhotos.get(created.data!.id)).toEqual([]);

    const md = readFileSync(vaultPaths.recipeFile(vault.root, '番茄炒蛋'), 'utf8');
    expect(md).not.toContain(path.basename(absolutePath));
  });
});
