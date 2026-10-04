# Cook Helper — Specification

> **版本**: v2.8 | **更新**: 2026-08-05 | **状态**: AI 录入 + AI 命令层已落地，记忆开始生效  
> **v2.8 的变化**：新增 AI 命令层（[Task/12](./Task/12-ai-command-layer.md)）——`src/lib/ai/`（memory-prompt / annotate / verdict / limits / tools / agent）、`src/lib/services/command/`、`src/app/actions/command.ts`、`src/components/command/`（⌘K 命令栏）、`src/lib/recommend/compose.ts`。**记忆自此真的生效**：推荐页事后标注 + agent 的 system prompt。测试 154 → 171。⚠️ **写工具一个都没有**——模型只能调终止型的 `propose_changes`，写入永不进入 agent 循环（§5「AI 层」）。
> **v2.7 的变化**：新增 AI 录入（[Task/11](./Task/11-ai-capture.md)）——`src/lib/ai/`（provider 中立的 BYOK：OpenAI 兼容端点 + 模型角色）、`src/lib/services/capture/`、`src/app/actions/capture.ts`、`src/components/capture/`；`inventory` service 新增 `restoreInventoryState()`（撤销专用，**不套「补货即盖时间戳」规则**）；`InventoryView` / `CalendarView` 新增 `headerExtra` 插槽；`isAiConfigured()` 语义收紧为「端点 + key + 模型都配齐」；测试 128 → 154。**首批需要 key 的功能从 1 个变成 2 个**（记忆 + AI 录入），其余一切仍然无 key 可用。
> **v2.6 的变化**：新增记忆层（[Task/10](./Task/10-memory-layer-✅已完成.md)）——`vault/memory/*.md`、`src/lib/memory/`、`/memory` 管理页、`src/lib/ai/config.ts` 的 `isAiConfigured()`、`buildReasons()` 从 `HeroCard.tsx` 抽到 `src/lib/recommend/reasons.ts` 并加上记忆固定槽位；`Vault` 新增 `memories`；测试 102 → 128。⚠️ **本次不含任何让记忆影响推荐的代码**，那属 [Task/12](./Task/12-ai-command-layer.md)。
> **v2.5 的变化**：新增 §10.3 Docker 自托管（[Task/09](./Task/09-local-web-service-✅已完成.md)）——`Dockerfile` / `docker-compose.yml` / `.dockerignore`，`output: 'standalone'` 由 `BUILD_STANDALONE=1` 门控以保证 Vercel 路径不受影响；`init.ts` 的初始化判据从「目录存在」改成「目录非空」（Docker 绑定挂载会先建空目录）；测试 97 → 102。
> **v2.4 的变化**：§3.2.1 补上两行 `overscroll-behavior` 的契约（`8a52ab9` 已进代码但当时没回写文档）——它们是内层滚动布局的必要配套，删了会「加载时手一滑页面就跳走」。
> **v2.3 的变化**：新增 §3.2.1 页面滚动契约——修一个「所有页面都滚不动」的 bug 时发现这条约束从没写下来过。
> **v2.2 的变化**：新增 §8.1 客户端启动补丁（antd × React 19，`message.*` 不打补丁会静默失效）；§1 补依赖、§9 补文件、§11 测试 94 → 97。
> **v2.1 的变化**：§10.2 补上两条部署必读警告（`READ_ONLY` 是必填、`seed/` 需要显式文件追踪）。
> **v2.0 的变化**：数据层从 Supabase PostgreSQL 整体换成**本机纯文本 vault**，认证与多用户移除。§2 / §3 / §7 / §9 / §10 全部重写。  
> **定位**: 本文档包含完整的技术实现规格——数据格式、路由、Service 签名、部署步骤。AI Agent 可据此复刻项目。设计理念见 [DESIGN.md](./DESIGN.md)，数据文件格式见 [docs/vault-format.md](./docs/vault-format.md)。  
> **读者**: 开发者、AI Agent（理解项目实现细节的第二站）。

---

## 1. 技术栈（精确版本）

| 依赖 | 版本 | 用途 |
|------|------|------|
| next | 16.2.10 | React 全栈框架 (App Router) |
| react / react-dom | 19.2.4 | UI 渲染 |
| typescript | ^5 | 类型系统 |
| antd | 5.29.3 | UI 组件库 |
| @ant-design/pro-components | 2.8.10 | 高级组件 |
| @ant-design/icons | 6.3.2 | 图标库 |
| **@ant-design/v5-patch-for-react-19** | 1.0.3 | **必需**：antd v5 静态 `message.*` 在 React 19 下不打补丁就静默失效，见 §8.1 |
| **yaml** | 2.9.0 | vault 文件解析 / 序列化 |
| **zod** | 4.4.3 | vault schema 校验（产出可定位的报错）+ AI 结构化输出的 schema |
| **ai** | 7.0.52 | AI SDK。用 `generateText` + `Output.object()`（v7 里 `generateObject` 已废弃） |
| **@ai-sdk/openai-compatible** | 3.0.23 | **provider 中立**的接入层——不绑厂商，任何 OpenAI 兼容端点都能接 |
| zustand | 5.0.14 | 客户端状态管理 |
| dayjs | 1.11.21 | 日期处理 |
| vitest | 4.1.9 | 单测框架 |
| @testing-library/react | 16.3.2 | React 组件测试 |
| @testing-library/dom | 10.4.1 | DOM 测试工具 |
| jsdom | 29.1.1 | 测试环境 DOM |
| tailwindcss | ^4 | 辅助样式 |
| tsx | 4.23.0 | TS 脚本执行器 |

**没有数据库驱动、没有 ORM、没有后端 SDK。** 数据层只依赖 `yaml` 和 Node 内置的 `fs`。

**也没有任何厂商的模型 SDK。** `ai` + `@ai-sdk/openai-compatible` 是协议适配层，不是某一家的客户端——
用户给什么端点和 key，就跟谁说话（§5 AI 层）。

---

## 2. 数据设计

**没有数据库。**所有数据是 `data/kitchen/` 下的纯文本文件，字段级定义见 [docs/vault-format.md](./docs/vault-format.md)（本节不重复，避免两处定义漂移）。

### 2.1 目录布局

```
data/kitchen/                     # 运行时 vault（.gitignore）
  recipes/{菜名}/recipe.md        # 文档型：YAML frontmatter + Markdown 正文
  recipes/{菜名}/*.jpg            #   成品照与菜谱同目录
  inventory/{分类}.yaml           # 记录型：5 个分类文件，按名称排序
  utensils.yaml
  calendar/{YYYY}-{MM}.yaml       # 按月分片
  aliases.yaml                    # 食材别名表
  config.yaml                     # 推荐引擎配置

data/memory/                      # 记忆：一条一个 .md（**与 kitchen/ 平级**）
  {任意名字}.md                  #   扫目录识别，**无索引文件**

seed/                             # 随仓库发布的种子模板（进 git）
```

