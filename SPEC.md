# Cook Helper — Specification

> **版本**: v1.0 | **更新**: 2026-07-23 | **状态**: 一期已上线  
> **定位**: 本文档包含完整的技术实现规格——Schema、路由、Service 签名、部署步骤。AI Agent 可据此复刻项目。设计理念见 [DESIGN.md](./DESIGN.md)。  
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
| @supabase/ssr | 0.12.0 | Supabase SSR 客户端 |
| @supabase/supabase-js | 2.110.8 | Supabase JS SDK |
| zustand | 5.0.14 | 客户端状态管理 |
| dayjs | 1.11.21 | 日期处理 |
| vitest | 4.1.9 | 单测框架 |
| @testing-library/react | 16.3.2 | React 组件测试 |
| @testing-library/dom | 10.4.1 | DOM 测试工具 |
| jsdom | 29.1.1 | 测试环境 DOM |
| tailwindcss | ^4 | 辅助样式 |
| tsx | 4.23.0 | TS 脚本执行器 |
| supabase (CLI) | 2.109.0 | 数据库迁移 |

---

## 2. 数据库设计

### 2.1 PostgreSQL 枚举类型

```sql
CREATE TYPE inventory_category  AS ENUM ('vegetable','meat','egg_dairy_bean','staple','seasoning');
CREATE TYPE stock_level         AS ENUM ('enough','low','out');
CREATE TYPE difficulty          AS ENUM ('easy','medium','hard');
CREATE TYPE ingredient_role     AS ENUM ('main','auxiliary','seasoning');
CREATE TYPE calendar_status     AS ENUM ('planned','completed');
```

### 2.2 inventory — 食材/调料库存

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK, gen_random_uuid() | |
| user_id | UUID | NOT NULL, FK→auth.users, ON DELETE CASCADE | |
| name | TEXT | NOT NULL | |
| category | inventory_category | NOT NULL | 5 分类 |
| total_amount | TEXT | NULL | "500ml"/"200g"/"一瓶" |
| stock_level | stock_level | NOT NULL, DEFAULT 'enough' | 三档制 |
| unit | TEXT | NULL | g/ml/个/袋 |
| last_restocked_at | TIMESTAMPTZ | NULL | stock_level→enough 时刷新 |
| note | TEXT | NULL | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

### 2.3 utensils — 厨具

| 列 | 类型 | 约束 |
|----|------|------|
| id | UUID | PK |
| user_id | UUID | NOT NULL, FK→auth.users, ON DELETE CASCADE |
| name | TEXT | NOT NULL |
| note | TEXT | NULL |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

### 2.4 recipes — 菜谱

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| user_id | UUID | NOT NULL, FK→auth.users, ON DELETE CASCADE | |
| name | TEXT | NOT NULL | 唯一必填字段 |
| steps | JSONB | NULL | `[{step_number:1, description:"切菜"}]` |
| cook_time_minutes | INT | NULL | |
| difficulty | difficulty | NULL | easy/medium/hard |
| attributes | JSONB | NOT NULL, DEFAULT '{}' | **GIN 索引**，8 维标签全存 |
| tips | TEXT | NULL | |
| created_at | TIMESTAMPTZ | DEFAULT now() | |
| updated_at | TIMESTAMPTZ | DEFAULT now() | |

**`attributes` jsonb 结构**:
```json
{
  "method":     ["炒","炖"],
  "spiciness":  "中辣",
  "greasiness": "适中",
  "flavor":     "咸鲜",
  "diet_type":  "荤素搭配",
  "nutrition":  ["高蛋白"],
  "scene":      ["工作日快手"],
  "cuisine":    "川"
}
```

### 2.5 recipe_ingredients — 菜谱-食材关联

| 列 | 类型 | 约束 |
|----|------|------|
| id | UUID | PK |
| recipe_id | UUID | NOT NULL, FK→recipes, ON DELETE CASCADE |
| inventory_id | UUID | NOT NULL, FK→inventory, ON DELETE CASCADE |
| role | ingredient_role | NOT NULL |
| amount | TEXT | NULL, e.g. "300g" |

### 2.6 recipe_utensils — 菜谱-厨具关联

