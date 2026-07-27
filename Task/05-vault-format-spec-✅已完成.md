# 05 — Vault 纯文本格式规范 v0.1（基石）

> **状态**: ✅ 已定稿（2026-07-26）
> **依赖**: 无
> **阶段**: 格式基石
> ⚠️ **下游阻塞**: [Task/04](./04-single-user-local-✅已完成.md)（单用户本地 vault 部署）**依赖本任务定稿才能开工**——它要把这份格式写成代码。本任务是当前实际执行顺序的**第一个**：`05 → 06 → 04`。
>
> **产出**: [docs/vault-format.md](../docs/vault-format.md)（规范正文）+ [docs/vault-examples/](../docs/vault-examples/)（样例文件）

## 目标

定出一份**纯文本 vault 格式规范**，让 Cook Helper 的全部数据都能以「人能读、人能改、git 能 diff」的文件形式表达。

产出是**一份规范文档**（`docs/vault-format.md`），不是代码。代码在 [Task/06](./06-ingredient-name-normalization-✅已完成.md) / [Task/04](./04-single-user-local-✅已完成.md)。

## 为什么做

**这是整个远期规划的基石，因为它一次投入、三处受益**：

1. **它就是运行时数据格式** — [Task/04](./04-single-user-local-✅已完成.md) 会把 Supabase 整块删掉，让这套文件成为**唯一真相**。格式没定，数据层就写不出来
2. **社区分享需要的正是同一个东西** — 菜谱上传 / 下载 / 批量导入**必须**先有一个纯文本菜谱格式（[Task/14](./14-community-sharing.md)）
3. **AI 录入的写入终点** — [Task/11](./11-ai-capture.md) 的拍照 / 小票 / 语音入库，落地写的是同一批文件

> ⚠️ **前提变更（2026-07-26）**
>
> 本节原写着第 1 条是「本地化叙事立刻成立，成本只有重写数据层的 10%」、第 3 条是「未来搬家的**期权**」，并以「**现在不重写数据层**」收尾——那是「先做 export/import 中间态、保留 Supabase 作为运行时」方案下的说法。**该方案已废弃**，见 [FUTURE.md](../FUTURE.md) §1.7 的战略纠正块。
>
> **对本任务的实际影响（重要）**：这份格式不再只需要「能导出得下」，它必须**撑得住当运行时**——高频小改（改一个 `stock_level`）、原子写、解析性能、以及**用户手改出错时能给出可定位的报错**。设计格式时请按「这是数据库」而不是「这是导出文件」来权衡。
>
> **仍然成立的那半句**：**格式是资产，搬家只是搬家。**

## 两条已定的设计决策

### ① frontmatter 里放稳定 ID，文件名保持人类可读

引用一律用 ID，文件名随便改。

> **理由**：Obsidian 最大的软肋就是链接靠**文件名**，改名即断。不重复这个错。

### ② 关联用「名称」，不用 UUID 外键

名称是纯文本世界的天然 join key；UUID 对人不可读，用户手改文件时无法维护。

> **现状**：`RecipeIngredient.inventory_id` 是 UUID 外键（`src/types/index.ts:65`），而 `RecipeUtensil.utensil_name`（`src/types/index.ts:73`）**已经在按名称匹配**——向后者统一。
> 配套需要一张归一化 / 别名表（「西红柿 = 番茄」），见 [Task/06](./06-ingredient-name-normalization-✅已完成.md)。

## 四种数据形状，四种存法

**不能一刀切全用 Markdown。** Obsidian 的 Markdown-as-database 成立是因为它的数据全是**文档**；本项目的数据混了几种形状：

| 形状 | 存法 | 本项目的例子 | 为什么 |
|------|------|------------|-------|
| **文档型** | 一实体一个 `.md`，YAML frontmatter + 正文 | 菜谱 | 人要读要改，diff 友好 |
| **记录型**（可变状态） | **一分类一个 `.yaml`**，按名称排序 | 库存档位、厨具 | 改的是一个小字段。48 个食材各一文件 = churn 地狱 + 满屏 git 噪音；排序后单文件 diff 极干净 |
| **追加型** | **`.jsonl` 按月分片** | 烹饪流水 | 只 append 不重写 = 天然抗同步冲突 |
| **二进制** | 独立文件 + 相对路径引用 | 菜谱照、成品照 | **永远不要 base64 进 Markdown** |