`VAULT_PATH` 可把 vault 指到仓库外；默认 `./data`。首次启动时若 `data/` 不存在，
`ensureVaultInitialized()` 会把 `seed/` 整个复制过去（排除 `README.md`）。

它还会在 `data/` 已有内容时**补一个空的 `memory/` 目录**：记忆层之前就存在的 vault
拿不到种子里的 `memory/`，而管理页空态会让用户「去 `memory/` 下新建一个 .md」。
**只建空目录，不塞任何文件。**

### 2.2 关联键：名称，不是 UUID

| 实体 | `id` 从哪来 | 被谁引用 |
|------|-----------|---------|
| 库存食材 | **归一化后的 `name`**（加载时合成，文件里不写） | 菜谱 frontmatter 的 `ingredients[].name` |
| 厨具 | **`name`**（同上） | 菜谱 frontmatter 的 `utensils[]` |
| 菜谱 | 文件里的 ULID（缺省时用菜谱名兜底） | 日历的 `recipe_name`（按名称，非 id） |
| 日历条目 | 文件里的 ULID（缺省时用 `{月份}:{序号}`） | — |

> ⚠️ **这条决定了推荐引擎为什么一行没改**：`tiering.ts` 按 `InventoryItem.id` 建索引，
> 而加载时 `id` 就是归一化名称，菜谱食材引用填的也是同一个归一化名称——两边天然对上。
> 归一化属于数据层职责，不该漏进推荐层。

### 2.3 内存中的 Vault

`loadVault(root)` 一次性把整个 vault 读进这个对象（`src/lib/vault/reader.ts`）：

```typescript
interface Vault {
  root: string;
  recipes: Recipe[];
  recipeDirs: Map<string, string>;                       // 菜谱 id → 磁盘目录名
  recipeIngredients: Map<string, VaultRecipeIngredient[]>;  // inventory_id = 归一化名称
  recipeUtensils: Map<string, string[]>;
  recipePhotos: Map<string, RecipePhoto[]>;
  inventory: InventoryItem[];
  utensils: Utensil[];
  calendar: CalendarEntry[];
  calendarRecipeNames: Map<string, string>;              // 日历条目 id → 菜谱名
  memories: Memory[];                                    // 未做过期 / scope 过滤（那是读取时的事）
  aliases: Map<string, string>;                          // 别名 → 规范名
  config: typeof RECOMMEND_CONFIG;
}
```

**不建 SQLite 派生索引**：49 食材 + 54 菜谱的量级，全量解析是毫秒级，`Map.get()` 是 O(1)。
native addon 的跨平台编译问题会直接破坏「clone 完就能跑」。

### 2.4 校验与报错

`src/lib/vault/schema.ts` 用 Zod 定义每个文件的形状，`parseOrThrow()` 把 Zod 的报错
翻译成 `VaultError`，带 **kind / file / line / field / hint**。典型输出：

```
kitchen/inventory/vegetable.yaml 第 6 行：YAML 语法有误：Unexpected scalar at node end
常见原因：缩进用了 Tab（YAML 只认空格）、冒号后面漏了空格、中文标点。
```

启动时全量校验，任一失败都阻止启动——**宁可起不来，也不要带着半份坏数据算推荐**。

### 2.5 写入

全部走 `writeFileAtomic()`：同目录写 `.tmp` → `rename`。写到一半被强杀，正式文件
要么是旧内容要么是新内容。单用户场景**不加锁**（docs/vault-format.md §6）。

| 改动 | 重写哪个文件 |
|------|------------|
| 任一食材 | 该分类的整份 `inventory/{分类}.yaml`（按名称排序） |
| 任一厨具 | `utensils.yaml` |
| 任一菜谱 | `recipes/{菜名}/recipe.md`；改名 = 删旧目录 + 写新目录 |
| 任一日历条目 | `calendar/{当月}.yaml`；整月清空则删文件 |

---

## 3. 路由设计

### 3.1 路由表

**没有认证，没有路由守卫，没有路由组。**

| 路由 | 文件 | 类型 | 说明 |
|------|------|:----:|------|
| `/` | `page.tsx` | Server | 重定向到 `/recommend` |
| `/recommend` | `recommend/page.tsx` | Client | ★ 首页：推荐 + 购物清单 |
| `/inventory` | `inventory/page.tsx` | Client | 食材管理 |
| `/utensils` | `utensils/page.tsx` | Client | 厨具管理 |
| `/recipes` | `recipes/page.tsx` | Client | 菜谱库 |
| `/recipes/new` | `recipes/new/page.tsx` | Client | 新建菜谱 |
| `/calendar` | `calendar/page.tsx` | Client | 烹饪日历 |
| `/memory` | `memory/page.tsx` | Client | 记忆管理（**项目第一个设置类页面**） |
| `/api/photo` | `api/photo/route.ts` | Route Handler | 读 vault 里的照片；`..` 越界 → 403 |

### 3.2 根布局

```typescript
// src/app/layout.tsx — Server Component
const readOnly = isReadOnly();          // READ_ONLY 环境变量
<AntdRegistry><ThemeProvider>
  <ReadOnlyProvider value={readOnly}>
    <AppLayout readOnly={readOnly}>{children}</AppLayout>
  </ReadOnlyProvider>
</ThemeProvider></AntdRegistry>
```

### 3.2.1 页面滚动契约（改布局前必读）

整页高度锁死在 `100vh`，**页面内容自己不撑高文档**——滚动发生在 `.page-body` 内部。
这条链上任何一环写错，页面就会「滚不动、下半截被裁掉」，而且**没有任何报错**：

```
div  height:100vh; display:flex              ← AppLayout 根
└ main  flex:1; display:flex; column; minHeight:0; overflow:hidden
  └ div  flex:1; display:flex; column; minHeight:0; overflow:hidden   ← 内容槽
    └ 页面根元素
      ├ .page-head   flex:none            （可选）
      └ .page-body   flex:1; overflow:auto ← ★ 真正的滚动容器
```

**每个页面的根必须让 `.page-body` 成为「内容槽」的 flex 子元素。** 两种合法写法：

| 写法 | 用在 |
|------|------|
| 返回 `<>` 包 `.page-head` + `.page-body` 两个兄弟 | recommend / inventory / utensils |
| 根元素自己就是 `.page-body`（`PageHeader` 放里面） | recipes / recipes/new / calendar |

