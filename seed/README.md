# seed/ —— 随仓库发布的默认 vault

`git clone && npm install && npm run dev` 之后，如果 `data/` 不存在，应用会把这个目录
**整个复制**成 `data/`，然后从 `data/` 读写。所以第一次打开就能看到一个有内容的应用，
不需要注册、不需要配置、不需要连任何服务。

- `seed/` 进 git，是只读模板，**你的日常改动不会写到这里**
- `data/` 不进 git（见 `.gitignore`），那是你自己的数据
- 想推倒重来：`rm -rf data/` 然后重启

格式规范见 [docs/vault-format.md](../docs/vault-format.md)。

## 里面有什么

| 内容 | 数量 | 来源 |
|------|-----:|------|
| 菜谱 `kitchen/recipes/*/recipe.md` | 54 | 人工整理 |
| 库存 `kitchen/inventory/*.yaml` | 49 种，5 个分类 | 人工整理 + 手工调档位 |
| 厨具 `kitchen/utensils.yaml` | 4 件 | — |
| 日历 `kitchen/calendar/*.yaml` | 4 条示例 | — |
| 别名表 `kitchen/aliases.yaml` | 40+ 条 | 人工整理 |
| 推荐配置 `kitchen/config.yaml` | — | 与 `src/lib/recommend/config.ts` 的默认值一致 |

## 库存档位是**手工调**的，别用随机数替换

首屏推荐的质量直接决定一个自托管项目会不会被当场关掉。空库 → 推荐全空 →
「这玩意儿没用」是最快的弃用路径，所以这份种子的档位是照着「三档都要有好看的内容」
调出来的，不是 hash 生成的：

- **现在就能做** —— 大部分蔬菜、猪肉、鸡蛋、全部调料主食都是 `enough`
- **该清库存了** —— 菠菜 / 豆腐 / 胡萝卜 / 香菇 是 `enough` 但补货日期很早
- **差一点** —— 牛肉 / 虾 / 鸭 / 西兰花 `out`，鱼 / 豆芽 / 豆干 `low`

### ⚠️ 改 `last_restocked_at` 之前先读这段

清库存判定是 `stock_level === 'enough' && last_restocked_at` 且超过分类阈值
（蔬菜 3 天 / 肉 7 天 / 蛋奶 5 天）。因此：

| 你想要的效果 | 怎么写 |
|------------|--------|
| 长期停在「新鲜」 | **不写 `last_restocked_at`** —— 没有日期就永远不会被判为久放 |
| 长期演示「放久了」 | 写一个**固定的过去日期** |
| ❌ 千万别 | 写「今天」的日期 —— 种子进了 git，几个月后**所有**食材都会变成久放 |

调完想看效果，直接跑一遍推荐即可（`npm run dev` 打开首页），三档都该有菜。
