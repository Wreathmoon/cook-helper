# Cook Helper — Vault 纯文本格式规范 v0.1

> **版本**: v0.2 | **创建**: 2026-07-26 | **更新**: 2026-07-26 | **状态**: 已定稿
> **v0.2**：§3.2 补 `price` 字段（实现里已有，规范漏了）；§5 加 ID 规范的更正块。
> **定位**: 本文档定义 Cook Helper 全部数据的纯文本存储格式——每个实体的文件类型、字段定义、目录布局与校验规则。
> **读者**: 开发者（实现数据层）、用户（手改 vault 文件）、AI Agent（解析/生成 vault）。
> **依赖本规范的实现**: `src/lib/vault/`（运行时数据层）、未来的社区菜谱分享（[Task/14](../Task/14-community-sharing.md)）。

---

## 目录

1. [设计原则](#1-设计原则)
2. [目录布局](#2-目录布局)
3. [实体格式定义](#3-实体格式定义)
   - [3.1 菜谱](#31-菜谱)
   - [3.2 库存食材](#32-库存食材)
   - [3.3 厨具](#33-厨具)
   - [3.4 日历](#34-日历)
   - [3.5 烹饪日志](#35-烹饪日志)
   - [3.6 食材别名表](#36-食材别名表)
   - [3.7 推荐配置](#37-推荐配置)
   - [3.8 菜谱照片](#38-菜谱照片)
4. [名称归一化规则](#4-名称归一化规则)
5. [ID 规范](#5-id-规范)
6. [写入规范](#6-写入规范)
7. [校验规则](#7-校验规则)
8. [决策记录](#8-决策记录)

---

## 1. 设计原则

### 1.1 人可以读、人可以改

判据始终是：**用户能不能拿记事本打开、看懂、改对。** 任何需要专用工具才能读写的设计都是错的。

### 1.2 四种数据形状，四种存法

| 形状 | 存法 | 本项目的例子 |
|------|------|------------|
| **文档型** | 一实体一个 `.md`，YAML frontmatter + 正文 | 菜谱 |
| **记录型**（可变状态） | **一分类一个 `.yaml`**，按名称排序 | 库存、厨具、日历 |
| **追加型** | **`.jsonl` 按月分片** | 烹饪日志 |
| **二进制** | 独立文件 + 相对路径引用 | 菜谱照片 |

### 1.3 两条已定决策

1. **frontmatter 里放稳定 ID，文件名保持人类可读。** 引用一律用 ULID，文件名随便改。
2. **关联用「名称」，不用 UUID 外键。** 名称是纯文本世界的天然 join key；配套别名表（「西红柿 = 番茄」）做归一化。

### 1.4 从现有类型到 vault 的映射规则

- `user_id` → **删除**（单用户无需此字段）
- `created_at` / `updated_at` → **删除**（文件系统时间戳天然提供；如需精确时间，看文件）
- `id`（实体主键） → **ULID**，且**只有菜谱与日历条目有**（见 §5 的更正块）。库存与厨具的 id 由程序在读取时按名称合成，文件里不写
- 外键 ID（`inventory_id`、`recipe_id`） → **名称引用**

---

## 2. 目录布局

```
vault/
  kitchen/
    recipes/                    # 文档型：一菜一个子目录
      宫保鸡丁/
        recipe.md               #   菜谱本体（文件名={菜谱名}.md）
        宫保鸡丁-01.jpg          #   成品照（与菜谱同目录）
        宫保鸡丁-02.jpg
      麻婆豆腐/
        recipe.md
      红烧肉/
        recipe.md
    inventory/                  # 记录型：一分类一个 .yaml
      vegetable.yaml
      meat.yaml
      egg_dairy_bean.yaml
      staple.yaml
      seasoning.yaml
    utensils.yaml               # 记录型
    calendar/                   # 记录型：一月一个 .yaml
      2026-07.yaml
      2026-08.yaml
    log/                        # 追加型：一月一个 .jsonl
      2026-07.jsonl
    aliases.yaml                # 别名表
    config.yaml                 # 推荐配置
  .index/                       # 派生 SQLite索引，进 .gitignore（删掉可重建）
```

> **照片与菜谱同目录**（决策 7）：菜谱目录同时容纳 `.md` 和 `.jpg`。照片路径在 frontmatter 里写相对于 `recipe.md` 的路径（`宫保鸡丁-01.jpg`），不需要 `../../assets/` 跨层跳转。

---

## 3. 实体格式定义

### 3.1 菜谱

**文件**: `vault/kitchen/recipes/{菜谱名}/recipe.md`

**类型**: 文档型 — YAML frontmatter + Markdown 正文

#### Frontmatter 字段

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:--:|--------|------|
| `spec_version` | `string` | ✅ | `"0.1"` | 格式版本，用于未来迁移 |
| `id` | `string` | ⭕ | 菜谱名 | 稳定标识符，永不等于文件名。**我们生成时用 ULID，但校验只要求非空且唯一**——手写一道新菜谱不该被要求现敲 26 位 ID，省略时用 `name` 兜底 |
| `name` | `string` | ✅ | — | 菜谱名称 |
| `cook_time_minutes` | `integer` | ❌ | `null` | 烹饪耗时（分钟） |
| `difficulty` | `enum` | ❌ | `null` | `easy` / `medium` / `hard` |
| `attributes` | `object` | ❌ | `{}` | 菜谱属性标签（见下表） |
| `ingredients` | `array` | ❌ | `[]` | 食材列表（见下表） |
| `utensils` | `array<string>` | ❌ | `[]` | 所需厨具名称列表 |
| `photos` | `array<string>` | ❌ | `[]` | 照片相对路径（相对于 `recipe.md`） |

**`attributes` 子字段**（沿用 `RecipeAttributes`，全可选）：

| 字段 | 类型 | 枚举值 |
|------|------|--------|
| `method` | `array<string>` | `炒` / `炖` / `蒸` / `煮` / `烤` / `凉拌` / `炸` |
| `spiciness` | `string` | `不辣` / `微辣` / `中辣` / `重辣` |
| `greasiness` | `string` | `清爽` / `适中` / `重油` |
| `flavor` | `string` | `咸鲜` / `清淡` / `带甜` |
| `diet_type` | `string` | `纯荤` / `荤素搭配` / `纯素` |
| `nutrition` | `array<string>` | `高蛋白` / `高碳水主食` / `多蔬菜纤维` / `汤水` |
| `scene` | `array<string>` | `工作日快手` / `周末慢做` / `宴客硬菜` / `夜宵` |
| `cuisine` | `string` | `川` / `粤` / `鲁` / `家常` / `其他` |

**`ingredients` 数组元素**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|:--:|------|
| `name` | `string` | ✅ | 食材名称（归一化后匹配库存） |
| `role` | `enum` | ✅ | `main` / `auxiliary` / `seasoning` |
| `amount` | `string` | ❌ | 用量（`300g`、`2勺`、`半只` 等） |

#### 正文格式

frontmatter 之后、`---` 分隔线之下是 Markdown 正文。

**约定**：步骤以 `## 步骤` 二级标题开头，内容为有序列表；Tips 以 `## Tips` 开头。

#### 完整样例

```markdown
---
spec_version: "0.1"
id: 01J8XK2M9P3R7VW5ASBQ
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
ingredients:
  - name: 鸡胸肉
    role: main
    amount: 300g
  - name: 花生
    role: auxiliary
  - name: 干辣椒
    role: seasoning
  - name: 葱姜蒜
    role: seasoning
utensils: [炒锅]
photos: [宫保鸡丁-01.jpg]
---

## 步骤
1. 鸡肉切丁，料酒淀粉抓匀
2. 花生冷油下锅炸香，捞出
3. 爆香干辣椒和花椒，下鸡丁快炒至变色
4. 调汁（生抽、醋、白糖、淀粉、水），下锅翻炒
5. 最后放入花生，快速翻匀出锅

## Tips
- 花生最后放，保持脆度
- 鸡丁切小一点更入味
```

---

### 3.2 库存食材

**文件**: `vault/kitchen/inventory/{分类}.yaml`（5 个文件）

**类型**: 记录型 — YAML 数组，按 `name` 排序

**分类文件**: `vegetable.yaml` / `meat.yaml` / `egg_dairy_bean.yaml` / `staple.yaml` / `seasoning.yaml`

#### 字段

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:--:|--------|------|
| `name` | `string` | ✅ | — | **唯一**。归一化后的名称 |
| `total_amount` | `string` | ❌ | — | 总量描述（`一颗`、`500g`） |
| `stock_level` | `enum` | ✅ | `enough` | `enough` / `low` / `out` |
| `unit` | `string` | ❌ | — | 单位（`g` / `个` / `把` 等） |
| `last_restocked_at` | `string` (ISO date) | ❌ | — | 最后补货日期。**不写 = 不知道放了多久**，也因此永远不会被判为「该清库存」 |
| `note` | `string` | ❌ | — | 备注（`有点发芽了`） |
| `price` | `number` | ❌ | — | 参考价（元）。纯提示用，会显示在购物清单里，不参与任何计算逻辑 |

> ⚠️ `name` 在**同一分类文件内**必须唯一。跨分类唯一由别名表归一保证。

#### 完整样例 (`vegetable.yaml`)

```yaml
# 蔬菜类库存 — 按名称排序
- name: 白菜
  total_amount: 一颗
  stock_level: enough
  unit: 颗
  last_restocked_at: 2026-07-23

- name: 土豆
  total_amount: 500g
  stock_level: low
  unit: g
  last_restocked_at: 2026-07-18
  note: 有点发芽了
  price: 4

- name: 西红柿
  stock_level: out
```

---

### 3.3 厨具

**文件**: `vault/kitchen/utensils.yaml`

**类型**: 记录型 — YAML 数组，按 `name` 排序

#### 字段

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:--:|--------|------|
| `name` | `string` | ✅ | — | **唯一**。厨具名称 |
| `category` | `string` | ❌ | — | 分类：`锅具` / `电器` / `其他` |
| `note` | `string` | ❌ | — | 备注（`26cm 不粘锅`） |

#### 完整样例

```yaml
# 厨具 — 按名称排序
- name: 炒锅
  note: 26cm 不粘锅

- name: 蒸锅

- name: 电饭煲
  category: 电器
```

---

### 3.4 日历

**文件**: `vault/kitchen/calendar/{YYYY}-{MM}.yaml`

**类型**: 记录型 — YAML 数组，按 `date` 排序

#### 字段

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:--:|--------|------|
| `id` | `string` (ULID) | ✅ | — | 条目唯一标识 |
| `date` | `string` (ISO date) | ✅ | — | 日期 `2026-07-26` |
| `recipe_name` | `string` | ✅ | — | 菜谱名称（匹配 `recipes/*/recipe.md` 的 `name`） |
| `status` | `enum` | ❌ | `planned` | `planned` / `completed` |
| `notes` | `string` | ❌ | — | 备注 |
| `photos` | `array<string>` | ❌ | `[]` | 成品照相对路径（相对于 vault 根） |

#### 完整样例 (`calendar/2026-07.yaml`)

```yaml
# 2026年7月 烹饪日历 — 按日期排序
- id: 01J9B3EF8K2M
  date: 2026-07-24
  recipe_name: 宫保鸡丁
  status: completed
  notes: 花生炒过头了

- id: 01J9B3GH7N4P
  date: 2026-07-26
  recipe_name: 麻婆豆腐
  status: planned
```

---

### 3.5 烹饪日志

**文件**: `vault/kitchen/log/{YYYY}-{MM}.jsonl`

**类型**: 追加型 — 每行一条 JSON，只 append 不修改

#### 事件类型

| `event` | 含义 | 额外字段 |
|---------|------|---------|
| `cooked` | 做了一道菜 | `recipe`、`note`（可选） |
| `planned` | 计划做一道菜 | `recipe`、`for_date` |
| `restocked` | 补货 | `items`（数组） |

#### 通用字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|:--:|------|
| `ts` | `string` (ISO 8601) | ✅ | 事件发生时间 |
| `event` | `string` | ✅ | 事件类型 |

#### 完整样例 (`log/2026-07.jsonl`)

```jsonlines
{"ts":"2026-07-24T19:30:00+08:00","event":"cooked","recipe":"宫保鸡丁","note":"花生炒过头了"}
{"ts":"2026-07-25T09:12:00+08:00","event":"planned","recipe":"麻婆豆腐","for_date":"2026-07-26"}
{"ts":"2026-07-25T20:05:00+08:00","event":"restocked","items":["西红柿","鸡蛋","生抽"]}
```

---

### 3.6 食材别名表

**文件**: `vault/kitchen/aliases.yaml`

**类型**: 记录型 — YAML 映射。**格式设计允许作为独立文件被单独分享**（社区分享场景）。

#### 格式

```yaml
# 格式: 规范名称:
#   - 别名1
#   - 别名2
西红柿:
  - 番茄
土豆:
  - 马铃薯
  - 洋芋
生抽:
  - 酱油
  - 酿造酱油
```

**规则**：
- key 为规范名称（canonical name），必须是库存中实际存在或即将存在的名称
- value 为别名数组，可以有多条
- 解析时：别名 → 规范名称（单向映射）
- 用户可直接编辑此文件添加自己的别名

---

### 3.7 推荐配置

**文件**: `vault/kitchen/config.yaml`

**类型**: 记录型 — YAML

#### 字段（沿用 `RECOMMEND_CONFIG`）

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `topPerTier` | `integer` | `4` | 每档推荐数量 |
| `maxMissingForShopping` | `integer` | `3` | 缺几样以内才进"需采购"档 |
| `clearStockThreshold` | `object` | 见下 | 清库存阈值（天数） |
| `weights` | `object` | 见下 | 档内评分权重 |

#### 完整样例

```yaml
# 推荐引擎配置
topPerTier: 4
maxMissingForShopping: 3

clearStockThreshold:
  vegetable: 3
  meat: 7
  egg_dairy_bean: 5

weights:
  noRepeat: 0.35
  clearStock: 0.25
  timeMatch: 0.20
  nutritionBalance: 0.20
```

> 此文件在首次初始化时从 `seed/kitchen/config.yaml` 复制。用户可自行调整权重和阈值。

---

### 3.8 菜谱照片

**位置**: 与 `recipe.md` 同目录（`vault/kitchen/recipes/{菜谱名}/{文件名}.jpg`）

**规则**：
- 格式：JPEG / PNG / WebP
- 路径：在 `recipe.md` 的 frontmatter `photos` 数组中写相对路径（`宫保鸡丁-01.jpg`）
- 日历照片暂不处理（一期功能不强依赖日历照片，vault 中可预留字段但不实现上传）
- 种子 vault **不附带照片**（无图菜谱用 `NoPhotoCard` 样式兜底）

---

## 4. 名称归一化规则

匹配前统一做以下处理（顺序不可调）：

1. **首尾空格去除** — `" 猪肉 "` → `"猪肉"`
2. **全半角转换** — 全角字母/数字 → 半角（`"Ａ"` → `"A"`，`"３"` → `"3"`）
3. **连续空格合并** — `"鸡  胸肉"` → `"鸡 胸肉"`
4. **别名查表** — 归一化后的名称查 `aliases.yaml`，命中则替换为规范名称

**不做**：
- 繁简转换（`豬肉` → `猪肉`）
- 上下位关系（`大葱` → `葱姜蒜`）
- 模糊匹配 / 编辑距离

---

## 5. ID 规范

使用 **ULID**（Universally Unique Lexicographically Sortable Identifier）。

| 属性 | 值 |
|------|-----|
| 长度 | 26 字符 |
| 字符集 | Crockford base32（`0123456789ABCDEFGHJKMNPQRSTVWXYZ`，去掉了 I/L/O/U） |
| 结构 | 前 10 字符 = 毫秒时间戳，后 16 字符 = 随机 |
| 排序 | 按创建时间自然有序 |

**使用场景**：**菜谱**与**日历条目**——它们需要一个不随重命名而变的稳定引用。

> ⚠️ **更正（2026-07-26）**
>
> 本节原写着使用场景是「菜谱、库存食材、厨具、日历条目」，与 §3.2 / §3.3 的字段表以及全部样例文件**互相矛盾**——那里既没有 `id` 字段，样例里也从没写过。
>
> **以字段表与样例为准**：**库存食材与厨具的 vault 文件里不写 `id`。** 它们的 join key 就是归一化后的 `name`（§1.3 决策 2），再给一个 ULID 属于既冗余又要求用户手工维护。
>
> 程序内部若需要 `id`，在**读取时合成**：库存 = 归一化后的 `name`，厨具 = `name`。落盘的文件里永远没有这个字段。

---

## 6. 写入规范

### 6.1 原子写

所有文件写入必须走**临时文件 + rename**流程：

```
1. 写 temp 文件（同目录下 .tmp 后缀）
2. fsync temp 文件
3. rename temp → 正式文件名（原子操作，同文件系统内）
```

写入过程中强制杀进程，正式文件不会出现损坏（要么是旧内容，要么是新内容）。

### 6.2 并发

同一 vault 被两个进程打开时 **不主动加锁**。理由：单用户场景下双重 `next dev` 是使用失误而非正常操作；文件级 rename 原子性已足够保护单次写入。

---

## 7. 校验规则

### 7.1 启动时校验

应用启动时对 vault 做全量解析，以下任一失败均**阻止启动**并给出可定位报错：

| 检查项 | 失败时信息必须包含 |
|--------|------------------|
| YAML 语法是否合法 | 文件路径 + 行号 |
| 必填字段是否存在 | 文件路径 + 缺失字段名 |
| 枚举值是否合法 | 文件路径 + 字段名 + 非法值 + 合法值列表 |
| 库存 `name` 是否在同一分类内唯一 | 文件路径 + 重复的名称 |
| 菜谱 `ingredients[].name` 归一化后是否能匹配库存或别名表 | 菜谱名 + 未匹配的食材名 |
| ULID 格式是否正确（26 字符，合法 base32）——**仅菜谱与日历条目**，见 §5 | 文件路径 + 非法 ID 值 |

### 7.2 运行时校验（用户编辑后）

用户通过 UI 写入 vault 时，对输入做字段级校验（同 §7.1），失败时返回指向具体字段的错误信息。

### 7.3 校验层级

```
用户手改文件 → 保存 → 下次启动校验（§7.1 全部规则）
用户通过UI编辑 → 提交 → 即时校验（§7.2 字段级规则）
推荐引擎加载菜谱 → 实时 → 名称归一化 + 别名匹配（§4）
```

---

## 8. 决策记录

以下决策在本文档中落地（编号沿用作者本地规划文档里的 Task 05）：

| # | 决策 | 本文档对应位置 |
|---|------|--------------|
| 1 | 关联键直接用 name | §3.1 `ingredients[].name`、§3.4 `recipe_name` |
| 2 | name 唯一约束 | §3.2 `name` 字段说明、§7.1 校验 |
| 3 | 库存一分类一文件 | §2 目录布局、§3.2 5 个分类文件 |
| 4 | 日历 per-month YAML | §3.4 `calendar/{YYYY}-{MM}.yaml` |
| 5 | ULID | §5 ID 规范 |
| 6 | 步骤放正文 | §3.1 正文格式 |
| 7 | 照片与菜谱同目录 | §2 目录布局、§3.8 |
| 8 | spec_version 保留 | §3.1 必填字段 |
| 9 | 同名菜谱提示 | §3.1 文件命名 |
| 10 | 不兼容 Cooklang | — |

以下决策来自名称归一化设计（作者本地规划文档 Task 06）：

| # | 决策 | 本文档对应位置 |
|---|------|--------------|
| 1 | 别名表 `aliases.yaml` | §3.6 |
| 2 | 仅做全半角+空格 | §4 归一化规则 |
| 3 | 仅精确+别名匹配 | §4 |
| 4 | 写入提示确认 / 读取标记未知 | §7.2、§7.3 |
| 5 | name 唯一（入 05#2） | — |
| 6 | 别名表允许独立分享 | §3.6 格式说明 |

---

> **本文档随格式升级更新。** `spec_version` 字段即本文档版本号的对应物——当本文档修订时，`spec_version` 递增，解析器据此做兼容处理。