⚠️ **不要**给页面根套一个没有 `display:flex` 的 `<div>`，也**不要**让页面根是个裸 `<div>`
而把 `.page-body` 埋在更深层——`.page-body` 的 `flex:1` 会失效，高度退化成内容高度，
`overflow:auto` 永不触发，超出部分被上层 `overflow:hidden` 裁掉且**滚不到**。

> `minHeight:0` 是必需的：flex item 默认 `min-height:auto`，不解除的话它会被内容撑破，
> 而不是把溢出交给子级滚动。
>
> 回归判据（浏览器 console，任意页面）：
> ```js
> const b = document.querySelector('.page-body');
> getComputedStyle(b.parentElement).display === 'flex'   // 必须 true
> ```

**配套的两行 `overscroll-behavior`（`src/app/globals.css`，别删）**：

| 选择器 | 值 | 防的是什么 |
|--------|-----|-----------|
| `body` | `overscroll-behavior: none` | 滚到边界后继续滑，触发浏览器的**前进/后退手势**或下拉刷新——在数据加载中触发就等于把用户踢出当前页 |
| `.page-body` | `overscroll-behavior: contain` | 滚动容器到底后，把剩余滚动量**截在容器内**，不冒泡给 `body` |

⚠️ 这两行是上面那套 `100vh` + 内层滚动布局的**必要配套，不是可选美化**。
一旦滚动发生在页面内部容器里（而不是文档本身），边界溢出就会直接落到浏览器的手势处理上。
**改布局或重写 `globals.css` 时删掉它们，症状是「加载时手一滑页面就跳走」，且不报错。**

### 3.3 数据加载约定

页面是 Client Component，首屏数据在 `useEffect` 里用**带取消标记的 async IIFE** 拉取：

```typescript
useEffect(() => {
  let cancelled = false;
  (async () => {
    const res = await getListInventory();
    if (cancelled) return;
    /* setState… */
  })();
  return () => { cancelled = true; };
}, []);
```

这样筛选条件连续变化时旧请求不会覆盖新结果，组件卸载后也不再写状态
（同时满足 `react-hooks/set-state-in-effect`——它只认内联的 IIFE，不认抽出去的 fetch 函数）。

---

## 4. Server Actions 接口

所有 `'use server'` 异步函数，供 Client Component 直接调用。
**统一形态**：从 `getVault()` 取 vault，交给 A 层 service，用 `guardData` / `guardResult`
兜住异常，返回 `{data, error}`——vault 加载失败时用户看到的是「哪个文件第几行」，
而不是 Next 的通用报错页。

### 4.1 Inventory (`src/app/actions/inventory.ts`)

| 函数 | 说明 |
|------|------|
| `getListInventory(category?)` | 按分类查询（可选） |
| `addInventoryItemAction(item)` | 新增（name, category, total_amount?, unit?, note?, price?） |
| `updateInventoryItemAction(id, updates)` | 编辑 |
| `deleteInventoryItemAction(id)` | 删除 |
| `batchUpdateStockLevelAction(items[])` | 批量改档位 |

### 4.2 Recipe (`src/app/actions/recipe.ts`)

| 函数 | 说明 |
|------|------|
| `getListRecipes(filters?)` | 搜索 + 标签筛选 |
| `getRecipeDetailAction(id)` | 详情（含食材状态、厨具、照片） |
| `createRecipeAction(data)` / `updateRecipeAction(id, data)` / `deleteRecipeAction(id)` | CRUD |
| `getInventoryForRecipe()` / `getUtensilsForRecipe()` | 表单下拉数据 |
| `uploadRecipePhotoAction(id, formData)` | 保存照片到菜谱目录 |
| `deleteRecipePhotoAction(photoId)` | 删除照片文件 + frontmatter 记录 |
| `getPhotoUrl(storagePath)` | → `/api/photo?path=…` |

### 4.3 Utensil (`src/app/actions/utensil.ts`)

`getListUtensils()` / `addUtensilAction(item)` / `updateUtensilAction(id, updates)` / `deleteUtensilAction(id)`

### 4.4 Calendar (`src/app/actions/calendar.ts`)

`getCalendarEntriesAction(year, month)` / `addCalendarEntryAction(entry)` / `completeEntryAction(id)` /
`deleteCalendarEntryAction(id)` / `updateStockOnCookAction(updates[])` /
`getRecipesForCalendar()` / `getRecipeDetailForCalendar(id)`

### 4.5 Recommend (`src/app/actions/recommend.ts`)

| 函数 | 说明 |
|------|------|
| `getRecommendations(filters?)` | 取 vault → `tierRecipes` → `scoreAndSort` |
| `generateShoppingListAction(recipeIds[], includePlanned?)` | 生成购物清单 |
| `checkoutShoppingListAction(inventoryIds[])` | 勾选回填为 enough |

### 4.6 Memory (`src/app/actions/memory.ts`)

| 函数 | 说明 |
|------|------|
| `getListMemories()` | → `MemoryOverview`：三个分区 + `aiConfigured` + `memoryDir` |
| `deleteMemoryAction(id)` | 删掉磁盘上那个 `.md`。**没有新增 / 编辑 action**（Task/10 决策 ⑦） |

### 4.7 Capture (`src/app/actions/capture.ts`)

**抽取和落库是分开的两组 action，这是安全边界不是风格选择**（Task/11 决策 ⑦）：
`captureXxx` 只读不写，产出提案；`applyXxx` 才写库。中间隔着的用户确认是这个功能唯一的安全带。

| 函数 | 写库 | 说明 |
|------|:----:|------|
| `captureFromImageAction(formData)` | ❌ | 图片 → `InventoryProposal`。`formData` 带 `image` + `kind`(`photo`\|`receipt`) |
| `captureFromTextAction(text)` | ❌ | 一句话 → `{kind:'cooked'\|'stock'\|'unknown'}` |
| `ingredientsForRecipeAction(recipeId)` | ❌ | 用户手选菜谱后重新取主要食材 |
| `applyInventoryCaptureAction(decisions)` | ✅ | → `CaptureSnapshot`（撤销依据） |
| `applyCookedCaptureAction({recipeId,date,decisions})` | ✅ | → `CaptureSnapshot` |
| `undoCaptureAction(snapshot)` | ✅ | 逆操作 |
| `aiCaptureStatusAction()` | ❌ | `{enabled, reason}`，给入口按钮用 |

### 4.8 Command (`src/app/actions/command.ts`)

