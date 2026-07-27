# 06 — 食材名称归一化 / 别名表

> **状态**: ✅ 已定稿（2026-07-26）
> **依赖**: 05 ✅
> **阶段**: 格式基石
> ⚠️ **下游阻塞**: [Task/04](./04-single-user-local-✅已完成.md)（单用户本地 vault 部署）**依赖本任务定稿才能开工**。原因：vault 用**名称**做 join key 而非 UUID 外键，没有别名表，「西红柿」和「番茄」会被算成两种食材，推荐结果直接错。实际执行顺序：`05 → 06 → 04`。

## 目标

让「名称」成为可靠的 join key——解决「西红柿 / 番茄」「土豆 / 马铃薯」「生抽 / 酱油」指向同一样东西的问题。

## 为什么做

[Task/05](./05-vault-format-spec-✅已完成.md) 已定：**关联用名称，不用 UUID 外键**（纯文本世界里 UUID 对人不可读、手改文件时无法维护）。

但名称做 key 有个绕不过的前提：**必须能把同义词归一**。否则：

- vault 导入时，用户手写的「番茄」匹配不上库存里的「西红柿」→ 推荐分档错误
- 社区下载的菜谱用词与本地库存不一致 → 菜谱全部显示「缺料」
- [Task/11](./11-ai-capture.md) 的 AI 录入（拍照 / 小票识别）产出的名称五花八门，没有归一层就是垃圾进垃圾出

**这一层是名称化关联能否成立的前提**，也是 export/import 与 AI 解析的**共同依赖**。

## 关键决策（已全部定稿，2026-07-26）

- [x] **别名表存哪** → `vault/kitchen/aliases.yaml`（随仓库发布基础版，用户可自行编辑）
- [x] **归一化规则** → 仅做：全半角转换 + 首尾空格去除 + 连续空格合并。**不做**：繁简转换、上下位关系
- [x] **匹配策略** → 仅精确 + 别名表。不做模糊匹配（假匹配比不匹配更难排查；48 种食材不值得冒这个风险）
- [x] **匹配不上时的行为** → 分两层：**写入时**提示用户确认（新建库存项或修正名称）；**读取/推荐时**标记为「未知食材」，菜谱标注后降级展示
- [x] **name 唯一约束** → 已入 Task/05 决策 #2
- [x] **别名表社区分享** → **是**。格式设计为独立文件（`aliases.yaml`），可单独分享。传输机制留给 Task 14
- [x] **归一化函数位置** → `src/lib/utils/normalize-name.ts`，导出 `normalizeIngredientName(name: string): string`
- [x] **别名表初始内容** → 从 48 种种子食材中盘点，附带常见别名（西红柿→番茄、土豆→马铃薯/洋芋、生抽→酱油等）

## 交付物

- 别名表种子数据 `seed/kitchen/aliases.yaml`
- 归一化纯函数 `src/lib/utils/normalize-name.ts`
- 单元测试 `src/lib/utils/__tests__/normalize-name.test.ts`

> ⚠️ **无 migration**：`.sql` migration 在 [Task/04](./04-single-user-local-✅已完成.md) Step 1 里整个删掉了，唯一性约束改由 vault 加载时校验（[docs/vault-format.md](../docs/vault-format.md) §7.1）。

## 操作步骤

> 格式规范已定（[Task/05](./05-vault-format-spec-✅已完成.md) ✅，[docs/vault-format.md](../docs/vault-format.md)）。

### Step 1 — 创建别名表种子文件

**文件**: `seed/kitchen/aliases.yaml`

从 48 种种子食材中盘点同义冲突。已知：
- 种子数据中「鸭」作为菜谱食材引用，但不在种子库存中（实测，见 §交付物注）
- 常见中餐别名：西红柿→番茄、土豆→马铃薯/洋芋、生抽→酱油、鸡蛋→鸡子儿

产出初始别名表（YAML 映射，规范名→别名列表）。

### Step 2 — 写归一化函数

**文件**: `src/lib/utils/normalize-name.ts`

导出：
```ts
export function normalizeIngredientName(name: string): string
```

处理顺序（不可调）：
1. `trim()` — 首尾空格
2. 全角字母/数字 → 半角（仅 ASCII 范围：`Ａ-Ｚ`→`A-Z`、`ａ-ｚ`→`a-z`、`０-９`→`0-9`）
3. 连续空格合并为单个空格
4. 查别名表：`aliases.yaml` 中有映射 → 替换为规范名称

别名表在函数外部加载一次，作为参数传入（避免每次调用读文件）：
```ts
export function loadAliases(aliasesYaml: string): Map<string, string>
```

### Step 3 — 写单元测试

**文件**: `src/lib/utils/__tests__/normalize-name.test.ts`

至少覆盖四类用例：
- 全半角：`"ｐｃ"` → `"pc"`（英文场景）、全角数字
- 空格：`"  猪肉 "` → `"猪肉"`、`"鸡  胸肉"` → `"鸡 胸肉"`
- 别名命中：`"番茄"` → `"西红柿"`（查 aliases.yaml）
- 未知名称：`"火龙果"` → `"火龙果"`（原样返回，不做模糊匹配）

### Step 4 — 接入匹配点（与 Task 04 Step 3 联动）