> 布局是**为了在粗暴同步（iCloud / Dropbox / git）下少冲突**而设计的：追加式日志、一实体一文件、没有巨型可变文件。

## 目录布局（草案）

```
vault/
  kitchen/
    recipes/
      宫保鸡丁.md
      麻婆豆腐.md
    inventory/
      vegetable.yaml
      meat.yaml
      egg_dairy_bean.yaml
      staple.yaml
      seasoning.yaml
    utensils.yaml
    log/
      2026-07.jsonl
  memory/                      # 见 Task/10
  assets/
    kitchen/宫保鸡丁-01.jpg
  .index/                      # 派生 SQLite，进 .gitignore
```

## 文件样例（草案）

### 菜谱 `kitchen/recipes/宫保鸡丁.md`

字段直接沿用现有 `RecipeAttributes`（`src/types/index.ts:41`），零翻译成本：

```markdown
---
spec_version: 0.1
id: 01J8XK2M9P              # 稳定 ULID，永不等于文件名
name: 宫保鸡丁
cook_time_minutes: 25
difficulty: medium
attributes:
  method: [炒]
  spiciness: 中辣
  greasiness: 适中
  flavor: 咸鲜
  diet_type: 荤素搭配
  nutrition: [高蛋白]
  scene: [工作日快手]
  cuisine: 川
ingredients:                 # 结构化放 frontmatter，因为分档要算它
  - { name: 鸡胸肉, role: main,      amount: 300g }
  - { name: 花生,   role: auxiliary }
  - { name: 干辣椒, role: seasoning }
utensils: [炒锅]
photos: [../../assets/kitchen/宫保鸡丁-01.jpg]
---

## 步骤
1. 鸡肉切丁，料酒淀粉抓匀
2. 花生冷油下锅炸香，捞出
3. 爆香干辣椒，下鸡丁快炒
4. 调汁下锅，最后放花生

## Tips
花生最后放，保持脆度。
```

### 库存 `kitchen/inventory/vegetable.yaml`

```yaml
# 按名称排序，便于 diff 与冲突合并
- name: 白菜
  total_amount: 一颗
  stock_level: enough
  last_restocked_at: 2026-07-23
- name: 土豆
  total_amount: 500g
  unit: g
  stock_level: low
  last_restocked_at: 2026-07-18
  note: 有点发芽了
- name: 西红柿
  stock_level: out
```

### 厨具 `kitchen/utensils.yaml`

```yaml
- name: 炒锅
  note: 26cm 不粘锅
- name: 蒸锅
```

### 烹饪流水 `kitchen/log/2026-07.jsonl`

```
{"ts":"2026-07-24T19:30:00+08:00","event":"cooked","recipe":"宫保鸡丁","note":"花生炒过头了"}
{"ts":"2026-07-25T09:12:00+08:00","event":"planned","recipe":"麻婆豆腐","for_date":"2026-07-26"}
{"ts":"2026-07-25T20:05:00+08:00","event":"restocked","items":["西红柿","鸡蛋"]}
```

## 关键决策（已全部定稿，2026-07-26）

- [x] **1. 关联键策略** → **DB 层直接用 name**，不用 UUID 外键。不在 export/import 边界做映射——vault 就是新的 DB。
- [x] **2. `inventory.name` 唯一性** → **强制唯一**。同一分类文件内不允许同名；别名表归一化保证跨分类唯一。
- [x] **3. 库存文件粒度** → **一分类一个 `.yaml`**（5 个文件：vegetable / meat / egg_dairy_bean / staple / seasoning），按名称排序。
- [x] **4. 日历与日志的形态** → **可变 per-month YAML**（`calendar/2026-07.yaml`）。烹饪日志另用追加型 `.jsonl`（`log/2026-07.jsonl`）。
- [x] **5. ID 方案** → **ULID**（26 字符，Crockford base32，可排序）。
- [x] **6. 步骤放哪** → **正文 Markdown**（`## 步骤` 二级标题 + 有序列表）。人能写对 > 程序好解析。
- [x] **7. 图片路径基准** → **图片与菜谱文本同一文件夹**（`recipes/{菜谱名}/recipe.md` 旁放 `.jpg`）。路径写相对于 `recipe.md` 的相对路径。
- [x] **8. `spec_version` 字段** → **保留**。一行 YAML，格式升级时价值远超成本。
- [x] **9. 同名菜谱** → **文件名 `{name}.md`**，创建时检测重名提示用户修改。不引入子目录分组。
- [x] **10. Cooklang** → **不兼容**。vault 格式自定（YAML frontmatter + Markdown 正文）。Cooklang 仅作为 Task 14 的导入源保留。