| 函数 | 写库 | 说明 |
|------|:----:|------|
| `runCommandAction(input)` | ❌ | 跑 agent → `{text, proposal, steps, rejected}`。提案在返回前已过 `validateProposal` |
| `applyProposalAction(changes)` | ✅ | → `CaptureSnapshot` |
| `undoProposalAction(snapshot)` | ✅ | **复用 Task/11 的 `undoCapture`**，不另写 |
| `commandStatusAction()` | ❌ | `{enabled, reason}` |

`src/app/actions/recommend.ts` 另加一个：

| 函数 | 写库 | 说明 |
|------|:----:|------|
| `annotateRecommendationsAction(recipeIds)` | ❌ | 记忆标注。**没配 key 时直接返回空，一次请求都不发** |

> ⚠️ **只读沙盒下命令栏仍可查询**（查询不写盘），但 `buildTools` 不给提案工具，
> 模型因此根本提不出改动来。这与 Task/11 的「拦在入口」不同——那里拦是因为
> 上传照片会真的烧 token，而这里查询本来就是允许的操作。

> ⚠️ **每个 action 自己检查前置条件。** Server Action 是公开的 POST 端点，
> UI 上按钮灰着不代表函数调不到。两道闸：只读沙盒（**拦在发请求之前**，不烧 token）、
> 配置缺失（报出缺哪个环境变量）。

---

## 5. A 层 Service 纯函数

全部来自 `src/lib/services/`，签名一律 `fn(vault, args)`，返回 `{data, error}`。
**所有写函数第一行都是 `assertWritable(动作名)`**——只读沙盒在这里被挡下。

### Inventory Service

```
listInventory(vault, category?)              → {data: InventoryItem[], error}
addInventoryItem(vault, item)                → {data: InventoryItem | null, error}
updateInventoryItem(vault, id, updates)      → {data: InventoryItem | null, error}
deleteInventoryItem(vault, id)               → {error}
batchUpdateStockLevel(vault, items[])        → {error}
updateStockOnCook(vault, updates[])          → {error}
markRestocked(vault, id)                     → {data, error}
batchMarkRestocked(vault, ids[])             → {error}
```

### Recipe Service

```
listRecipes(vault, filters?)                 → {data: Recipe[], error}
getRecipeDetail(vault, recipeId)             → {data: RecipeDetail | null, error}
createRecipe(vault, data)                    → {data: Recipe | null, error}
updateRecipe(vault, recipeId, data)          → {data: Recipe | null, error}
deleteRecipe(vault, recipeId)                → {error}
uploadRecipePhoto(vault, recipeId, file)     → {data: RecipePhoto | null, error}
deleteRecipePhoto(vault, photoId)            → {error}
```

### Utensil Service

```
listUtensils(vault)                          → {data: Utensil[], error}
addUtensil(vault, item)                      → {data: Utensil | null, error}
updateUtensil(vault, id, updates)            → {data: Utensil | null, error}
deleteUtensil(vault, id)                     → {error}
```

### Calendar Service

```
getCalendarEntries(vault, year, month)       → {data: (CalendarEntry & {recipe?})[], error}
addCalendarEntry(vault, entry)               → {data: CalendarEntry | null, error}
completeEntry(vault, entryId)                → {data: CalendarEntry | null, error}
deleteCalendarEntry(vault, entryId)          → {error}
```

### Shopping Service

```
generateShoppingList(vault, recipeIds[], includePlanned?) → {data: ShoppingListItem[], error}
checkoutShoppingList(vault, inventoryIds[])               → {error}
```

### Memory Service

```
listMemories(vault)                          → {data: MemoryOverview, error}
deleteMemory(vault, id)                      → {error}
getMemoriesForPrompt(vault)                  → Memory[]   ⚠️ 已就位，**目前无调用方**，等 Task/12
```

纯函数在 `src/lib/memory/retrieve.ts`，不碰文件系统：

```
isExpired(memory, at?)                       → boolean    expires 当天仍有效
isLive(memory, at?)                          → boolean    active 且未过期
retrieveMemories(memories, {scope, at?})     → Memory[]   命中当前域 + global
partitionMemories(memories, {aiConfigured, at?})
                                             → {effective, ineffective, expired}
```

> ⚠️ **没配 key 时 `effective` 恒为空**，所有活着的记忆落在 `ineffective`。
> 这不是边界情况而是**默认状态**（Task/10 决策 ④⑤）。
> 同样地，**两个 `enforcement` 值都不参与任何代码分支**——包括过敏。

### Capture Service

```
buildInventoryProposal(vault, captures[], {suggestedLevel?})
                                             → InventoryProposal   纯函数，不写盘
buildCookedProposal(vault, rawName)          → CookedProposal      纯函数，不写盘
mainIngredientsOf(vault, recipeId)           → ProposedIngredient[]
applyInventoryDecisions(vault, decisions[])  → {data: CaptureSnapshot, error}
applyCooked(vault, {recipeId,date,decisions})→ {data: CaptureSnapshot, error}
undoCapture(vault, snapshot)                 → {error}
```

三条不变量：

1. **`buildXxx` 不碰磁盘。** 用户没点确认之前 vault 里不该有任何变化。
2. **归一化在这里做，不在模型里做**——`normalizeIngredientName(name, vault.aliases)`。
   让模型自己归一化会绕过别名表，「西红柿」和「番茄」会重新变成两种食材。
3. **`applyXxx` 中途失败也返回快照**，把「已经做成的部分」还给调用方——
   否则用户会卡在一个改了一半、又撤不回去的状态里。

> ⚠️ **撤销走 `restoreInventoryState()`，不走 `batchUpdateStockLevel()`。**
> 后者有一条业务规则：档位变 `enough` 就视同补货、把 `last_restocked_at` 盖成今天。
> 那条规则对「用户真的补货了」是对的，对「撤销一次误录入」是错的——
> 一样放了 8 天的青菜撤销之后补货日期变成今天，它会**静默退出「清库存」推荐档**
> （`tiering.ts:62` 按 `last_restocked_at` 算陈旧度），用户看不到任何异常。
> 所以 `CaptureSnapshot.restore` 存的是 `{id, stock_level, last_restocked_at}` 三元组。

### Command Service

```
validateProposal(vault, changes)   → {valid, rejected}   纯函数，在给用户看之前就查
applyProposal(vault, changes)      → {data: CaptureSnapshot, error}
```

**撤销复用 Task/11 的 `undoCapture()`，不另写一份。** 理由不只是省代码：撤销的正确性
有一条很容易漏的性质（回滚必须连 `last_restocked_at` 一起恢复），
这种性质**只要存在第二份实现，就一定会有一份是错的**。

能提的改动只有两类：日历条目、库存档位。**不给新增食材**——那是 Task/11 那条路径的活。

### AI 层 (`src/lib/ai/`)