| 列 | 类型 | 约束 |
|----|------|------|
| id | UUID | PK |
| recipe_id | UUID | NOT NULL, FK→recipes, ON DELETE CASCADE |
| utensil_name | TEXT | NOT NULL (按名称匹配用户 utensils 表) |

### 2.7 recipe_photos — 菜谱照片

| 列 | 类型 | 约束 |
|----|------|------|
| id | UUID | PK |
| recipe_id | UUID | NOT NULL, FK→recipes, ON DELETE CASCADE |
| storage_path | TEXT | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT now() |

### 2.8 calendar_entries — 烹饪记录/计划

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| id | UUID | PK | |
| user_id | UUID | NOT NULL, FK→auth.users, ON DELETE CASCADE | |
| date | DATE | NOT NULL | |
| recipe_id | UUID | NOT NULL, FK→recipes, ON DELETE CASCADE | |
| status | calendar_status | NOT NULL, DEFAULT 'planned' | |
| notes | TEXT | NULL | |
| created_at | TIMESTAMPTZ | DEFAULT now() | |
| updated_at | TIMESTAMPTZ | DEFAULT now() | |

### 2.9 calendar_photos — 成品照

| 列 | 类型 | 约束 |
|----|------|------|
| id | UUID | PK |
| calendar_entry_id | UUID | NOT NULL, FK→calendar_entries, ON DELETE CASCADE |
| storage_path | TEXT | NOT NULL |

### 2.10 索引

```sql
CREATE INDEX idx_inventory_user_id    ON inventory(user_id);
CREATE INDEX idx_inventory_category   ON inventory(user_id, category);
CREATE INDEX idx_recipes_user_id      ON recipes(user_id);
CREATE INDEX idx_recipes_attributes   ON recipes USING GIN (attributes);
CREATE INDEX idx_recipe_ingredients   ON recipe_ingredients(recipe_id);
CREATE INDEX idx_calendar_user_month  ON calendar_entries(user_id, date);
```

### 2.11 RLS（所有用户表）

```sql
-- 每个表启用 RLS，统一策略
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE utensils ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_utensils ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_access" ON inventory
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- (其他表同理)
```

