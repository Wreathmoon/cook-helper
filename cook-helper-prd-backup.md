# Cook Helper - Product Requirements Document (PRD)

> **版本说明**：本 PRD 已于 **2026-07-05** 经一轮需求澄清（grilling）更新，**一期 MVP 的实施以本文件为唯一依据**。文中标注「一期」的即为当前要落地的范围；「二期/三期」为预留，不在本次实施内，但架构上必须留好接口（见 §0.2 架构分层）。执行者可直接照本文档从零搭建。

---

## 0. 一期实施须知（先读这一节）

### 0.1 一期决策总账（相对早期 PRD 的确认/修订）

| # | 议题 | 一期定论 |
|---|------|----------|
| 1 | 范围 | 只做**一期 MVP**（纯传统 Web 版），架构预留二/三期接口 |
| 2 | 认证 | **一期即多用户**，放弃"自用"定位 |
| 3 | 邮箱验证 | 一期就把 **OTP 跑通**：Supabase Auth 邮箱+密码 + **6 位数字验证码** |
| 4 | 邮件服务 | **Resend** 作 SMTP（Supabase 内置邮件仅测试、有硬限流，不可用于生产） |
| 5 | 种子菜谱 | HowToCook **结构化直取 + 规则推断标签 + 留空降级 + 精选子集（约 50–80 道）**；二期再用 AI 重新导入补全 |
| 6 | 推荐算法 | **两层**：①硬分档 ②档内线性加权。一期**轻量实现**，二期整体删掉换 LLM 决策 |
| 7 | 清库存阈值 | **按分类**：蔬菜 >3 天、肉类 >7 天、蛋奶豆 >5 天；主食/干货、调料**不提醒** |
| 8 | LLM | 一期**完全不碰**（无依赖、无 key、无 `/chat` 路由） |
| 9 | Demo 页 | **纯前端静态 fixture**，不碰数据库、不走 RLS，写操作禁用 |
| 10 | 国际化 | **一期不做 i18n、全中文**；但**文案集中到 `src/lib/constants/text.ts`**，二期加英文只改这一处 |
| 11 | 主题 | 一期做 light/dark 切换（antd `darkAlgorithm` + localStorage） |
| 12 | 图片 | **一期即做**菜谱照片 + 日历成品照（Supabase Storage） |
| 13 | 数据层 | `@supabase/ssr` + **service 纯函数** + **Server Actions** + Zustand 只管 UI 状态 |
| 14 | 种子数据模型 | **食材 + 菜谱配套复制、复制时重映射外键**；初始档位混合（调料/主食 `enough`，蔬菜肉类部分 `enough`、部分 `low/out`） |
| 15 | 测试 | **A 层核心纯函数写 Vitest 单测**；UI 不测、无 E2E |
| 16 | 部署 | Supabase 云端项目 + Vercel + Resend；域名 **`cook.wreathmoon.com`**（子域名） |
| 17 | Dashboard | 不做；登录后首页 = `/recommend`；移除 react-grid-layout / dashboard_layout |

### 0.2 架构分层与二期预留（贯穿全程的第一原则）

一期代码分两类，二期命运不同，**架构力气花在 A 层**：

- **A 层 · 数据/执行 service（做扎实，二期直接复用不重写）**
  增删改食材/菜谱/厨具、库存档位更新、种子复制、购物清单回填等"执行动作"。
  - 全部写成 `src/lib/services/**` 下的**同构纯函数**，签名形如 `updateStockLevel(supabase, userId, args)`——接收 supabase client 作参数，不依赖浏览器全局，可在服务端运行。
  - UI 的写操作通过 **Next.js Server Actions** 调用这些函数；二期 AI Agent（必然跑在服务端，因为要拿 LLM key）也调**同一批**函数，只是换成 LLM 决定调哪个、传什么参数。

- **B 层 · 推荐"决策"逻辑（一期轻量，二期换 LLM）**
  两层评分/排序。一期用纯 TS 规则实现、够用即可，**代码里显式标注 `// 二期将由 LLM 决策取代`**，二期整块删除。

- **其它预留**：文案集中（`text.ts`）、数据库标签走 `attributes` jsonb 零迁移加维度、`/chat` 路由一期不建。

