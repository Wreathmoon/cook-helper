/**
 * `.md` 文件的 YAML frontmatter 拆分与拼装。
 *
 * ⚠️ 不要用 `content.split('---', 3)` —— JS 的 `split` 带 limit 会**丢掉剩余内容**，
 * 正文里只要出现一条 `---` 分隔线就会被截断。这里按行扫描定位闭合分隔符。
 */
import { parse as parseYaml, stringify as stringifyYaml, YAMLParseError } from 'yaml';
import { VaultError } from './errors';

const DELIMITER = '---';

export interface ParsedFile {
  frontmatter: Record<string, unknown>;
  body: string;
}

/**
 * @param content 文件全文
 * @param file 出错时报给用户的文件路径
 */
export function parseFrontmatter(content: string, file: string): ParsedFile {
  const lines = content.replace(/^﻿/, '').split(/\r?\n/);

  if (lines[0]?.trim() !== DELIMITER) {
    throw new VaultError('parse', '文件开头缺少 `---` 分隔线，读不到 frontmatter。', {
      file,
      line: 1,
      hint: '菜谱文件必须以一行 `---` 开头，中间是 YAML 字段，再用一行 `---` 收尾，之后才是正文。',
    });
  }

  const closingIndex = lines.findIndex((line, i) => i > 0 && line.trim() === DELIMITER);
  if (closingIndex === -1) {
    throw new VaultError('parse', 'frontmatter 没有闭合——找不到第二行 `---`。', {
      file,
      hint: '在 YAML 字段结束的地方补一行 `---`。',
    });
  }

  const frontmatterText = lines.slice(1, closingIndex).join('\n');
  const body = lines.slice(closingIndex + 1).join('\n').trim();

  let frontmatter: unknown;
  try {
    frontmatter = parseYaml(frontmatterText);
  } catch (err) {
    // yaml 的行号是相对 frontmatter 片段的，加 1 补回开头那行 `---`
    const line = err instanceof YAMLParseError ? (err.linePos?.[0]?.line ?? 0) + 1 : undefined;
    throw new VaultError('parse', `frontmatter 的 YAML 语法有误：${(err as Error).message}`, {
      file,
      line,
      cause: err,
      hint: '常见原因：缩进用了 Tab（YAML 只认空格）、冒号后面漏了空格、中文引号。',
    });
  }

  if (frontmatter === null || frontmatter === undefined) {
    return { frontmatter: {}, body };
  }
  if (typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
    throw new VaultError('parse', 'frontmatter 必须是「字段: 值」的形式。', { file, line: 2 });
  }

  return { frontmatter: frontmatter as Record<string, unknown>, body };
}

/** 反过来：把 frontmatter 对象 + 正文拼成 `.md` 全文 */
export function serializeFrontmatter(
  frontmatter: Record<string, unknown>,
  body: string
): string {
  const yamlText = stringifyYaml(frontmatter, { lineWidth: 0 }).trimEnd();
  return `${DELIMITER}\n${yamlText}\n${DELIMITER}\n\n${body.trim()}\n`;
}