**provider 中立的 BYOK**（Task/11 决策 ②③）：不绑任何厂商 SDK，接 OpenAI 兼容协议。

```
config.ts    readAiConfig()      → {config: AiConfig | null, missing: string[]}
             isAiConfigured()    → boolean   端点 + key + 模型都配齐才算
             getAiConfig()       → AiConfig  缺了就抛
             describeMissing()   → string    「缺 AI_MODEL（默认模型…）」
provider.ts  textModel()         → LanguageModel
             visionModel()       → LanguageModel   端点/key/模型名逐项回落到文本角色
             describeModelError(err, {vision})     原样透出 + 报出实际用的端点与模型
structured.ts schemaInstruction(schema) → string   schema → 提示词（端点不支持严格模式时的唯一约束力）
extract.ts   extractFromImage(file, 'photo'|'receipt') → IngredientCapture
             extractFromText(input)                    → TextCapture
vocab.ts     INVENTORY_CATEGORIES / STOCK_LEVELS      交给模型的枚举，编译期与 types 同步

—— 以下为 Task/12 ——
memory-prompt.ts  renderMemoryBlock(memories, at?)  → string   记忆 → 「关于你」区块
                  hasLiveMemories(memories, at?)    → boolean
annotate.ts       annotateWithMemory(memories, candidates)      推荐页标注（**服务端专用**）
verdict.ts        applyMemoryVerdicts(recs, verdicts)           纯函数，**客户端安全**
limits.ts         MAX_STEPS / ANNOTATE_LIMIT                    **零 import**，客户端安全
tools.ts          buildTools(vault, {readOnly})                 7 个读工具 + 1 个终止型提案工具
agent.ts          runAgent(vault, input, {readOnly})            循环，stepCountIs(8) + 120s
```

> ⚠️ **客户端组件绝不能从 `agent.ts` / `annotate.ts` import 运行时值。**
> 一个被 import 的运行时值会带上它的整条依赖链，于是
> `agent → tools → services → vault → node:fs` 全被拖进客户端 bundle，构建直接失败
> （`the chunking context does not support external modules (request: node:fs)`）。
> 纯常量住 `limits.ts`，纯函数住 `verdict.ts`，两者都只 import 类型。**这个坑踩过一次。**

> **写操作不在 agent 循环里。** `propose_changes` 是一个**故意不带 `execute`** 的工具——
> AI SDK 在「调用了没有 execute 的工具」时会停止循环并把调用交还，于是提案浮到 UI 等确认，
> 落库由确定性代码在另一个 action 完成。这个功能的安全性不是靠审批逻辑写得对，
> 而是靠**循环里根本没有写能力**。

| 环境变量 | 必填 | 作用 |
|---|:--:|---|
| `AI_BASE_URL` | ✅ | OpenAI 兼容端点 |
| `AI_API_KEY` | ✅ | 用户自己的 key，**只存在服务端** |
| `AI_MODEL` | ✅ | 默认模型（文本角色） |
| `AI_VISION_MODEL` | — | 视觉角色的模型名，缺省 = `AI_MODEL` |
| `AI_VISION_BASE_URL` | — | 视觉角色的端点，缺省 = `AI_BASE_URL` |
| `AI_VISION_API_KEY` | — | 视觉角色的 key，缺省 = `AI_API_KEY` |

> **两个模型角色，不多不少。** 视觉要能单独指，是因为用户的默认模型可能不是多模态的
> （DeepSeek 这类）。**不做能力探测**——OpenAI 兼容协议里问不出「这个模型支不支持图片」，
> 猜测式降级会把一个清晰的配置问题变成玄学问题。让模型报错，原样透出 + 提示该配什么。
>
> **角色 = 端点 + key + 模型名，三件套各自独立回落**（Task/11 决策 ③ 修订，2026-08-05）。
> 原先视觉角色只能换模型名——那默认了「另一个模型就在同一个端点上」，而这条出路
> 最该生效的场景（云端文本模型 + 本机视觉模型）恰恰是两个端点。
> 独立回落是要点：只换端点不换 key、只换模型名不换端点，都是真实配法。
>
> 结构化输出用 `generateText` + `Output.object({schema})`（AI SDK v7 里
> `generateObject` 已废弃）。**没有任何「从散文里抠 JSON」的解析器**——
> schema 不过就是失败，重试一次，再失败就报错。
>
> ⚠️ **`Output.object` 只负责事后校验，schema 要靠 `structured.ts` 自己写进提示词。**
> 多数 OpenAI 兼容端点不支持 `json_schema`（实测 DeepSeek ❌ / Ollama ✅），
> 而 `@ai-sdk/openai-compatible` 的 `supportsStructuredOutputs` 默认 false——
> 那条路上 schema 会被**静默丢掉**，模型收不到任何字段信息。
> 详见 Task/11 决策 ⑥ 修订与 ⑳：**不能假设端点的私有能力，正如不能假设厂商的私有 SDK。**

---

购物清单是**算出来的**，不落盘：选中菜谱缺的料 + 缺的厨具 + low/out 的调料主食蛋奶
（+ 可选：日历上计划中的菜）。回填时才写库存。

---

## 6. B 层推荐引擎

> 二期由 LLM **增强而非替换**——规则引擎保留为基线，无 API key 时产品完全可用。
> 代码在 `src/lib/recommend/`。`tiering.ts` / `scoring.ts` / `config.ts` 的**逻辑至今一行未改**。
>
> ⚠️ **记忆不进本层。** 过敏 / 禁忌的代码级过滤已被推翻（[DESIGN.md](./DESIGN.md) §6 #14）：
> 菜谱的食材表记的是冰箱库存而不是配料表（宫保鸡丁的食材表里没有花生），
> 在这里做确定性过滤只会**确定性地出错**。

### 配置常量 (`config.ts`)

```typescript
export const RECOMMEND_CONFIG = {
  // 每档推荐数量
  topPerTier: 4,

  // 清库存阈值（天数）— enough 放置超过 N 天才进「清库存」档
  // staple 和 seasoning 不提醒
  clearStockThreshold: { vegetable: 3, meat: 7, egg_dairy_bean: 5 },

  // 档内评分权重
  weights: {
    noRepeat: 0.35,          // 不重样（距上次做的天数）
    clearStock: 0.25,        // 清库存（含久放食材数量）
    timeMatch: 0.20,         // 耗时匹配
    nutritionBalance: 0.20,  // 营养搭配
  },

  // 「需额外购买」档：缺几样以内才推荐
  maxMissingForShopping: 3,
};
```

> 用户可在 `data/kitchen/config.yaml` 里覆盖这些值，重启生效。缺字段的部分回落到上面的默认值。