## 交付物（已完成，2026-07-26）

- ✅ **`docs/vault-format.md`** — 规范正文（8 节，覆盖全部实体与字段）
- ✅ **`docs/vault-examples/`** — 12 个样例文件（2 菜谱 + 5 库存分类 + 厨具 + 日历 + 日志 + 别名 + 配置），全部通过 YAML/JSONL 标准解析器验证
- ✅ 决策记录：10 条 checklist 全部有结论且已回填

## 操作步骤（已完成）

1. ✅ 逐条讨论 10 个决策，结论回填
2. ✅ 通读 `src/types/index.ts` 全部枚举与接口，逐字段映射到 vault 格式
   - `user_id` → 删除；`created_at` / `updated_at` → 删除（文件系统时间戳）；`id` → ULID；外键 ID → 名称引用
3. ✅ 写 `docs/vault-format.md`
4. ✅ 手写 `docs/vault-examples/`
5. ✅ 人工校验：样例文件全部通过 `yaml.safe_load` / `json.loads` 解析，零错误

## 验收标准

- `docs/vault-format.md` 覆盖 `src/types/index.ts` 中**每一个**实体与字段，无遗漏、无「待定」
- 10 条关键决策全部有结论且写明理由
- 样例文件能被 YAML / JSONL 标准解析器直接解析（无自定义语法）
- **往返无损**：现有 Supabase 数据 → vault → 再导回，语义不丢（本任务只需在规范层面论证，实现验证归 [Task/07](./07-export-import.md)）
- 一个没读过代码的人，看着样例能手写出一道新菜谱

## 风险与不做什么

- **不写代码**——本任务只产出规范与样例
- **不改数据库 schema**——即使决策 1 选了「改 DB」，实施也归 Task/06 / 07
- **不做**记忆层格式（那是 [Task/10](./10-memory-layer.md)，但两者要保持风格一致：同样是 frontmatter + 正文）
- ⚠️ **不要为了「优雅」把格式设计成需要专用工具才能读**。判据始终是：**用户能不能拿记事本打开、看懂、改对。**

---

## ✅ 完成记录

> **完成日期**: 2026-07-26
> **执行人**: Claude Code

### 执行摘要

| 检查项 | 结果 |
|--------|:--:|
| `docs/vault-format.md` 覆盖 `src/types/index.ts` 全部实体 | ✅ 8 节，无「待定」 |
| 样例文件可被标准解析器读取 | ✅ 12 个文件 |
| **样例能被真实解析层读进内存**（实测，非人工校验） | ✅ 2 菜谱 / 21 库存 / 3 厨具 / 2 日历 / 6 别名 / 配置全部解析成功 |
| 10 条关键决策全部有结论 | ✅ |

### 实施 Task/04 时发现并修正的两处规范内部矛盾

| # | 问题 | 处置 |
|---|------|------|
| 1 | §5 / §7.1 称库存·厨具·日历条目都有 ULID，但 §3.2 / §3.3 字段表与**全部样例文件里根本没有 `id` 字段** | 以字段表为准：库存与厨具**不写 id**，程序内部在读取时合成（库存=归一化 name，厨具=name）。ULID 只用于菜谱与日历条目。§5 已加更正块 |
| 2 | §5 要求 ULID 为 26 字符，但**样例文件里的 id 是 20 位和 12 位**，自己就不满足自己的规范 | schema 放宽为「非空且唯一」而非强制 ULID 格式。理由：本任务验收标准写着「一个没读过代码的人，看着样例能手写出一道新菜谱」——要求手敲 26 位 ULID 与这条直接冲突。ULID 是**生成**方案，不是**校验**门槛；缺 `id` 时用菜谱名兜底 |

> 两处都是「规范文档与自己的样例互相矛盾」，而不是实现偏离规范。**样例文件是规范的一部分**，下次改规范正文时要连样例一起改。