### 2.12 Storage Buckets

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('recipe-photos', 'recipe-photos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('calendar-photos', 'calendar-photos', true);

CREATE POLICY "owner_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id IN ('recipe-photos','calendar-photos')
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

---

## 3. 路由设计

### 3.1 路由表

| 路由 | 文件 | 类型 | 认证 | 说明 |
|------|------|:----:|:----:|------|
| `/` | `page.tsx` | Server | 公开 | 根路由重定向（未登录→/demo, 已登录→/recommend） |
| `/demo` | `demo/page.tsx` | Client | 公开 | 5 Tab Demo 页（716行） |
| `/login` | `login/page.tsx` | Client | 公开 | 登录表单 |
| `/register` | `register/page.tsx` | Client | 公开 | 两步注册（143行） |
| `/recommend` | `(auth)/recommend/page.tsx` | Client | 🔒 | ★ 首页：推荐+购物清单 |
| `/inventory` | `(auth)/inventory/page.tsx` | Client | 🔒 | 食材管理 |
| `/utensils` | `(auth)/utensils/page.tsx` | Client | 🔒 | 厨具管理 |
| `/recipes` | `(auth)/recipes/page.tsx` | Client | 🔒 | 菜谱管理（1354行，待拆分） |
| `/calendar` | `(auth)/calendar/page.tsx` | Client | 🔒 | 烹饪日历 |
| `/chat` | ❌ 未建 | — | 🔒 | 二期 AI Mode 入口 |

### 3.2 路由守卫

```typescript
// src/middleware.ts
// 基于 @supabase/ssr createServerClient
// 刷新 session → 检查 (auth) 路由组 → 未登录 redirect /login
// /demo, /login, /register 公开
```

### 3.3 Auth Layout

```typescript
// src/app/(auth)/layout.tsx — Server Component
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect('/login');
return <AppLayout>{children}</AppLayout>;
```

---

## 4. Server Actions 接口

所有 `'use server'` 异步函数，供 Client Component 直接调用。

### 4.1 Auth (`src/app/actions/auth.ts`)

| 函数 | 入参 | 出参 | 说明 |
|------|------|------|------|
| `signUp` | `{email, password}` | `{data, error}` | 调 supabase.auth.signUp() → 发 OTP |
| `verifyOtp` | `{email, token}` | `{data, error}` | 调 supabase.auth.verifyOtp({type:'signup'}) → 成功→initUserFromSeed() |
| `signIn` | `{email, password}` | `{data, error}` | 调 supabase.auth.signInWithPassword() |
| `signOut` | — | void | 调 supabase.auth.signOut() → redirect('/login') |

### 4.2 Inventory (`src/app/actions/inventory.ts`)

| 函数 | 说明 |
|------|------|
| `listInventory(category?)` | 按分类查询（可选） |
| `addInventoryItem(data)` | 新增食材（name, category, total_amount?, unit?, note?） |
| `updateInventoryItem(id, data)` | 编辑食材 |
| `deleteInventoryItem(id)` | 删除食材 |
| `batchUpdateStockLevel(items[])` | 批量更新库存档位 |

### 4.3 Recipe (`src/app/actions/recipe.ts`)

| 函数 | 说明 |
|------|------|
| `listRecipes(filters?)` | 列表查询，支持 attributes jsonb 筛选 |
| `getRecipeDetail(recipeId)` | 详情（含关联食材/厨具/照片） |
| `createRecipe(data)` | 新建 + 关联表写入 |
| `updateRecipe(id, data)` | 编辑 |
| `deleteRecipe(id)` | 删除（CASCADE 关联） |
| `uploadRecipePhoto(recipeId, file)` | 上传到 Supabase Storage |
| `deleteRecipePhoto(photoId)` | 删除照片 |

### 4.4 Utensil (`src/app/actions/utensil.ts`)

| 函数 | 说明 |
|------|------|
| `listUtensils()` | |
| `addUtensil({name, note?})` | |
| `deleteUtensil(id)` | |

### 4.5 Calendar (`src/app/actions/calendar.ts`)

| 函数 | 说明 |
|------|------|
| `getCalendarEntries(month)` | 月视图查询 |
| `addCalendarEntry({date, recipe_id, status?, notes?})` | |
| `completeEntry(entryId, stockUpdates)` | 标记完成 + 更新库存 |
| `uploadCalendarPhoto(entryId, file)` | |

### 4.6 Recommend (`src/app/actions/recommend.ts`)

| 函数 | 说明 |
|------|------|
| `getRecommendations(filters?)` | 调 tiering + scoring → 三档推荐 |
| `generateShoppingList(recipeIds)` | 生成购物清单 |
| `checkoutShoppingList(checkedItems[])` | 清单回填 → 库存变 enough |

---

## 5. A 层 Service 纯函数

全部来自 `src/lib/services/`，形如 `fn(supabase, userId, args)`，同构可复用。

### Inventory Service

```
listInventory(supabase, userId, category?)          → {data: InventoryItem[], error}
addInventoryItem(supabase, userId, item)             → {data: InventoryItem, error}
updateInventoryItem(supabase, userId, id, updates)   → {data: InventoryItem, error}
deleteInventoryItem(supabase, userId, id)            → {error}
batchUpdateStockLevel(supabase, userId, items[])     → {error}
updateStockOnCook(supabase, userId, ids[], levels[]) → {error}
markRestocked(supabase, userId, id)                   → {error}
batchMarkRestocked(supabase, userId, ids[])           → {error}
```

### Recipe Service

```
listRecipes(supabase, userId, filters?)          → {data: Recipe[], error}
getRecipeDetail(supabase, userId, recipeId)       → {data: RecipeDetail, error}
createRecipe(supabase, userId, data)              → {data: Recipe, error}
updateRecipe(supabase, userId, id, data)          → {data: Recipe, error}
deleteRecipe(supabase, userId, id)                → {error}
uploadRecipePhoto(supabase, userId, recipeId, f)  → {data: RecipePhoto, error}
deleteRecipePhoto(supabase, userId, photoId)      → {error}
```

### Utensil Service

```
listUtensils(supabase, userId)     → {data: Utensil[], error}
addUtensil(supabase, userId, data) → {data: Utensil, error}
deleteUtensil(supabase, userId, id) → {error}
```

### Calendar Service

```
getCalendarEntries(supabase, userId, month)          → {data: CalendarEntry[], error}
addCalendarEntry(supabase, userId, data)              → {data: CalendarEntry, error}
completeEntry(supabase, userId, entryId, updates)     → {error}
uploadCalendarPhoto(supabase, userId, entryId, file)  → {data: CalendarPhoto, error}
```

### Shopping Service

```
generateShoppingList(supabase, userId, recipeIds[], includePlanned?)
  → {data: ShoppingListItem[], error}
  // 内部: 获取库存→筛缺食材→查厨具→自动加 low/out 调料主食→可选计划菜

checkoutShoppingList(supabase, userId, checkedItems[])
  → {error}
  // 内部: 遍历 checkedItems → batchMarkRestocked()
```

### Seed Service

```
initUserFromSeed(serviceRoleSupabase, userId)
  → {success, error?}
  // 步骤:
  //   1. 复制种子 inventory (215种) → 新 id，hash 混合档位
  //   2. 复制种子 recipes (54道) → 新 id
  //   3. 复制 recipe_utensils
  //   4. 复制 recipe_ingredients + 外键重映射
  // 注意: 使用 service_role client 绕过 RLS
```

---

## 6. B 层推荐引擎

> ⚠️ 二期整体删除，换 LLM。代码在 `src/lib/recommend/`。

### 配置常量 (`config.ts`)

```typescript
// 清库存阈值: enough 超过 N 天 → clear_stock 档
STOCK_EXPIRY_DAYS = { vegetable: 3, meat: 7, egg_dairy_bean: 5 }
// staple, seasoning → Infinity (不提醒)

// 评分权重
SCORING_WEIGHTS = { novelty: 0.4, clearStock: 0.3, timeMatch: 0.15, nutrition: 0.15 }
TOP_N_PER_TIER = 5
```

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

## 7. Supabase Client 配置

| 文件 (`src/lib/supabase/`) | 类型 | 用途 |
|---------------------------|------|------|
| `browser.ts` | `createBrowserClient()` | Client Component |
| `server.ts` | `createServerClient()` | Server Component / Server Action |
| `middleware.ts` | `createServerClient()` | Middleware 路由守卫 |
| `service-role.ts` | `createClient(service_role_key)` | 绕过 RLS（仅种子初始化） |

---

## 8. 状态管理

| Store (`src/store/`) | 用途 | 持久化 |
|---------------------|------|:------:|
| `theme-store.ts` | Light/Dark 主题 | localStorage |
| `ui-store.ts` | 侧边栏折叠等 UI 状态 | 否 |

> Zustand 仅管 UI 状态，不做服务端数据缓存。

---

## 9. 项目文件树

```
cook-helper/
├── DESIGN.md                    ← 高层设计
├── SPEC.md                      ← 本文档
├── PRD_v2.md                    ← 产品需求（参考）
├── .env.local                   ← 环境变量（不提交 git）
├── package.json
├── tsconfig.json / next.config.ts / vitest.config.ts
│
├── supabase/
│   └── migrations/
│       └── 20260705000000_initial_schema.sql
│
├── src/
│   ├── app/
│   │   ├── layout.tsx           ← 根布局 (ThemeProvider)
│   │   ├── page.tsx             ← 根路由重定向
│   │   ├── (auth)/
│   │   │   ├── layout.tsx       ← 路由守卫 + AppLayout
│   │   │   ├── recommend/page.tsx
│   │   │   ├── inventory/page.tsx
│   │   │   ├── utensils/page.tsx
│   │   │   ├── recipes/page.tsx
│   │   │   └── calendar/page.tsx
│   │   ├── demo/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx          ← 5 Tab Demo (716行)
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx     ← 8位 OTP (143行)
│   │   └── actions/              ← Server Actions
│   │       ├── auth.ts / inventory.ts / recipe.ts
│   │       ├── utensil.ts / calendar.ts / recommend.ts
│   │
│   ├── components/
│   │   ├── layout/               ← AppLayout, ThemeProvider, AntdRegistry
│   │   └── shared/               ← 复用组件
│   │
│   ├── lib/
│   │   ├── supabase/             ← browser / server / middleware / service-role
│   │   ├── services/             ← ★ A 层纯函数
│   │   │   ├── inventory/ + __tests__/
│   │   │   ├── recipe/ / utensil/ / calendar/
│   │   │   ├── shopping/ + __tests__/
│   │   │   └── seed/initUser.ts + __tests__/
│   │   ├── recommend/            ← ★ B 层 (二期删)
│   │   │   ├── config.ts / tiering.ts / scoring.ts / index.ts
│   │   │   └── __tests__/
│   │   ├── seed/
│   │   │   ├── seed-data.ts      ← 54菜 + 215食材
│   │   │   └── fixtures.ts       ← Demo用 12菜
│   │   ├── constants/text.ts     ← 文案集中
│   │   └── utils/
│   │
│   ├── hooks/ / store/ / types/
│   └── middleware.ts
│
├── scripts/parse-howtocook.ts
└── docs/recommend-algorithm.md
```

---

## 10. 部署流程

### 10.1 环境变量

```
NEXT_PUBLIC_SUPABASE_URL          = https://<project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY     = eyJh... (公开)
SUPABASE_SERVICE_ROLE_KEY         = eyJh... (仅服务端，保密)
```

### 10.2 前置准备（一次性人工）

| # | 平台 | 操作 |
|---|------|------|
| 1 | Supabase | 注册 → 新建项目 → 获取 3 个 key |
| 2 | Resend | 注册 → API Key → 验证域名 wreathmoon.com（DNS TXT/MX） |
| 3 | Supabase Auth | Settings → SMTP → 填 Resend 参数: smtp.resend.com:465, user:smtp, pass:API Key |
| 4 | Supabase Auth | Templates → OTP 模板改为 6/8 位数字 |
| 5 | Supabase Auth | 启用 email confirmations |
| 6 | GitHub | 创建仓库 Wreathmoon/cook-helper → push |

### 10.3 数据库初始化

```bash
supabase login
supabase link --project-ref <ref-id>
supabase db push
```

### 10.4 Vercel 部署

```bash
# 1. vercel.com → Import GitHub repo
# 2. 填入 3 个环境变量
# 3. Framework: Next.js, Root: /
# 4. Deploy → 访问 https://<project>.vercel.app
# 5. Domains → 绑定 cook.wreathmoon.com → DNS CNAME → cname.vercel-dns.com
```

### 10.5 验证清单

```
本地:
  npm run build     # 编译无错误
  npm run test      # 39 tests 全绿

线上:
  1. https://cook.wreathmoon.com → 重定向 /demo
  2. /demo → 5 Tab 可用，写入禁用
  3. /register → 收 OTP → /recommend 有 50+ 菜
  4. /inventory → CRUD + 批量更新
  5. /recipes → 标签筛选 + 照片
  6. /recommend → 改库存→推荐变→购物清单→回填
  7. /calendar → 记录/规划/做完更新
  8. 主题切换
```

---

## 11. 测试

| 文件 | 覆盖 | 用例 |
|------|------|:--:|
| `services/inventory/__tests__/` | 库存 CRUD、档位更新、回填 | ~10 |
| `services/seed/__tests__/` | 种子复制 + 外键重映射 | ~8 |
| `services/shopping/__tests__/` | 购物清单生成 + 回填 | ~8 |
| `recommend/__tests__/tiering.test.ts` | 硬分档规则 | ~7 |
| `recommend/__tests__/scoring.test.ts` | 档内评分 | ~6 |
| **合计** | | **39** |

运行: `npx vitest run`

---

## 12. 种子数据

| 数据集 | 数量 | 用途 |
|--------|:---:|------|
| 种子菜谱 | 54 | 注册自动复制 |
| 种子食材 | 215 | 注册自动复制 |
| Demo 菜谱 | 12 | `/demo` 展示 |
| Demo 食材 | 20 | `/demo` 展示（含 enough/low/out 混合） |
| Demo 厨具 | 5 | `/demo` 展示 |
| Demo 日历 | 5 | `/demo` 展示 (2 completed + 3 planned) |

---

> **本文档与代码同步维护。架构变更见 [DESIGN.md](./DESIGN.md)。**
