/**
 * 食材名称归一化 —— 让「名称」成为可靠的关联键。
 *
 * vault 用名称而不是 UUID 做外键（docs/vault-format.md §1.3），代价是必须
 * 能把同义词归一，否则「西红柿」和「番茄」会被当成两种食材，推荐分档直接错。
 *
 * 规则见 docs/vault-format.md §4。**顺序不可调。**
 * 刻意不做的事：繁简转换、上下位关系、模糊匹配 —— 假匹配比不匹配更难排查。
 */

/** 全角 ASCII（！-～，即 Ａ-Ｚ ａ-ｚ ０-９ 及标点）到半角的码位偏移 */
const FULLWIDTH_TO_ASCII_OFFSET = 0xfee0;
const IDEOGRAPHIC_SPACE = '　';

/**
 * 归一化一个食材名称。
 *
 * @param name 原始名称（用户手写、AI 识别、社区菜谱里来的都可能）
 * @param aliases 别名 → 规范名称的映射，由 {@link loadAliases} 产出。不传则只做字面归一
 */
export function normalizeIngredientName(name: string, aliases?: Map<string, string>): string {
  if (!name) return '';

  // 1. 全角空格先转半角，否则 trim 吃不掉它
  let result = name.replace(new RegExp(IDEOGRAPHIC_SPACE, 'g'), ' ');

  // 2. 首尾空格
  result = result.trim();

  // 3. 全角字母 / 数字 / 标点 → 半角
  result = result.replace(/[！-～]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - FULLWIDTH_TO_ASCII_OFFSET)
  );

  // 4. 连续空格合并
  result = result.replace(/\s+/g, ' ');

  // 5. 查别名表（精确匹配，命中才替换）
  if (aliases) {
    const canonical = aliases.get(result);
    if (canonical) return canonical;
  }

  return result;
}

/**
 * 把 `aliases.yaml` 解析出来的对象摊平成 `别名 → 规范名称` 的查找表。
 *
 * 文件里写的是 `规范名称: [别名, ...]`（人读着顺），查表要的是反向映射。
 * 别名与规范名称本身都会做字面归一，保证查表时两边形状一致。
 *
 * @param aliasesData `yaml.parse()` 的结果
 * @throws 别名重复、或别名与某个规范名称撞名时抛错——这类冲突静默吞掉会变成随机的错配
 */
export function buildAliasMap(aliasesData: unknown): Map<string, string> {
  const map = new Map<string, string>();
  if (!aliasesData || typeof aliasesData !== 'object') return map;

  const entries = Object.entries(aliasesData as Record<string, unknown>);
  const canonicalNames = new Set(entries.map(([canonical]) => normalizeIngredientName(canonical)));

  for (const [rawCanonical, rawAliases] of entries) {
    const canonical = normalizeIngredientName(rawCanonical);
    if (!Array.isArray(rawAliases)) continue;

    for (const rawAlias of rawAliases) {
      const alias = normalizeIngredientName(String(rawAlias));
      if (!alias || alias === canonical) continue;

      if (canonicalNames.has(alias)) {
        throw new Error(
          `别名表冲突：「${alias}」既是 ${canonical} 的别名，又是一个规范名称。别名不能与规范名称重名。`
        );
      }
      const existing = map.get(alias);
      if (existing && existing !== canonical) {
        throw new Error(
          `别名表冲突：「${alias}」同时指向「${existing}」和「${canonical}」。一个别名只能有一个规范名称。`
        );
      }
      map.set(alias, canonical);
    }
  }

  return map;
}
