/**
 * HowToCook 解析脚本 — 一次性 Node 脚本，用 tsx 运行
 *
 * 用法: npx tsx scripts/parse-howtocook.ts
 *
 * 功能：
 * 1. Clone HowToCook 仓库到临时目录
 * 2. 遍历 dishes/ 目录下的 markdown 文件
 * 3. 解析菜名、食材、步骤、难度等
 * 4. 推断标签（荤素、烹饪方式、辣度）
 * 5. 输出到 src/lib/seed/seed-data.ts
 *
 * 注意：当前 seed-data.ts 已手工编写完成，此脚本作为参考工具保留。
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const REPO_URL = 'https://github.com/Anduin2017/HowToCook.git';
const CLONE_DIR = path.join(__dirname, '.howtocook-temp');

// 肉类关键词
const MEAT_KEYWORDS = [
  '猪', '牛', '鸡', '鱼', '虾', '肉', '排骨', '鸭', '蟹', '贝',
  '蛤', '鱿鱼', '腊肠', '火腿', '培根', '牛腩', '牛腱', '鸡翅',
  '鸡腿', '猪排', '五花', '瘦肉', '肉末', '肉丝', '肉片',
];

// 烹饪方式关键词
const METHOD_KEYWORDS: Record<string, string[]> = {
  '炒': ['炒', '煸', '爆'],
  '炖': ['炖', '焖', '煨'],
  '蒸': ['蒸'],
  '煮': ['煮', '汆', '涮'],
  '烤': ['烤', '烘', '焙'],
  '凉拌': ['凉拌', '拌'],
  '炸': ['炸', '煎'],
};

// 辣度关键词
const SPICY_KEYWORDS: Record<string, number> = {
  '辣椒': 1, '花椒': 1, '豆瓣酱': 1, '辣': 1,
  '干辣椒': 2, '辣椒油': 1, '剁椒': 2,
  '小米辣': 3, '朝天椒': 3,
};

interface ParsedRecipe {
  name: string;
  ingredients: string[];
  steps: string[];
  method: string[];
  spiciness: string;
  dietType: string;
}

function main() {
  console.log('=== HowToCook 解析脚本 ===');
  console.log('');
  console.log('当前 seed-data.ts 已手工编写完成（54 道菜 + 48 种食材）。');
  console.log('此脚本作为参考工具保留，可用于未来从 HowToCook 仓库批量解析菜谱。');
  console.log('');

  // Step 1: Clone 仓库
  if (!fs.existsSync(CLONE_DIR)) {
    console.log(`正在 clone HowToCook 仓库到 ${CLONE_DIR}...`);
    try {
      execSync(`git clone --depth 1 ${REPO_URL} "${CLONE_DIR}"`, { stdio: 'inherit' });
    } catch {
      console.error('Clone 失败，请检查网络连接和仓库地址');
      process.exit(1);
    }
  } else {
    console.log(`仓库已存在于 ${CLONE_DIR}，跳过 clone`);
  }

  // Step 2: 遍历 dishes/ 目录
  const dishesDir = path.join(CLONE_DIR, 'dishes');
  if (!fs.existsSync(dishesDir)) {
    console.error('dishes/ 目录不存在');
    process.exit(1);
  }

  const mdFiles = findMdFiles(dishesDir);
  console.log(`找到 ${mdFiles.length} 个 markdown 文件`);

  // Step 3: 解析每个文件
  const recipes: ParsedRecipe[] = [];
  for (const file of mdFiles) {
    const recipe = parseMdFile(file);
    if (recipe) {
      recipes.push(recipe);
    }
  }

  console.log(`成功解析 ${recipes.length} 道菜谱`);

  // Step 4: 推断标签
  for (const recipe of recipes) {
    recipe.method = inferMethod(recipe.name, recipe.steps);
    recipe.spiciness = inferSpiciness(recipe.ingredients, recipe.steps);
    recipe.dietType = inferDietType(recipe.ingredients);
  }

  // Step 5: 输出摘要
  console.log('\n=== 解析结果摘要 ===');
  console.log(`总菜谱数: ${recipes.length}`);

  const byMethod: Record<string, number> = {};
  const bySpiciness: Record<string, number> = {};
  const byDiet: Record<string, number> = {};

  for (const r of recipes) {
    for (const m of r.method) byMethod[m] = (byMethod[m] || 0) + 1;
    bySpiciness[r.spiciness] = (bySpiciness[r.spiciness] || 0) + 1;
    byDiet[r.dietType] = (byDiet[r.dietType] || 0) + 1;
  }

  console.log('\n烹饪方式分布:', byMethod);
  console.log('辣度分布:', bySpiciness);
  console.log('荤素分布:', byDiet);

  console.log('\n前 20 道菜谱:');
  recipes.slice(0, 20).forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.name} [${r.method.join('/')}] [${r.spiciness}] [${r.dietType}]`);
  });

  console.log('\n解析完成！如需生成 seed-data.ts，请根据解析结果手工整理。');
}

function findMdFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMdFiles(fullPath));
    } else if (entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

function parseMdFile(filePath: string): ParsedRecipe | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // 菜名：从一级标题或文件名
    let name = '';
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) {
      name = h1Match[1].trim();
    } else {
      name = path.basename(filePath, '.md').trim();
    }

    // 食材：从 "## 食材" 后面的列表提取
    const ingredients: string[] = [];
    let inIngredients = false;
    let inSteps = false;
    const steps: string[] = [];

    for (const line of lines) {
      if (/^##.*食材/.test(line)) {
        inIngredients = true;
        inSteps = false;
        continue;
      }
      if (/^##.*步骤/.test(line) || /^##.*做法/.test(line)) {
        inIngredients = false;
        inSteps = true;
        continue;
      }
      if (/^##/.test(line)) {
        inIngredients = false;
        inSteps = false;
        continue;
      }

      if (inIngredients) {
        // 匹配列表项：- 食材名 用量 或 | 食材名 | 用量 |
        const listMatch = line.match(/^[-*]\s+(.+)/);
        const tableMatch = line.match(/^\|\s*([^|]+)\s*\|/);
        if (listMatch) {
          ingredients.push(listMatch[1].trim());
        } else if (tableMatch && !tableMatch[1].includes('---') && tableMatch[1] !== '食材') {
          ingredients.push(tableMatch[1].trim());
        }
      }

      if (inSteps) {
        const stepMatch = line.match(/^\d+[.、]\s*(.+)/);
        if (stepMatch) {
          steps.push(stepMatch[1].trim());
        }
      }
    }

    if (!name || (ingredients.length === 0 && steps.length === 0)) {
      return null;
    }

    return {
      name,
      ingredients,
      steps,
      method: [],
      spiciness: '不辣',
      dietType: '纯素',
    };
  } catch {
    return null;
  }
}

function inferMethod(name: string, steps: string[]): string[] {
  const text = name + ' ' + steps.join(' ');
  const methods: string[] = [];
  for (const [method, keywords] of Object.entries(METHOD_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      methods.push(method as any);
    }
  }
  return methods.length > 0 ? methods : ['炒'];
}

function inferSpiciness(ingredients: string[], steps: string[]): string {
  const text = [...ingredients, ...steps].join(' ');
  let maxSpicy = 0;
  for (const [keyword, level] of Object.entries(SPICY_KEYWORDS)) {
    if (text.includes(keyword)) {
      maxSpicy = Math.max(maxSpicy, level);
    }
  }
  if (maxSpicy === 0) return '不辣';
  if (maxSpicy === 1) return '微辣';
  if (maxSpicy === 2) return '中辣';
  return '重辣';
}

function inferDietType(ingredients: string[]): string {
  const text = ingredients.join(' ');
  const hasMeat = MEAT_KEYWORDS.some(kw => text.includes(kw));
  if (!hasMeat) return '纯素';
  // 如果主要食材是肉，则为纯荤
  const hasVeg = ['菜', '瓜', '豆', '笋', '菌', '芹', '菠', '葱', '姜', '蒜'].some(kw => text.includes(kw));
  return hasVeg ? '荤素搭配' : '纯荤';
}

main();
