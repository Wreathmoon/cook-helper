# Cook Helper — Specification

> **版本**: v2.3 | **更新**: 2026-07-27 | **状态**: 本地化改造完成，只读沙盒已上线  
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
| **zod** | 4.4.3 | vault schema 校验（产出可定位的报错） |
| zustand | 5.0.14 | 客户端状态管理 |
| dayjs | 1.11.21 | 日期处理 |
| vitest | 4.1.9 | 单测框架 |
| @testing-library/react | 16.3.2 | React 组件测试 |
| @testing-library/dom | 10.4.1 | DOM 测试工具 |
| jsdom | 29.1.1 | 测试环境 DOM |
| tailwindcss | ^4 | 辅助样式 |
| tsx | 4.23.0 | TS 脚本执行器 |

**没有数据库驱动、没有 ORM、没有后端 SDK。** 数据层只依赖 `yaml` 和 Node 内置的 `fs`。

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

seed/                             # 随仓库发布的种子模板（进 git）
```

`VAULT_PATH` 可把 vault 指到仓库外；默认 `./data`。首次启动时若 `data/` 不存在，
`ensureVaultInitialized()` 会把 `seed/` 整个复制过去（排除 `README.md`）。

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

购物清单是**算出来的**，不落盘：选中菜谱缺的料 + 缺的厨具 + low/out 的调料主食蛋奶
（+ 可选：日历上计划中的菜）。回填时才写库存。

---

## 6. B 层推荐引擎

> 二期由 LLM **增强而非替换**——规则引擎保留为基线，无 API key 时产品完全可用。
> 代码在 `src/lib/recommend/`。**本次本地化改造中这三个文件逻辑一行未改。**

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

---

## 7. vault 数据层 (`src/lib/vault/`)

| 文件 | 职责 |
|------|------|
| `paths.ts` | vault 根目录解析（`VAULT_PATH` / `./data`）、`isReadOnly()`、各文件路径 |
| `init.ts` | 首次启动把 `seed/` 复制成 `data/`；只读模式直接用 `seed/` |
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
├── docs/
│   ├── vault-format.md          ← ★ 数据文件格式规范
│   ├── vault-examples/          ← 规范的样例文件
│   └── recommend-algorithm.md
│
├── seed/                        ← ★ 随仓库发布的种子 vault（进 git）
│   ├── README.md                ←   种子怎么调、last_restocked_at 的坑
│   └── kitchen/
│       ├── recipes/{54 个菜谱目录}/recipe.md
│       ├── inventory/{5 个分类}.yaml
│       ├── utensils.yaml / aliases.yaml / config.yaml
│       └── calendar/2026-07.yaml
│
├── data/                        ← 运行时 vault（.gitignore，首次启动自动生成）
│
├── src/
│   ├── instrumentation-client.ts ← 水合前执行：antd × React 19 补丁（见 §8.1）
│   ├── app/
│   │   ├── layout.tsx           ← 根布局（AppLayout + ReadOnlyProvider）
│   │   ├── page.tsx             ← → /recommend
│   │   ├── recommend/ inventory/ utensils/ recipes/ recipes/new/ calendar/
│   │   ├── api/photo/route.ts   ← 照片读取（含越界防护）
│   │   └── actions/             ← Server Actions
│   │       └── inventory.ts / recipe.ts / utensil.ts / calendar.ts / recommend.ts
│   │
│   ├── components/
│   │   ├── layout/              ← AppLayout / ThemeProvider / AntdRegistry / ReadOnlyProvider
│   │   ├── views/               ← Recommend / Inventory / Utensils / Calendar 视图
│   │   ├── recommend/           ← HeroCard / AltCard / ShoppingPanel / FilterPopover / …
│   │   ├── recipes/             ← WaterfallCard
│   │   └── shared/              ← RecipeDetailModal / EmptyState / PageHeader / StatusDot / …
│   │
│   ├── lib/
│   │   ├── vault/               ← ★ 数据层（见 §7）+ __tests__/
│   │   ├── services/            ← ★ A 层纯函数
│   │   │   ├── inventory/ + __tests__/    recipe/ + __tests__/
│   │   │   ├── utensil/  calendar/        shopping/ + __tests__/
│   │   ├── recommend/           ← ★ B 层：config / tiering / scoring + __tests__/
│   │   ├── seed/__tests__/      ← 种子 vault 质量守门
│   │   ├── constants/text.ts
│   │   └── utils/               ← normalize-name / error / compress-image + __tests__/
│   │
│   ├── store/ / types/
│
└── scripts/parse-howtocook.ts   ← 从 HowToCook 仓库解析菜谱的参考工具
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

### 10.3 验证清单

```
本地:
  npm run build            # 编译无错误（含 TypeScript 全量检查）
  npx vitest run           # 97 tests 全绿
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
```

---

## 11. 测试

| 文件 | 覆盖 | 用例 |
|------|------|:--:|
| `recommend/__tests__/tiering.test.ts` | 硬分档规则 | 10 |
| `recommend/__tests__/scoring.test.ts` | 档内评分 | 8 |
| `vault/__tests__/read-only.test.ts` | 只读模式拒绝写入且不落盘 | 5 |
| `utils/__tests__/normalize-name.test.ts` | 归一化 + 别名 + 冲突检测 + 种子别名表质量 | 19 |
| `utils/__tests__/error.test.ts` | 错误分类 + Server Action 外壳 | 11 |
| `services/inventory/__tests__/` | 库存 CRUD、档位、回填（喂数组 + 真实落盘） | 17 |
| `services/shopping/__tests__/` | 购物清单生成 + 回填 | 9 |
| `services/recipe/__tests__/photo.test.ts` | 照片落盘 / 删除 / frontmatter 同步 | 4 |
| `seed/__tests__/seed-vault.test.ts` | 种子数据质量 + 首屏三档质量 | 11 |
| `utils/__tests__/antd-message.test.ts` | antd 静态 message 在 React 19 下真的挂进 DOM（jsdom） | 3 |
| **合计** | | **97** |

> `antd-message.test.ts` 是**唯一**跑在 jsdom 下的文件（靠文件头 `// @vitest-environment jsdom`，
> 全局仍是 node 环境）。它守的那个 bug 之所以能活下来，正是因为其余测试全是纯函数测试、碰不到 DOM。

运行: `npx vitest run`

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

档位不用 hash 生成——那样首屏推荐质量是碰运气的。调整规则与那个
`last_restocked_at` 的坑见 [seed/README.md](./seed/README.md)。

---

> **本文档与代码同步维护。架构变更见 [DESIGN.md](./DESIGN.md)，数据格式见 [docs/vault-format.md](./docs/vault-format.md)。**