### 分档 (`tiering.ts`)

```
tierRecipes(recipes, inventory, utensils) → RecommendedRecipe[]
  can_make_now:  食材全齐(含厨具)
  need_shopping: 缺 ≤3 样 / 缺厨具
  clear_stock:   含久放 enough 食材
  缺太多 → 不推荐
```

### 评分 (`scoring.ts`)

```
scoreAndSort(recipes, context) → sorted by score desc
  不重样(最高权重) + 清库存 + 耗时匹配 + 营养搭配
  缺失维度优雅降级
```

> 权重是**动态归一化**的（`scoring.ts` 末尾按实际用到的权重相除），
> 四个默认值和为 1.0 是巧合——**将来加维度不用重新分配前四个**。

### 推荐理由 (`reasons.ts`)

```
buildReasons(rec) → Reason[]   最多 MAX_REASONS (=3) 条
```

从 `HeroCard.tsx` 抽出来的纯函数——它现在有一条**必须成立的不变式**，得能被测试钉住：

| 情况 | 输出 |
|------|------|
| `rec.reason` 为空 | 清库存 / 缺料或全齐 / 快手菜（与改造前一致） |
| `rec.reason` 有值 | **它占第一格**，并挤掉信息量最低的「快手菜」（耗时在标签行另有显示） |

> 为什么需要固定槽位：三格常被「清库存 + 全齐 + 快手菜」占满，记忆理由排第四**必被切**——
> 而且恰好在最需要解释的清库存档上不可见。
> ⚠️ **目前没有任何代码会写 `rec.reason`**，往槽位里填内容是 Task/12 的事。

---

## 7. vault 数据层 (`src/lib/vault/`)

| 文件 | 职责 |
|------|------|
| `paths.ts` | vault 根目录解析（`VAULT_PATH` / `./data`）、`isReadOnly()`、各文件路径 |
| `init.ts` | 首次启动把 `seed/` 复制成 `data/`；只读模式直接用 `seed/`。判断依据是**目录非空**而非目录存在——Docker 绑定挂载会先建一个空目录（见 §10.3 第 3 点） |
| `reader.ts` | 全量解析进内存，产出 `Vault` |
| `writer.ts` | 原子写 + 各实体的序列化；`assertWritable()` |
| `schema.ts` | Zod schema + 报错翻译 |
| `frontmatter.ts` | `.md` 的 frontmatter 拆分与拼装（**按行扫描，不用 `split('---', n)`**） |
| `ulid.ts` | 26 字符 Crockford base32 ID |
| `errors.ts` | `VaultError`（kind / file / line / field / hint） |
| `store.ts` | 进程内单例 + **文件签名校验**：每次取用前比对「文件数 + 最新 mtime」（500ms 节流），变了就重读 |

> `store.ts` 的签名校验是「你可以拿记事本改，刷新页面就生效」这个承诺的实现处。
> 一个永不失效的缓存会让这条承诺变成谎言。

配套的 `src/lib/utils/`：

| 文件 | 职责 |
|------|------|
| `normalize-name.ts` | 食材名归一化（全半角 / 空格 / 别名表），`buildAliasMap()` 带冲突检测 |
| `error.ts` | 错误分类（`vault_format` / `validation` / `io` / `read_only` / `unknown`）+ Server Action 外壳 |
| `compress-image.ts` | 上传前浏览器内压缩（长边 1600px / JPEG 0.82），失败或压不小就用原图 |

---

## 8. 状态管理

| Store (`src/store/`) | 用途 | 持久化 |
|---------------------|------|:------:|
| `theme-store.ts` | Light/Dark 主题 | localStorage |
| `ui-store.ts` | 侧边栏折叠等 UI 状态 | 否 |

> Zustand 仅管 UI 状态，不做服务端数据缓存。
> 只读状态走 React Context（`components/layout/read-only-provider.tsx`），由根布局从服务端注入。

### 8.1 客户端启动补丁 `src/instrumentation-client.ts`

Next 的 `instrumentation-client` 约定：**HTML 加载后、React 水合前**执行一次。本项目用它引入
`@ant-design/v5-patch-for-react-19`。

**为什么必需**：antd v5 的静态 `message.*` / `notification.*` / `Modal.*` 要从 `react-dom`
顶层取 `createRoot` 或 `render` 来挂 holder，而 React 19 把两者都只留在 `react-dom/client`。
不打补丁时这些调用**静默失效**——不抛错、不弹窗，antd 那句兼容警告还被 `NODE_ENV !== 'production'`
包着，所以线上连 console 都是干净的。全项目 10 个文件 68 处 `message.*` 会一起变哑。

**必须在水合前执行**，因为它靠 `unstableSetRender` 改的是 antd 的全局渲染函数，晚于首次
`message.*` 调用就来不及了。

⚠️ **不要把它挪进某个 `'use client'` 组件的 `useEffect`** —— 那样执行时机晚于水合，
且不保证早于第一次 `message.*`。

**移除条件**：升级到 antd v6（原生支持 React 19），届时连同依赖一起删掉。
`utils/__tests__/antd-message.test.ts` 会在补丁失效时立刻变红。

---

## 9. 项目文件树