> **一句话原则**：一期业务逻辑**不要写死在 React 组件里**，一律下沉到 `src/lib` 层的纯函数/service，供 UI 与未来 Agent 同时调用。

### 0.3 人工前置清单（需项目所有者本人操作，代码执行前完成）

执行者应把每一步展开成"去哪个网站→点哪个按钮→复制哪串值→粘到哪"的傻瓜指引后交付给所有者。骨架如下：

1. **Supabase**：supabase.com 注册 → 新建免费项目 → 拿到 3 个值：`Project URL`、`anon key`（公开）、`service_role key`（保密，仅服务端用）。
2. **Resend**：resend.com 注册 → 拿 `API key` → 在 Resend 验证域名 `wreathmoon.com`（加 DNS 记录）→ 在 **Supabase 后台 Auth → SMTP Settings** 填 Resend 的 SMTP 信息 → 在 Auth 里启用邮箱确认 / OTP。
3. **Vercel**（所有者已建好）：导入本 git 仓库；Project Settings → Environment Variables 填入下方 env；Domains 绑定 `cook.wreathmoon.com`（按提示在 DNS 加一条 CNAME）。
4. **`.env.local`**（本地，不进 git）：
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...        # 仅服务端用（种子复制等）
   ```
   上线时同样几串 key 复制到 Vercel 环境变量。

---

## Context

厨房管理应用，解决"家里有什么食材、能做什么菜、该买什么"的日常决策问题。部署在互联网上，未登录用户看到带数据的交互 Demo（除写入外功能齐全）。

### 产品定位

- **厨房管理工具，自带 LLM API Key（BYOK）**：一期即以**多用户**形态上线（自助注册）。未来若规模扩大，可能放弃 Vercel、换更适合多用户的部署方式。
- 本质是**对 AI 时代趋势下、传统软件的一次大胆挑战与创新**：创新点在于**把大语言模型的"对话"作为传统 Web 应用 UI/UX 交互的新形态**。
- **AI-native 的体现**：产品的方方面面，都基于人与产品通过**自然表达对话**来完成——不是给传统界面外挂一个对话框，而是让对话成为操作产品的第一方式（二期落地）。

### 三阶段路线（详见 §9）

1. **一期 MVP**：纯传统 Web 版，所有功能手动可调。**← 本 PRD 的实施范围**
2. **二期 AI mode**：同一 Web 应用内，入口处选 Web mode / AI mode；AI mode 是一个对话框，底层是 Agent + 工具调用，**复用一期全部 A 层业务逻辑**，并**用 LLM 决策取代一期 B 层推荐**。
3. **三期 完善 + 语音**：AI mode 加语音输入，用户自带豆包流式语音 API key。

---

## 1. 技术栈

| 层 | 选型 | 一期说明 |
|---|------|---------|
| 前端框架 | Next.js (App Router) | |
| UI 组件库 | Ant Design 5 + ProComponents (`@ant-design/pro-components`) + `@ant-design/icons` | |
| 语言 | TypeScript | |
| 数据库 | Supabase (PostgreSQL) 云端托管项目 | 迁移用 supabase CLI |
| 认证 | Supabase Auth（邮箱/密码 + **6 位数字邮箱验证码 OTP**） | 多用户自助注册 |
| 邮件服务 | **Resend**（作为 Supabase Auth 的自定义 SMTP） | 发注册验证码 |
| 文件存储 | Supabase Storage（菜谱照片、日历成品照） | 一期即做 |
| 国际化 | **一期不做**；全中文，文案集中在 `src/lib/constants/text.ts` | next-intl 留待二期 |
| 状态管理 | Zustand（**仅 UI 客户端状态**，不做服务端数据缓存） | |
| 数据访问 | `@supabase/ssr`（server/browser client）+ Server Actions | 见 §0.2、§4 |
| 测试 | Vitest（仅 A 层核心纯函数） | 见 §11 |
| 种子脚本 | 一次性 Node 脚本（用 `tsx` 跑）解析 HowToCook markdown | |
| 部署 | Vercel（Git 推送自动构建），域名 `cook.wreathmoon.com` | |
| 本地开发 | `npm run dev`（热更新） | |

> **一期移除**：`next-intl`（i18n 二期做）、`react-grid-layout`（不做 Dashboard）。

---

## 2. 页面结构

```
/ (根路由)
├── /demo          — 未登录用户看到的交互Demo（纯前端 fixture，除写入外功能齐全）
├── /login         — 登录页
├── /register      — 注册页（邮箱 6 位数字验证码）
├── /recommend     — 智能推荐 + 购物清单（登录后首页）
├── /inventory     — 食材/调料管理
├── /utensils      — 厨具管理
├── /recipes       — 菜谱管理
├── /calendar      — 日历记录与规划
└── /chat          — AI mode 对话界面（二期，一期不建）
```

全局布局：左侧导航栏 + 顶部栏（右上角一期只有：亮色/暗色模式切换；语言切换按钮二期随 i18n 一起加）。

**登录后首页 = `/recommend`**（不做 Dashboard，详见 §3.5 末尾）。

**Web mode / AI mode 切换（二期引入）**：两套界面共享同一套数据库与 A 层业务逻辑。一期只有 Web mode；`/chat` 在二期落地。

---

## 3. 功能模块详细需求

### 3.1 认证与访问控制

- **多用户系统**：支持**自助注册**，注册需**邮箱 6 位数字验证码（OTP）**验证。每个用户数据互相隔离。
  - 流程：注册页填邮箱+密码 → 发送 6 位数字验证码（经 Resend）→ 用户在页面输入验证码 → 验证通过后账号可用并登录。
  - 使用 Ant Design 的验证码输入组件承载 6 位数字输入体验。
- **注册后初始化**：新用户注册成功即**复制一份种子数据（配套食材 + HowToCook 菜谱）到其账号**，避免空库导致推荐为空（见 §4 种子数据、§4 种子配套复制）。
- **未登录访客**：访问 `/demo`，看到**纯前端静态 fixture** 预填的交互界面——**除了不能写入（增删改禁用），其余功能权限齐全**（可浏览、可体验推荐与筛选交互）。Demo **不碰数据库、不走 RLS**。
- **登录后**：进入 `/recommend`（首页），拥有完整读写权限。
- **路由守卫**：用 `@supabase/ssr` 的 middleware 校验登录态——未登录访问 `(auth)` 路由组 → 重定向 `/login`；`/demo`、`/login`、`/register` 公开。
- **安全**：Supabase Row Level Security (RLS) 确保数据库层面权限隔离，policy `user_id = auth.uid()`。

### 3.2 食材/调料管理 (`/inventory`)

> 厨具不在此管理，已拆为独立的 §3.2b。

#### 分类体系（固定5类，互不重叠）

| 分类 | 举例 |
|------|------|
| 蔬菜 | 白菜、土豆、西红柿、黄瓜、菠菜 |
| 肉类 | 猪肉、牛肉、鸡肉、鱼、虾、排骨 |
| 蛋奶豆制品 | 鸡蛋、牛奶、豆腐、腐竹 |
| 主食/干货 | 面条、米、粉丝、面粉 |
| 调料 | 盐、生抽、老抽、蚝油、豆瓣酱、花椒、葱姜蒜、油 |

#### 食材/调料字段

| 字段 | 类型 | 说明 |
|------|------|------|
| 名称 | string | 必填 |
| 分类 | enum | 5类之一 |
| 总量 | string | "500ml"/"200g"/"一瓶"，可选 |
| 库存档位 | enum | **三档制**：充足 / 不多了 / 完全没了（`enough` / `low` / `out`） |
| 单位 | string | g / ml / 个 / 袋 等，可选 |

> **为何用三档制**：原"剩余比例 1/3、1/4"逼用户和 AI 估算精确分数，维护成本高、数据假。三档制人和 AI 都好表达，贴近真实使用，是 AI mode 能成立的数据地基。

#### 页面功能
- 按分类 Tab 切换查看；支持搜索、添加、编辑、删除（均经 `lib/services/inventory` + Server Actions）。
- "更新库存"按钮：批量修改库存档位（采购回来后快速更新）。
- **不在本页做库存不足提醒**：库存不足统一体现在购物清单（见 §3.5）。
- **不做保质期/临期提醒**：三档制无日期维度；蔬菜肉类靠 `out` 提醒补货。

### 3.2b 厨具管理 (`/utensils`)

厨具不是消耗品，本质是"你有没有这件家什"——拥有 = 它在你的厨具列表里。字段极简：

| 字段 | 类型 | 说明 |
|------|------|------|
| 名称 | string | 必填，如 炒锅、蒸锅、烤箱、空气炸锅 |
| 备注 | string | 可选，如"26cm不粘锅" |

#### 页面功能
- 列表查看、搜索、添加、删除。
- 菜谱的"所需厨具"按名称关联；推荐时，菜谱需要而你没有的厨具，会把这道菜归到"需额外购买"档（见 §3.5）。

### 3.3 菜谱管理 (`/recipes`)

#### 菜谱字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 菜名 | string | 是 | |
| 主要食材 | 关联+用量 | 是 | 关联 inventory 表，主食材需填写用量(如"牛肉300g") |
| 辅助食材 | 关联 | 否 | 关联 inventory 表，不强制填用量 |
| 所需调料 | 关联 | 是 | 关联 inventory 表 |
| 所需厨具 | 关联 | 否 | 关联 utensils 表（按名称） |
| 烹饪步骤 | rich text | 否 | 有序步骤列表 |
| 烹饪时间 | number(分钟) | 否 | 存库，用于推荐筛选 |
| 难度 | enum | 否 | 简单/中等/困难 |
| 烹饪方式标签 | multi-select | 否 | 炒、炖、蒸、煮、烤、凉拌、炸 |
| **辣度** | enum | 否 | 不辣 / 微辣 / 中辣 / 重辣 |
| **油腻度** | enum | 否 | 清爽 / 适中 / 重油 |
| **咸鲜甜** | enum | 否 | 咸鲜 / 清淡 / 带甜 |
| **荤素** | enum | 否 | 纯荤 / 荤素搭配 / 纯素 |
| **主打营养** | multi-select | 否 | 高蛋白 / 高碳水主食 / 多蔬菜纤维 / 汤水 |
| **适合场景** | multi-select | 否 | 工作日快手 / 周末慢做 / 宴客硬菜 / 夜宵 |
| **菜系** | enum | 否 | 川 / 粤 / 鲁 / 家常 …（可扩展） |
| 照片 | image[] | 否 | 成品照片，存 Supabase Storage（**一期即做上传/预览/删除**） |
| 备注/Tips | text | 否 | 自由文本，经验心得 |

> **维度策略**：除菜名外所有维度均**选填**——填得越多推荐越准，但不强制。**二期由 AI 根据菜名/步骤自动补全这些标签，补全结果交用户最终确认**。一期这些维度靠种子解析的规则推断（见 §4 种子解析）或用户手填。
>
> **留开口（重要）**：上表所有"标签维度"在数据库里**不各占一列**，统一收进菜谱表的一个 `attributes` **jsonb 列**。未来加新维度**零迁移**直接写入，AI mode 读写半结构化数据也天然顺手（见 §4）。

#### 页面功能
- 菜谱列表：卡片/列表视图切换，支持按标签筛选（jsonb GIN 索引）和搜索。
- 新增菜谱：弹窗(Modal)表单填写。
- 菜谱详情页：展示所有信息 + **食材状态检查**（绿色=`enough`，黄色=`low`，红色=`out`）+ 照片展示。
- 编辑、删除、照片上传/删除。

### 3.4 日历 (`/calendar`)

#### 记录一次烹饪

| 字段 | 说明 |
|------|------|
| 日期 | 默认今天，可选其他日期 |
| 菜谱 | 从已有菜谱中选择 |
| 实际消耗 | 见下"做完菜更新库存"——引导式手动调档位 |
| 照片 | 可选，本次实际成品照（存 Supabase Storage） |

#### 做完菜更新库存（引导式手动，两 mode 一致）

系统**不擅自猜测扣减**，而是做完菜后主动把相关食材摆到用户面前，由用户确认档位：

- **Web mode（一期）**：新增「我做完了」快捷按钮 → 弹窗列出**这道菜用到的主要食材** → 用户逐个调三档档位（充足/不多了/没了）→ 确认更新（走 `lib/services/inventory`）。
- **AI mode（二期）**：对话说"这道菜做好了" → AI 逐个反问 → 用户对话回答 → AI 调**同一** service 更新库存。

#### 提前规划
- 在日历任意未来日期标记"计划做 XX 菜"。
- 到当天，用户点击确认 → 弹出该菜谱信息 → 走上方"做完菜更新库存"流程。

#### 页面功能
- 月视图日历（Ant Design Calendar 组件）；每天格子显示当天做了/计划做的菜名；点击某天展开详情。

### 3.5 智能推荐 + 购物清单 (`/recommend`，登录后首页)

> **实现分层**：推荐"决策"逻辑属 **B 层**——一期用规则轻量实现，**二期整块删掉换 LLM**（见 §0.2）。权重与阈值集中在 `src/lib/recommend/config.ts`；另在 `docs/recommend-algorithm.md` 写设计说明供回溯修改。

每日推荐**一次推出几个不同的菜、混合多档**。每道推荐卡片标注它属于哪一档。

#### 第一层：硬分档（决定卡片归到哪一档）

遍历用户所有菜谱，检查关联食材/调料/厨具状态：

| 档位 | 判定规则 |
|------|----------|
| **现在就能做** | 关联食材/调料/厨具全齐（蔬菜肉类 `out` 视为缺、厨具未拥有视为缺） |
| **需额外购买** | 差一点点——缺 **≤ 3 样**菜/调料，或缺某件厨具；标注"还需买 XX"。缺太多则本次不推荐 |
| **清库存推荐** | 某食材 `enough` 且 `last_restocked_at` 距今超过**分类阈值**（下表）→ 推荐**包含该食材的菜**，督促尽快消耗 |

**清库存分类阈值**（`enough` 放置超过 N 天才进"清库存"档）：

| 分类 | 阈值 | 理由 |
|------|------|------|
| 蔬菜 | > 3 天 | 最易坏 |
| 肉类 | > 7 天 | 冷冻可放 |
| 蛋奶豆制品 | > 5 天 | 牛奶/豆腐易坏，居中 |
| 主食/干货 | 不提醒 | 极耐放 |
| 调料 | 不提醒 | 用量小、耐放 |

#### 第二层：档内评分排序（线性加权求和，各项归一化 0–1）

- **不重样**（权重最高）：距上次做该菜天数越久分越高（查 `calendar_entries`）。
- **清库存**：菜里含"久放 `enough` 食材"越多分越高。
- **耗时匹配**：用户设了时间筛选才计，越接近越高；没设则不参与。
- **营养搭配**：近 3 天 `calendar` 连续荤菜 → 给纯素/多蔬菜的菜加分。
- 每档内按总分降序，每档取 **Top 3–5** 张卡片。
- **缺失维度优雅降级**：某菜缺某维度（如没填油腻度），则该项不参与打分，**不报错、不排除**。

#### 临时约束输入
每次推荐可叠加用户当下临时要求，作为**硬过滤**（不满足直接排除，不是软加权）：
- **Web mode（一期）**：筛选器选择（如"30 分钟内"、"重辣"、"纯素"）。
- **AI mode（二期）**：用对话表达，由 LLM 解析成筛选规则。

#### 购物清单（选好菜后弹出）
用户从推荐里**勾选今天想做的菜** → 弹出购物清单，内容 =
1. 做这些菜所缺的食材/调料/厨具；
2. **外加**当前库存不足（`low`/`out`）的调料/主食/蛋奶；
3.（可选）日历上"计划做的菜"所缺食材。

- 清单展示：名称 + 所属菜谱来源 + 建议购买量。
- **闭环回填**：清单项支持**勾选打钩 → 直接把对应库存标记为 `enough` 并刷新 `last_restocked_at`**（走 `lib/services/inventory`），形成"清单 → 采购 → 入库"闭环，无需再去 `/inventory` 逐个手改。

> **不做 Dashboard**：项目重心在二期 AI mode，登录后首页直接是 `/recommend`。不做独立仪表盘、不做可拖拽卡片，**移除 react-grid-layout 依赖和 dashboard_layout 表**。

---

## 4. 数据库设计 (Supabase PostgreSQL)

### 核心表

```
users (Supabase Auth 内置)