> ⚠️ **本步骤已于 2026-07-26 实施前修正，见下方「决策修正」。原文保留在修正块里，别照着原文做。**

归一化函数在以下位置调用：
- vault 读取层（`src/lib/vault/reader.ts`，Task 04 产出）：解析菜谱 `ingredients[].name` 时归一化
- vault 读取层构建 `InventoryItem` 时：`id` 字段填**归一化后的 name**（见决策修正 A）
- 菜谱编辑/创建时：用户输入的食材名实时归一化后匹配库存

> ⚠️ **决策修正 A（2026-07-26，实施前）——不要改推荐引擎**
>
> 本步骤原写着：「推荐引擎（`src/lib/recommend/tiering.ts`）：`inventoryMap.get()` 的 key 改用归一化名称，而不是 `inventory_id`；现有 `tiering.ts:24` 需改为 `new Map(inventory.map((i) => [normalizeIngredientName(i.name), i]))`」。**该做法已废弃。**
>
> **理由**：它与 [Task/04](./04-single-user-local-✅已完成.md) 的核心不变量「18 个推荐测试全绿且一个用例都不许改」**直接冲突**。10 个 tiering 测试喂的是 `inventory_id: 'i1'` 配 `id: 'i1'`（`src/lib/recommend/__tests__/tiering.test.ts:49` 等），一旦改成按名称查表，这些用例会在**运行时**全部落进「未知食材」分支，分档结果整体错乱——而这批测试正是本次改造唯一的正确性锚点。
>
> **因此**：**推荐引擎源码一行不动。** 名称 → 实体的解析全部下沉到数据层：
> - vault 读取层构造 `InventoryItem` 时，令 `id = normalizeIngredientName(name)`
> - vault 读取层构造 `recipeIngredients` Map 时，`inventory_id` 填同一个归一化名称
> - `tiering.ts:24` 的 `new Map(inventory.map((i) => [i.id, i]))` 因此天然按归一化名称建索引，源码无需改动
>
> 归一化本来就属于数据层职责而非推荐层职责，这个修正让分层反而更干净。未匹配的食材名 `inventoryMap.get()` 落空 → 走既有的 `'未知食材'` 分支，恰好就是本任务决策「读取时标记为未知食材」想要的行为。

## 验收标准

- 归一化函数有测试覆盖，含全半角 / 空格 / 别名 / 未知名称四类用例
- 现有 39 个测试仍全绿（`npx vitest run`）
- 用「番茄」写的菜谱能正确匹配到库存里的「西红柿」
- 推荐分档结果在改造前后**对同一份数据保持一致**（回归基准）

## 风险与不做什么

- ⚠️ **改动触及推荐引擎的匹配逻辑**（`src/lib/recommend/tiering.ts`），这是产品核心。改前先固化一组「输入 → 期望分档」的回归用例，改完逐条对比
- **不做**模糊匹配自动落库——假匹配比不匹配更难排查
- **不做** AI 辅助归一（那是 Task/11 的事，本任务只提供确定性的归一层）

---

## ✅ 完成记录

> **完成日期**: 2026-07-26
> **执行人**: Claude Code

### 执行摘要

| 检查项 | 结果 |
|--------|:--:|
| `npx vitest run` | ✅ 74 passed（改造前 39） |
| 新增归一化测试 | ✅ 19 个（字面归一 6 / 别名 7 / 冲突检测 4 ~ 种子表质量 3） |
| 「番茄」写的菜谱匹配到库存「西红柿」 | ✅ 有专门用例，且服务层与推荐链路实测通过 |
| 18 个推荐测试保持全绿且用例未改 | ✅ 见 Task/04 完成记录 |
| `npm run build` | ✅ 0 error |

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/lib/utils/normalize-name.ts` | `normalizeIngredientName()` + `buildAliasMap()` |
| `src/lib/utils/__tests__/normalize-name.test.ts` | 19 个用例 |
| `seed/kitchen/aliases.yaml` | 40+ 条别名，覆盖 49 种种子食材里的常见叫法 |

### 与原计划的三处偏差

- **`loadAliases(yaml: string)` → `buildAliasMap(data: unknown)`**：解析 YAML 是 vault 读取层的事，归一化模块只管把「规范名: [别名]」的对象摊平成反向查找表。这样这个模块零 I/O、零依赖，测试也不必造字符串。
- **加了冲突检测**：一个别名指向两个规范名、或别名与某个规范名撞车时**直接抛错**而不是静默取其一。这类冲突静默吞掉的后果是随机错配，排查成本极高。种子别名表有 3 个用例守着这条。
- **`normalizeIngredientName` 先转全角空格再 `trim`**：原步骤写的是先 `trim`，但全角空格 `　` 不被 `String.trim()` 吃掉，`　猪肉　` 会原样漏过去。顺序已调整并有用例。

### 关键决策落定

- **不改推荐引擎**（决策修正 A，见上文）：归一化下沉到 vault 读取层，`InventoryItem.id` = 归一化名称，`tiering.ts` 源码一行未动。
- **「鸭」补进种子库存**：它是 308 条食材引用里唯一对不上库存的一条，缺它首屏会出现「缺: 未知食材」这种没法行动的提示。已作为 `out` 补入 `seed/kitchen/inventory/meat.yaml`，种子里现在**零未知食材**（有测试守）。