```
cook-helper/
├── DESIGN.md / SPEC.md / README.md / CONTRIBUTING.md / LICENSE
├── Dockerfile                   ← 自托管镜像（三阶段 → standalone，见 §10.3）
├── docker-compose.yml           ←   一条命令起服务；端口默认只绑 127.0.0.1
├── .dockerignore                ←   data/ 绝不进镜像
├── docs/
│   ├── vault-format.md          ← ★ 数据文件格式规范
│   ├── vault-examples/          ← 规范的样例文件
│   └── recommend-algorithm.md
│
├── seed/                        ← ★ 随仓库发布的种子 vault（进 git）
│   ├── README.md                ←   种子怎么调、last_restocked_at 的坑
│   ├── kitchen/
│       ├── recipes/{54 个菜谱目录}/recipe.md
│       ├── inventory/{5 个分类}.yaml
│       ├── utensils.yaml / aliases.yaml / config.yaml
│       └── calendar/2026-07.yaml
│   └── memory/{2 条示例}.md      ←   故意不放 `goal`：种子进 git，会烂成永久「已过期」
│
├── data/                        ← 运行时 vault（.gitignore，首次启动自动生成）
│
├── src/
│   ├── instrumentation-client.ts ← 水合前执行：antd × React 19 补丁（见 §8.1）
│   ├── app/
│   │   ├── layout.tsx           ← 根布局（AppLayout + ReadOnlyProvider）
│   │   ├── page.tsx             ← → /recommend
│   │   ├── recommend/ inventory/ utensils/ recipes/ recipes/new/ calendar/ memory/
│   │   ├── api/photo/route.ts   ← 照片读取（含越界防护）
│   │   └── actions/             ← Server Actions
│   │       └── inventory.ts / recipe.ts / utensil.ts / calendar.ts / recommend.ts /
│   │           memory.ts / capture.ts   ← capture: 抽取（只读）与落库（写）分开，见 §4.7
│   │
│   ├── components/
│   │   ├── layout/              ← AppLayout / ThemeProvider / AntdRegistry / ReadOnlyProvider
│   │   ├── views/               ← Recommend / Inventory / Utensils / Calendar / Memory 视图
│   │   ├── capture/             ← ★ AI 录入 UI：CaptureEntry（入口按钮 + 状态）/
│   │   │                            CapturePanel（四态状态机）/ CaptureConfirm（**两条管线共用**）
│   │   ├── recommend/           ← HeroCard / AltCard / ShoppingPanel / FilterPopover / …
│   │   ├── recipes/             ← WaterfallCard
│   │   └── shared/              ← RecipeDetailModal / EmptyState / PageHeader / StatusDot / …
│   │
│   ├── lib/
│   │   ├── vault/               ← ★ 数据层（见 §7）+ __tests__/
│   │   ├── memory/              ← ★ 记忆层：schema/reader/retrieve/writer/text + __tests__/
│   │   ├── ai/                  ← ★ provider 中立的 BYOK（见 §5「AI 层」）+ __tests__/
│   │   │   └── config / provider / extract / vocab / text
│   │   ├── services/            ← ★ A 层纯函数
│   │   │   ├── inventory/ + __tests__/    recipe/ + __tests__/
│   │   │   ├── utensil/  calendar/        shopping/ + __tests__/
│   │   │   ├── memory/                     ← listMemories / deleteMemory
│   │   │   └── capture/ + __tests__/       ← 提案 / 落库 / 撤销
│   │   ├── recommend/           ← ★ B 层：config / tiering / scoring / reasons + __tests__/
│   │   ├── seed/__tests__/      ← 种子 vault 质量守门
│   │   ├── constants/text.ts
│   │   └── utils/               ← normalize-name / error / compress-image + __tests__/
│   │
│   ├── store/ / types/
│
└── scripts/
    ├── parse-howtocook.ts       ← 从 HowToCook 仓库解析菜谱的参考工具
    └── verify-ai.ts             ← AI 配置冒烟测试。**会真的发请求**——单测里模型全是 mock 的，
                                     跑再绿也证明不了你的 key 和端点是通的
```

---

## 10. 部署流程

### 10.1 本地（主形态）

```bash
git clone https://github.com/Wreathmoon/cook-helper.git
cd cook-helper
npm install
npm run dev          # → http://localhost:7474
```

**没有第五步。** 不需要数据库、不需要 key、不需要任何环境变量。

| 环境变量 | 默认 | 作用 |
|---------|------|------|
| `VAULT_PATH` | `./data` | vault 位置，可指到 iCloud / Dropbox 目录 |
| `READ_ONLY` | 未设 | 设为 `1` 时所有写入被优雅拒绝 |

### 10.2 只读沙盒（Vercel）

同一份代码，加一个环境变量：

| # | 操作 |
|---|------|
| 1 | vercel.com → Import GitHub repo |
| 2 | Environment Variables 加 **`READ_ONLY=1`**（三个环境都勾） |
| 3 | Framework: Next.js，Root: `/`；**不要设 `VAULT_PATH`** |
| 4 | Deploy → Domains 绑定 `cook.wreathmoon.com`（DNS CNAME → cname.vercel-dns.com） |

Vercel 的文件系统是只读的，`ensureVaultInitialized()` 在只读模式下直接读仓库里的
`seed/`，不尝试复制。重启即重置。

> ⚠️ **`READ_ONLY=1` 是必填项，不是优化项。** 不设的话应用会尝试把 `seed/` 复制成
> `data/`，在 Vercel 的只读文件系统上直接 `EROFS`，**整站起不来**。

> ⚠️ **`seed/` 靠 `next.config.ts` 的 `outputFileTracingIncludes` 才会进部署产物。**
> 运行时读取路径是 `path.join(process.cwd(), 'seed')` 动态拼的，Next 的静态文件追踪
> 看不见它，默认不打包 → 线上每个页面 `ENOENT`。**本地 `npm run dev` 永远发现不了
> 这个问题**（本地就在项目目录里跑），所以改动 `next.config.ts` 或 vault 读取路径后，
> 用 `.next/server/app/**/*.nft.json` 确认 seed 文件仍在追踪结果里。

### 10.3 Docker（自托管）

```bash
docker compose up --build     # 首次
docker compose up -d          # 之后
docker compose down
```

→ <http://localhost:7474>。宿主机的 `./data` 挂进容器，和 `npm run dev` 用的是同一份数据，两种跑法可随时互换。

| 文件 | 作用 |
|------|------|
| `Dockerfile` | 三阶段：`npm ci` → `BUILD_STANDALONE=1 npm run build` → 只带运行时文件的 alpine |
| `docker-compose.yml` | 端口 / 卷 / 环境变量；**端口默认绑 `127.0.0.1:7474`** |
| `.dockerignore` | 把 `data/`、`node_modules`、文档挡在构建上下文外 |

镜像内的固定环境：`PORT=7474`、`HOSTNAME=0.0.0.0`（容器内不绑 0.0.0.0 端口映射就通不了）、`NODE_ENV=production`，以 `node` 用户（uid 1000）运行。

**四个必须知道的点**：

1. **`output: 'standalone'` 由 `BUILD_STANDALONE=1` 开关控制，不是常开。** 只有 Dockerfile 会设它。Vercel 那条已验收的部署路径（§10.2）因此**完全没被动过**——`npm run build` 不产出 `.next/standalone`。
2. **`seed/` 在 Dockerfile 里被显式 `COPY` 了一遍**，尽管 `outputFileTracingIncludes` 理论上已经把它带进 standalone。多 200KB 换掉「追踪规则一变就线上空库」的整类事故。
3. **空的绑定挂载目录必须能触发种子复制。** `docker compose up` 会先把宿主机 `./data` 建成空目录再挂进来；`ensureVaultInitialized()` 判断的是**目录非空**而不是目录存在（`src/lib/vault/init.ts` 的 `hasContent`），否则用户拿到的是空 vault 加一句「找不到 kitchen/」，且删不掉重来——挂载点每次都会被重建。
4. ⚠️ **`ports` 前面那个 `127.0.0.1:` 是安全边界，不是格式噪音。** 去掉它，同一网段的任何设备都能打开这个应用，而**本应用没有任何认证——谁能连上谁就能读写你的全部数据**。