inventory  (仅食材/调料，厨具已拆出)
  - id: uuid PK
  - user_id: uuid FK → users
  - name: text
  - category: enum (vegetable, meat, egg_dairy_bean, staple, seasoning)
  - total_amount: text (如 "500ml", "200g", 可空)
  - stock_level: enum (enough, low, out)   -- 三档制
  - unit: text (可空)
  - last_restocked_at: timestamptz   -- 库存被设为 enough 时刷新；用于"清库存"推荐
  - note: text
  - created_at, updated_at

utensils  (厨具，独立表，极简)
  - id: uuid PK
  - user_id: uuid FK → users
  - name: text          -- 拥有 = 在此表中
  - note: text (可空)
  - created_at, updated_at

recipes
  - id: uuid PK
  - user_id: uuid FK → users
  - name: text                    -- 唯一必填
  - steps: jsonb (有序步骤数组)
  - cook_time_minutes: int
  - difficulty: enum (easy, medium, hard)
  - attributes: jsonb             -- 所有标签维度都装这里，留开口、零迁移加维度
                                  --   形如 { method:["炒"], spiciness:"hot",
                                  --          greasiness:"heavy", flavor:"savory",
                                  --          diet_type:"meat", nutrition:["高蛋白"],
                                  --          scene:["工作日快手"], cuisine:"川" }
                                  --   筛选用 GIN 索引；未来新维度直接加 key
  - tips: text
  - created_at, updated_at
  -- 除 name 外均可空

