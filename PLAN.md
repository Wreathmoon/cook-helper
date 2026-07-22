# Cook Helper 一期 MVP 实施计划

## Context

基于 PRD.md 从零搭建厨房管理应用。工作区当前为空（仅有 PRD.md），需完成项目初始化、数据库设计、认证系统、全部业务模块、种子数据、Demo 页和部署。用户尚未准备 Supabase/Resend/Vercel 账号，计划中需包含前置操作指引。

---

## 前置：人工操作指引（交付给用户执行）

在编码开始前，用户需完成以下操作（PRD §0.3）：

1. **Supabase**：supabase.com 注册 → 新建免费项目 → 获取 `Project URL`、`anon key`、`service_role key`
2. **Resend**：resend.com 注册 → 获取 `API key` → 验证域名 `wreathmoon.com`（DNS 记录）→ 在 Supabase Auth SMTP Settings 填 Resend SMTP 信息 → 启用邮箱确认/OTP
3. **Vercel**：导入 git 仓库 → Environment Variables 填入 Supabase keys → Domains 绑定 `cook.wreathmoon.com`
4. **本地 `.env.local`**：填入 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`

> 此步骤在 Task 1 完成后交付给用户，后续 Task 可先用占位 env 继续开发。

---

## Task 1：项目初始化与基础架构

**目标**：搭建 Next.js 项目骨架，配齐所有基础设施依赖。

**具体工作**：
- `npx create-next-app@latest` 初始化（App Router、TypeScript、ESLint、src/ 目录）
- 安装核心依赖：`antd`、`@ant-design/icons`、`@ant-design/pro-components`、`@supabase/ssr`、`zustand`、`dayjs`
- 安装开发依赖：`vitest`、`@testing-library/react`、`tsx`
- 创建项目目录结构（按 PRD §7）：
  ```
  src/app/(auth)/recommend|inventory|utensils|recipes|calendar/
  src/app/demo/ login/ register/ actions/
  src/components/layout/ shared/
  src/lib/supabase/ services/ recommend/ seed/ constants/ utils/
  src/hooks/ store/ types/
  ```
- 配置 `src/lib/supabase/` — server client + browser client（`@supabase/ssr` 标准模式）
- 配置 Ant Design `ConfigProvider` + light/dark 主题切换 + localStorage 持久化
- 创建 `src/lib/constants/text.ts` 文案集中骨架
- 配置 Zustand store（仅 UI 状态：主题、侧边栏折叠等）
- 配置 Vitest（`vitest.config.ts`）
- 创建全局 `layout.tsx`：左侧导航 + 顶部栏（主题切换按钮）
- TypeScript 类型定义（`src/types/`）：所有表的 TS 接口

**产出**：可 `npm run dev` 启动的空壳应用，带导航布局和主题切换。

---

## Task 2：数据库 Schema 与迁移

**目标**：创建所有数据库表的迁移文件，配 RLS 和 Storage。

**依赖**：Task 1（需要 Supabase client 配置）

**具体工作**：
- 编写 SQL 迁移文件（`supabase/migrations/`），包含：
  - `inventory` 表（含 category enum、stock_level enum、last_restocked_at）
  - `utensils` 表
  - `recipes` 表（含 attributes jsonb、steps jsonb）
  - `recipe_ingredients` 关联表（role enum: main/auxiliary/seasoning）
  - `recipe_utensils` 关联表（按 utensil_name 匹配）
  - `recipe_photos` 表
  - `calendar_entries` 表（status enum: planned/completed）
  - `calendar_photos` 表
- 所有表启用 RLS，policy: `user_id = auth.uid()`
- 创建 Storage buckets：`recipe-photos`、`calendar-photos`，配 Storage RLS
- `recipes.attributes` 加 GIN 索引
- 种子数据 SQL（`supabase/seed.sql`）：基础种子 inventory + recipes

**产出**：`supabase db push` 可执行的迁移文件。

---

## Task 3：认证系统

**目标**：实现邮箱+密码注册（6位数字 OTP 验证）、登录、登出、路由守卫。

**依赖**：Task 1、Task 2

**具体工作**：
- **Server Actions**（`src/app/actions/auth.ts`）：
  - `signUp(email, password)` → Supabase Auth 注册 + 发送 OTP
  - `verifyOtp(email, token)` → 验证 6 位验证码
  - `signIn(email, password)` / `signOut()`
- **注册页**（`/register`）：邮箱+密码表单 → 发送验证码 → 6 位数字输入（Ant Design Input.OTP）→ 验证成功
- **登录页**（`/login`）：邮箱+密码表单
- **Middleware**（`src/middleware.ts`）：
  - `(auth)` 路由组保护：未登录 → 重定向 `/login`
  - `/demo`、`/login`、`/register` 公开
- **注册后初始化**：注册成功 → 调用种子复制 service（Task 7）→ 跳转 `/recommend`
- 自定义 Supabase Auth 邮件模板（6 位数字验证码格式）

**产出**：完整的注册→验证→登录→跳转闭环。

---

## Task 4：A 层核心 Services（纯函数）

**目标**：实现所有业务逻辑的纯函数 service 层，供 UI 和二期 Agent 共用。

**依赖**：Task 1、Task 2

**具体工作**（全部在 `src/lib/services/` 下）：

- **inventory service**：
  - `listInventory(supabase, userId, category?)` — 按分类查询
  - `addInventoryItem(supabase, userId, data)` — 新增食材
  - `updateInventoryItem(supabase, userId, id, data)` — 编辑
  - `deleteInventoryItem(supabase, userId, id)` — 删除
  - `batchUpdateStockLevel(supabase, userId, items[])` — 批量更新库存档位
  - `updateStockOnCook(supabase, userId, ingredientIds[], levels[])` — 做完菜更新档位
  - `markRestocked(supabase, userId, id)` — 标记为 enough 并刷新 last_restocked_at（购物清单回填）

- **utensil service**：
  - `listUtensils(supabase, userId)` / `addUtensil(...)` / `deleteUtensil(...)`

- **recipe service**：
  - `listRecipes(supabase, userId, filters?)` — 支持 jsonb 标签筛选
  - `getRecipeDetail(supabase, userId, recipeId)` — 含关联食材/厨具
  - `createRecipe(supabase, userId, data)` — 含关联写入
  - `updateRecipe(...)` / `deleteRecipe(...)`
  - `uploadRecipePhoto(supabase, userId, recipeId, file)` — Storage 上传
  - `deleteRecipePhoto(...)`

- **calendar service**：
  - `getCalendarEntries(supabase, userId, month)` — 月视图查询
  - `addCalendarEntry(supabase, userId, data)` — 记录/规划
  - `completeEntry(supabase, userId, entryId)` — 标记完成
  - `uploadCalendarPhoto(...)`

- **shopping service**：
  - `generateShoppingList(supabase, userId, selectedRecipeIds[])` — 生成购物清单
  - `checkoutShoppingList(supabase, userId, checkedItems[])` — 勾选回填库存

**产出**：完整的 A 层 service 函数，同构纯函数签名。

---

## Task 5：食材/调料 + 厨具管理 UI

**目标**：实现 `/inventory` 和 `/utensils` 页面。

**依赖**：Task 4

**具体工作**：
- **`/inventory` 页面**：
  - 按分类 Tab 切换（蔬菜/肉类/蛋奶豆制品/主食干货/调料）
  - 搜索、添加（Modal 表单）、编辑、删除
  - "更新库存"批量操作按钮（弹窗逐个调档位）
  - Server Actions 调用 inventory service
- **`/utensils` 页面**：
  - 列表 + 搜索 + 添加 + 删除
  - 极简表单（名称 + 备注）

**产出**：两个完整 CRUD 页面。

---

## Task 6：菜谱管理 UI

**目标**：实现 `/recipes` 页面，含关联、标签、图片上传。

**依赖**：Task 4、Task 5（需要 inventory/utensils 数据做关联选择）

**具体工作**：
- **菜谱列表**：卡片/列表视图切换，按标签筛选（jsonb），搜索
- **新增/编辑菜谱**（Modal 表单）：
  - 菜名（必填）、主要食材（关联 inventory + 用量）、辅助食材、调料、厨具
  - 烹饪步骤（有序列表）、时间、难度
  - 多维标签：烹饪方式、辣度、油腻度、咸鲜甜、荤素、营养、场景、菜系
  - 照片上传/预览/删除（Supabase Storage）
- **菜谱详情页**：
  - 完整信息展示
  - 食材状态检查（绿/黄/红对应 enough/low/out）
  - 照片展示

**产出**：完整的菜谱管理页面。

---

## Task 7：种子数据与配套复制

**目标**：HowToCook 解析、种子数据生成、新用户注册自动复制。

**依赖**：Task 2、Task 4

**具体工作**：
- **HowToCook 解析脚本**（`scripts/parse-howtocook.ts`）：
  - Clone HowToCook 仓库
  - 结构化直取：菜名、食材、步骤、难度、时间
  - 规则推断标签：荤素（看有无肉类）、烹饪方式（关键词）、辣度（辣椒/花椒）
  - 留空：油腻度/营养/场景/菜系
  - 精选 50-80 道（荤/素/汤/主食各挑一二十）
  - 输出种子数据到 `supabase/seed/`
- **Demo fixture**（`src/lib/seed/fixtures.ts`）：从种子中抽取小份做纯前端静态数据
- **种子复制 service**（`src/lib/services/seed/initUser.ts`）：
  - 复制种子 inventory → 新 id
  - 初始档位混合：调料/主食 `enough`，蔬菜肉类部分 `enough`/部分 `low`/`out`
  - 复制 recipes + recipe_utensils
  - 复制 recipe_ingredients 时重映射 inventory_id（旧种子 id → 新 id）
  - 用 `service_role` 执行
- 集成到注册流程（Task 3 注册成功后调用）

**产出**：种子数据 + 注册自动初始化 + Demo fixture。

---

## Task 8：日历 UI

**目标**：实现 `/calendar` 页面。

**依赖**：Task 4、Task 6（需要菜谱选择器）

**具体工作**：
- 月视图日历（Ant Design Calendar 组件）
- 每天格子显示做了/计划做的菜名
- 点击日期展开详情
- 新增记录：选日期 + 选菜谱 + 可选照片
- 提前规划：未来日期标记"计划做 XX"
- **「我做完了」按钮**：
  - 弹窗列出该菜谱主要食材
  - 用户逐个调三档档位
  - 确认 → 调用 inventory service 更新
- 成品照上传（Supabase Storage）

**产出**：完整的日历页面。

---

## Task 9：推荐引擎（B 层）+ 购物清单

**目标**：实现两层推荐算法 + 购物清单 + `/recommend` 页面。

**依赖**：Task 4、Task 5、Task 6

**具体工作**：
- **推荐配置**（`src/lib/recommend/config.ts`）：权重、清库存阈值
- **第一层硬分档**（`src/lib/recommend/tiering.ts`）：
  - 遍历菜谱，检查食材/厨具状态
  - 分为"现在就能做"/"需额外购买"/"清库存推荐"三档
  - 清库存阈值按分类（蔬菜>3天、肉类>7天、蛋奶>5天）
- **第二层档内评分**（`src/lib/recommend/scoring.ts`）：
  - 不重样（日历查上次做该菜天数）
  - 清库存（含久放 enough 食材数量）
  - 耗时匹配（用户筛选时）
  - 营养搭配（近 3 天荤素平衡）
  - 缺失维度优雅降级
  - 每档 Top 3-5
- **临时硬过滤**：时间/辣度/荤素等筛选器
- **设计文档**（`docs/recommend-algorithm.md`）
- **`/recommend` 页面**：
  - 推荐卡片（标注档位）
  - 筛选器
  - 勾选菜品 → 弹出购物清单
  - 购物清单：缺的食材 + low/out 的调料/主食 + 计划菜的缺失
  - 清单勾选回填 → 调 shopping service → 库存变 enough

**产出**：完整的推荐 + 购物清单闭环。

---

## Task 10：Demo 页面

**目标**：实现 `/demo` 纯前端静态交互页。

**依赖**：Task 7（fixture 数据）、Task 9（推荐逻辑复用）

**具体工作**：
- 使用 `src/lib/seed/fixtures.ts` 静态数据
- 复用推荐/筛选纯函数，数据源换为 fixture
- 所有增删改按钮禁用（或提示"Demo 模式不可写"）
- 不碰数据库、不走 RLS、不连 Supabase
- 布局与登录后一致（左侧导航 + 顶部栏）

**产出**：未登录用户可体验的交互 Demo。

---

## Task 11：Vitest 单测

**目标**：为 A 层核心纯函数编写单测。

**依赖**：Task 4、Task 7、Task 9

**具体工作**（PRD §11 指定范围）：
- 推荐分档规则测试
- 档内评分测试
- 种子复制 + 外键重映射测试
- 库存档位更新测试
- 购物清单回填测试

**产出**：`npx vitest run` 全绿。

---

## Task 12：部署上线

**目标**：部署到 Vercel + 绑定域名。

**依赖**：Task 1-11 全部完成，用户完成前置账号准备

**具体工作**：
- Supabase `db push` 推送迁移
- Vercel 导入仓库 + 配置环境变量
- 绑定 `cook.wreathmoon.com`（DNS CNAME）
- 端到端验证（PRD §10 关键路径）

---

## 执行顺序与并行策略

```
Task 1 (初始化)
  ├── Task 2 (DB Schema) ──────────────────────────┐
  │     ├── Task 3 (认证) ──┐                       │
  │     └── Task 4 (Services)──┤                    │
  │           ├── Task 5 (库存+厨具 UI)              │
  │           │     └── Task 6 (菜谱 UI)             │
  │           ├── Task 7 (种子数据) ────┐            │
  │           └── Task 8 (日历 UI)     │            │
  │                 └── Task 9 (推荐+购物) ←─────────┘
  │                       └── Task 10 (Demo)
  │                             └── Task 11 (测试)
  └── Task 12 (部署) ← 全部完成后
```

可并行的组：
- Task 3 与 Task 4 可并行（认证与 services 独立）
- Task 5 与 Task 7 可并行
- Task 6 与 Task 8 可并行

---

## 验证方式

- 每个 Task 完成后 `npm run dev` 本地验证
- Task 3：注册→OTP→登录→种子复制→跳转 /recommend
- Task 5/6/8：CRUD 操作 + Supabase Dashboard 核对数据
- Task 9：改库存→推荐变化→勾菜→购物清单→回填→推荐再变
- Task 10：登出访问 /demo，除写入外功能齐全
- Task 11：`npx vitest run` 全绿
- Task 12：`cook.wreathmoon.com` 走一遍关键路径