> 用官方 node 镜像自带的 `node` 用户，**不要**再 `adduser --uid 1000`：会直接 `addgroup: gid '1000' in use` 构建失败。

### 10.4 验证清单

```
本地:
  npm run build            # 编译无错误（含 TypeScript 全量检查）
  npx vitest run           # 102 tests 全绿
  npm run lint             # 0 error

功能:
  1. rm -rf data && npm run dev → 首页三档都有菜，无任何配置步骤
  2. /inventory 点档位 → data/kitchen/inventory/*.yaml 立刻变化，无 .tmp 残留
  3. 用编辑器手改 stock_level → 刷新页面数字随之变化
  4. 故意把 yaml 缩进改成 Tab → 报错指明文件与行号
  5. /recipes → 标签筛选 + 详情弹窗 + 加照片
  6. /recommend → 改库存 → 推荐变 → 购物清单 → 回填
  7. /calendar → 记录 / 规划 / 做完更新库存
  8. 主题切换

只读沙盒:
  9. READ_ONLY=1 npx next dev → 顶部出现只读横幅
 10. 任何写操作被拒绝且 seed/ 文件校验和不变

Docker:
 11. rm -rf data && docker compose up --build → ./data 出现 54 个菜谱目录
 12. docker port cook-helper → 只有 127.0.0.1:7474（不是 0.0.0.0）
 13. 改一条库存 → docker compose restart → 改动还在，没被 seed 盖回去
 14. npm run build（不带 BUILD_STANDALONE）→ 不产出 .next/standalone
```

---

## 11. 测试

| 文件 | 覆盖 | 用例 |
|------|------|:--:|
| `recommend/__tests__/tiering.test.ts` | 硬分档规则 | 10 |
| `recommend/__tests__/scoring.test.ts` | 档内评分 | 8 |
| `vault/__tests__/read-only.test.ts` | 只读模式拒绝写入且不落盘 | 5 |
| `vault/__tests__/init.test.ts` | 首次启动种子复制（含**空目录**＝Docker 绑定挂载；补 `memory/`） | 6 |
| `utils/__tests__/normalize-name.test.ts` | 归一化 + 别名 + 冲突检测 + 种子别名表质量 | 19 |
| `utils/__tests__/error.test.ts` | 错误分类 + Server Action 外壳 | 11 |
| `services/inventory/__tests__/` | 库存 CRUD、档位、回填（喂数组 + 真实落盘） | 17 |
| `services/shopping/__tests__/` | 购物清单生成 + 回填 | 9 |
| `services/recipe/__tests__/photo.test.ts` | 照片落盘 / 删除 / frontmatter 同步 | 4 |
| `seed/__tests__/seed-vault.test.ts` | 种子数据质量 + 首屏三档质量 | 11 |
| `utils/__tests__/antd-message.test.ts` | antd 静态 message 在 React 19 下真的挂进 DOM（jsdom） | 3 |
| `memory/__tests__/memory.test.ts` | 记忆读取 / 校验 / `expires` 读时过滤 / 分区 / 删除 | 18 |
| `recommend/__tests__/reasons.test.ts` | `buildReasons()` 的记忆固定槽位 | 6 |
| `ai/__tests__/ai.test.ts` | 配置读取 / 视觉角色回落 / schema / 重试**只重一次** | 13 |
| `services/capture/__tests__/` | 归一化分组 / 菜谱匹配不猜 / 落库 / **撤销不篡改 `last_restocked_at`** | 13 |
| `ai/__tests__/command.test.ts` | 记忆渲染 / 过期不进 prompt / **下沉不删除** / 提案校验 / 落库与撤销 | 17 |
| **合计** | | **171** |

> `antd-message.test.ts` 是**唯一**跑在 jsdom 下的文件（靠文件头 `// @vitest-environment jsdom`，
> 全局仍是 node 环境）。它守的那个 bug 之所以能活下来，正是因为其余测试全是纯函数测试、碰不到 DOM。

运行: `npx vitest run`

> 记忆那 18 条里有两条是**不能删的守护**：
> ① 过期记忆被过滤后比对 **md5 逐字节一致**（决策 ⑥：绝不改用户的文件）；
> ② 没配 key 时活着的记忆全部落在「未生效」（决策 ⑤：用户以为过敏记忆在保护自己、实际什么都没发生）。

> ⚠️ **`ai/__tests__` 里模型调用全部被 mock，它证明不了你的 key 和端点是通的。**
> 那件事只有真实请求能证明，所以另有 `scripts/verify-ai.ts`。两者不能互相替代——
> 单测全绿 + 配置写错，功能照样一点就崩。

> capture 那 13 条里有一条是**不能删的守护**：撤销之后 `last_restocked_at` 必须回到原值。
> 用 `batchUpdateStockLevel` 做撤销会把它盖成今天，让放了 8 天的食材静默退出「清库存」档——
> 用户看不到任何异常，只是推荐从此少了一道该优先吃掉的菜。

> ⚠️ **18 个推荐引擎测试（tiering 10 + scoring 8）是这个项目核心价值的回归基准。**
> 它们完全独立于数据层——换数据层前后必须逐字未改且全绿。
> 如果你发现「得改这些测试才能过」，那说明你正在改变推荐行为，停下来先想清楚。

---

## 12. 种子数据

`seed/` 目录，随仓库发布，首次启动整个复制成 `data/`。

| 数据集 | 数量 | 说明 |
|--------|:---:|------|
| 菜谱 | 54 | 一菜一目录，含步骤与 Tips |
| 食材 | 49 | 5 个分类；档位**手工调**，保证三档推荐都有内容 |
| 厨具 | 4 | 炒锅 / 煮锅 / 蒸锅 / 电饭煲 |
| 日历 | 4 | 3 条已完成 + 1 条计划中 |
| 别名 | 40+ | 「番茄 = 西红柿」等 |
| 记忆 | 2 | 一条 `preference`（不吃辣）+ 一条 `constraint`（花生过敏），都是 `expires: null` |

> 种子里**故意没有 `goal`**：临时目标必须带失效期，而种子进了 git——
> 几个月后它会变成一条永远显示「已过期」的示例。同一个坑对 `last_restocked_at` 也成立。

档位不用 hash 生成——那样首屏推荐质量是碰运气的。调整规则与那个
`last_restocked_at` 的坑见 [seed/README.md](./seed/README.md)。

---

> **本文档与代码同步维护。架构变更见 [DESIGN.md](./DESIGN.md)，数据格式见 [docs/vault-format.md](./docs/vault-format.md)。**
