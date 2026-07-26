/**
 * 上传前在浏览器里压缩照片。
 *
 * 本地化之后照片不再走网络，而是直接写进 vault 目录——所以进度条基本没意义了
 * （毫秒级），但**压缩仍然要做**：手机原图动辄 4–8MB，一道菜存两张、几十道菜之后
 * vault 就从「几百 KB 的纯文本，随手扔进 git / iCloud」变成几个 GB 的负担。
 * 而菜谱照片是给人看一眼的，1600px / JPEG 0.82 足够。
 */

const MAX_EDGE = 1600;
const QUALITY = 0.82;
/** 小于这个尺寸就别折腾了，重编码反而可能变大 */
const SKIP_BELOW_BYTES = 300 * 1024;

export interface CompressResult {
  file: File;
  originalBytes: number;
  compressedBytes: number;
}

export async function compressImage(file: File): Promise<CompressResult> {
  const originalBytes = file.size;

  // GIF 可能是动图，重编码会丢掉动画；小图直接放过
  if (file.type === 'image/gif' || originalBytes < SKIP_BELOW_BYTES) {
    return { file, originalBytes, compressedBytes: originalBytes };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { file, originalBytes, compressedBytes: originalBytes };

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY)
    );
    // 压完反而更大就用原图——这在本来就压过的小图上真的会发生
    if (!blob || blob.size >= originalBytes) {
      return { file, originalBytes, compressedBytes: originalBytes };
    }

    const compressed = new File([blob], replaceExtension(file.name, 'jpg'), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
    return { file: compressed, originalBytes, compressedBytes: compressed.size };
  } catch {
    // 压缩是优化不是功能。失败就原图上传，别把用户的照片弄丢
    return { file, originalBytes, compressedBytes: originalBytes };
  }
}

function replaceExtension(name: string, ext: string): string {
  const base = name.replace(/\.[^.]+$/, '');
  return `${base || 'photo'}.${ext}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