recipe_ingredients (菜谱-食材关联表)
  - id: uuid PK
  - recipe_id: uuid FK → recipes
  - inventory_id: uuid FK → inventory
  - role: enum (main, auxiliary, seasoning)
  - amount: text (如 "300g", 可为空)

recipe_utensils (菜谱-厨具关联表)
  - id: uuid PK
  - recipe_id: uuid FK → recipes
  - utensil_name: text   -- 按名称匹配用户的 utensils 表，缺则归入"需额外购买"

recipe_photos
  - id: uuid PK
  - recipe_id: uuid FK → recipes
  - storage_path: text
  - created_at

calendar_entries
  - id: uuid PK
  - user_id: uuid FK → users
  - date: date
  - recipe_id: uuid FK → recipes
  - status: enum (planned, completed)
  - notes: text
  - created_at, updated_at

calendar_photos
  - id: uuid PK
  - calendar_entry_id: uuid FK → calendar_entries
  - storage_path: text
```

- 所有表启用 RLS，policy: `user_id = auth.uid()`。**不建** dashboard_layout 表。
- **Storage**：建 bucket `recipe-photos`、`calendar-photos`，配 Storage RLS（仅 owner 可写、可读自己的文件）。
- 迁移流程：`supabase migration new xxx` → 写 SQL → `supabase db push`；迁移文件进 git。

### 种子菜谱 / Demo 数据

- **种子来源**：参考 [Anduin2017/HowToCook](https://github.com/Anduin2017/HowToCook)（Markdown 家常菜）。
- **一期种子解析策略**（`scripts/parse-howtocook.ts`，一次性脚本）：
  1. **结构化直取**：菜名、食材清单（→ 关联/新建 inventory）、步骤、难度、烹饪时间（若有）。
  2. **规则推断部分标签**（简单可靠的才推）：荤素（看有无肉类食材）、烹饪方式（步骤含"炒/炖/蒸"等关键词）、辣度（有无辣椒/花椒/豆瓣酱）。
  3. **拿不准的维度留空**（油腻度/营养/场景/菜系），一期不硬编，用户可手补，二期 AI 批量补全。
  4. **精选子集**：一期只导入约 **50–80 道**（荤/素/汤/主食各挑一二十道），不全量，控制种子库与每用户复制的数据量。
  - 输出：一份供注册复制的种子数据（`supabase/seed`），同时抽一小份做 `src/lib/seed/fixtures.ts` 供 `/demo`。

### 种子配套复制（新用户初始化，解决"悬空外键"）

> **背景矛盾**：`recipe_ingredients` 用 `inventory_id` 外键指向食材，但新用户 inventory 为空。若只复制菜谱不复制食材，外键将全部悬空、推荐无法判断"够不够做"。

新用户注册成功触发一次服务端逻辑（`src/lib/services/seed/initUser.ts`，用 `service_role`）：

1. **复制种子 inventory**（基础食材/调料）到该用户 → 生成新行、新 id；初始档位**混合**——调料/主食/干货给 `enough`，蔬菜肉类**部分 `enough`（保证有菜"现在就能做"）、部分 `low`/`out`（让"需额外购买"档与购物清单有内容，并能演示"清库存"）**。
2. **复制种子 recipes / recipe_utensils**。
3. 复制 **recipe_ingredients** 时，把 `inventory_id` **重映射**到第 1 步新建的食材行 id（维护一张 旧种子id→新id 的映射表）。

→ 结果：新用户一进来就有配套食材 + 对得上号的菜谱，`/recommend` 三档都有内容。

### Demo 页数据（纯前端 fixture）
- `/demo` 使用 `src/lib/seed/fixtures.ts` 一套固定示例数据（食材、菜谱、日历），**完全不碰数据库、不走 RLS、不连 Supabase**。
- 推荐/筛选逻辑复用同一套纯函数，只是数据源换成 fixture。
- 所有增删改按钮禁用（或点击提示"Demo 模式不可写"）。

---

## 5. 国际化 (i18n)

- **一期不做国际化，全中文。**
- **但所有界面文案集中到 `src/lib/constants/text.ts`**（或按模块拆几个文件），组件里引用 `TEXT.inventory.addButton` 而非硬编码字符串。成本与硬编码几乎相同，却为二期留了平滑升级口。
- **二期做 i18n**：接 next-intl，把 `text.ts` 的中文换成 key 并补一份 `en.json`，业务组件基本不动；右上角加语言切换按钮。
- 用户添加的数据（菜名、食材名）不做翻译。

---

## 6. 主题

- Ant Design 5 的 `ConfigProvider` + `theme.darkAlgorithm` 支持 light/dark token 切换。
- 右上角切换按钮，即时生效；主题偏好存 localStorage。
- **一期即做。**

---

## 7. 项目结构

```
cook-helper/
├── public/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # 需要登录的路由组
│   │   │   ├── recommend/      # 登录后首页
│   │   │   ├── inventory/
│   │   │   ├── utensils/
│   │   │   ├── recipes/
│   │   │   └── calendar/
│   │   ├── demo/               # 公开 Demo 页（纯前端 fixture）
│   │   ├── login/
│   │   ├── register/           # 注册（6 位数字验证码）
│   │   ├── actions/            # Server Actions（调 lib/services）
│   │   └── layout.tsx
│   ├── components/
│   │   ├── layout/             # 导航 Nav、TopBar（主题切换）
│   │   └── shared/             # 复用组件
│   ├── lib/
│   │   ├── supabase/           # server client / browser client（@supabase/ssr）
│   │   ├── services/           # ★A 层：纯函数 service
│   │   │   ├── inventory/  recipe/  utensil/  calendar/  shopping/
│   │   │   └── seed/           # initUser.ts 种子配套复制
│   │   ├── recommend/          # ★B 层：分档+评分（config.ts 常量）—— 二期换 LLM
│   │   ├── seed/               # HowToCook 解析产物 + fixtures.ts（Demo 用）
│   │   ├── constants/text.ts   # 全中文文案集中处（i18n 预留口）
│   │   └── utils/
│   ├── hooks/                  # 自定义 hooks
│   ├── store/                  # Zustand（仅 UI 状态）
│   └── types/                  # TypeScript 类型定义
├── docs/
│   └── recommend-algorithm.md  # 推荐分档/评分/阈值设计说明（可回溯修改）
├── scripts/
│   └── parse-howtocook.ts      # 一次性：HowToCook md → 种子数据
├── supabase/
│   ├── migrations/             # 数据库迁移文件
│   └── seed.sql / seed 数据    # 种子数据（供注册复制）
├── next.config.js
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── Dockerfile                  # 仅用于本地验证生产构建
└── .env.local                  # Supabase / Resend keys（不提交 git）
```

---

## 8. 部署流程

1. **本地开发**：`npm run dev` → localhost:3000 热更新。
2. **数据库变更**：`supabase migration new xxx` → 写 SQL → `supabase db push`。
3. **邮件**：Resend 作 Supabase Auth 的自定义 SMTP（见 §0.3）。
4. **生产部署**：Git push → Vercel 自动构建部署。
5. **域名**：`cook.wreathmoon.com` → Vercel 绑定子域名（DNS 加 CNAME）。
6. **Dockerfile**：仅用于本地验证生产构建 (`docker build && docker run`)。

---

## 9. 开发分期

### 关键架构原则（贯穿所有阶段，见 §0.2）

- **A 层业务逻辑**（数据/执行）封装成 `src/lib/services` 纯函数，供 UI（Server Actions）与二期 Agent 同时调用，**二期不重写**。
- **B 层推荐决策**一期轻量、二期换 LLM。
- 逻辑**不写死在 React 组件里**。Web mode 是 AI mode 的"可视化后台 + 撤销安全网"。

### 一期（MVP）—— 纯传统 Web 版（本 PRD 实施范围）
1. **项目初始化**：Next.js + TS + antd（ConfigProvider 主题 light/dark + localStorage）+ Supabase client（server/browser，@supabase/ssr）+ Zustand；`constants/text.ts` 骨架；Vitest 配好。
2. **认证系统**：注册（邮箱+密码 → 6 位数字 OTP）、登录、登出；middleware 路由守卫；所有表 RLS；注册成功触发**种子配套复制**（§4）。
3. **食材/调料管理**（CRUD，三档制库存，"更新库存"批量改档）+ **厨具管理**（独立极简表）。
4. **菜谱管理**（CRUD + 食材/厨具关联 + 多维标签存 jsonb attributes + **图片上传**）。
5. **日历**（记录 + 规划 +「我做完了」引导式更新库存 + 成品照）。
6. **智能推荐**（两层：硬分档 + 档内线性加权 + 清库存分类阈值 + 临时硬过滤）+ **购物清单**（选菜后弹出、勾选回填）。
7. **Demo 页 + HowToCook 种子菜谱**（解析脚本 → 精选子集 → 注册复制 + Demo fixture）。
8. **部署上线**（Supabase db push + Vercel + 绑定 `cook.wreathmoon.com`）。

### 二期 —— AI mode
- 入口 Web mode / AI mode 切换；新增 `/chat` 对话界面（文字）。
- AI Agent 核心：自然语言 → 选择/组合一期 A 层 service 作为**工具（function calling）** → 注入上下文（库存、最近吃了啥、久未做的菜）→ LLM 返回固定结构（推荐 + 理由）→ 调 service 执行回填。
- **用 LLM 决策取代一期 B 层推荐**（一期 `src/lib/recommend` 整块删除或降级为兜底）。
- BYOK；AI 解析菜谱（URL/截图 → 自动补全 attributes → 用户确认）；做完菜 AI 引导式库存更新。
- **种子二期用 AI 重新导入**，补全一期留空的标签维度。
- **i18n**：接 next-intl，`text.ts` → key + `en.json`。

### 三期 —— 完善 + 语音
- 修复一二期问题；AI mode 加语音输入（用户自带豆包流式语音 API key，弃 Whisper）；语音只是另一种输入法，底层 Agent 逻辑不变。

> 二期 AI Agent 的具体工具协议、三期豆包语音接入细节，各自阶段再单独 brainstorm + spec。

---

## 10. 验证方式

- 每模块完成后，本地 `npm run dev` 在浏览器手动验证；Supabase Dashboard 核对数据行。
- **注册闭环**：真实邮箱注册 → 收到 6 位验证码 → 验证登录 → 新账号已带**配套食材 + 菜谱**，`/recommend` 三档都有内容。
- **核心闭环**：改库存档位 → `/recommend` 分档/推荐随之变化 → 勾菜出购物清单 → 清单打钩回填库存 `enough` → 推荐再变化。
- **做完菜**：日历「我做完了」→ 调档位 → `/inventory` 与推荐同步更新。
- **Demo**：登出访问 `/demo`，确认除写入外功能齐全、增删改禁用、数据正确展示。
- **上线**：`cook.wreathmoon.com` 走一遍上述关键路径。
- **单测**：`npx vitest run` 全绿。

---

## 11. 测试策略

- **只对 A 层核心纯函数写 Vitest 单测**：①推荐分档规则 ②档内评分 ③种子复制 + 外键重映射 ④库存档位更新 ⑤购物清单回填。这些逻辑分支多、二期还要在其上叠 LLM，值得一张回归网。
- **UI / 页面层不写自动化测试**，按 §10 手动验证。
- **不引入 E2E**（Playwright 等）。
