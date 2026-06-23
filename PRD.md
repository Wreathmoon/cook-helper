# Cook Helper - Product Requirements Document (PRD)

## Context

个人厨房管理应用，解决"家里有什么食材、能做什么菜、该买什么"的日常决策问题。部署在互联网上，仅个人使用，未登录用户看到只读Demo页面。

---

## 1. 技术栈

| 层 | 选型 |
|---|------|
| 前端框架 | Next.js (App Router) |
| UI 组件库 | Ant Design 5 + ProComponents |
| 语言 | TypeScript |
| 数据库 | Supabase (PostgreSQL) |
| 认证 | Supabase Auth (邮箱/密码，单用户) |
| 文件存储 | Supabase Storage (菜谱照片) |
| 国际化 | next-intl (中/英文) |
| 状态管理 | Zustand (轻量) |
| 部署 | Vercel (Git推送自动构建) |
| 本地开发 | npm run dev (热更新) |
| 拖拽布局 | react-grid-layout (Dashboard卡片) |

---

## 2. 页面结构

```
/ (根路由)
├── /demo          — 未登录用户看到的只读交互Demo
├── /login         — 登录页
├── /dashboard     — 仪表盘 (登录后首页)
├── /inventory     — 食材/调料/厨具管理
├── /recipes       — 菜谱管理
├── /calendar      — 日历记录与规划
└── /recommend     — 智能推荐 + 购物清单
```

全局布局：左侧导航栏 + 顶部栏（右上角：语言切换 中/EN、亮色/暗色模式切换）

---

## 3. 功能模块详细需求

### 3.1 认证与访问控制

- **单用户系统**：无注册功能，仅管理员（你）一个账号，通过 Supabase 后台或种子脚本创建
- **未登录访客**：自动重定向到 `/demo`，展示预填示例数据的只读界面，所有编辑/删除按钮禁用
- **登录后**：进入 `/dashboard`，拥有完整读写权限
- **安全**：Supabase Row Level Security (RLS) 确保数据库层面的权限隔离

### 3.2 食材/调料/厨具管理 (`/inventory`)

#### 分类体系（固定6类，互不重叠）

| 分类 | 举例 |
|------|------|
| 蔬菜 | 白菜、土豆、西红柿、黄瓜、菠菜 |
| 肉类 | 猪肉、牛肉、鸡肉、鱼、虾、排骨 |
| 蛋奶豆制品 | 鸡蛋、牛奶、豆腐、腐竹 |
| 主食/干货 | 面条、米、粉丝、面粉 |
| 调料 | 盐、生抽、老抽、蚝油、豆瓣酱、花椒、葱姜蒜、油 |
| 厨具 | 炒锅、蒸锅、砧板、烤箱、空气炸锅 |

#### 食材/调料字段

| 字段 | 类型 | 说明 |
|------|------|------|
| 名称 | string | 必填 |
| 分类 | enum | 6类之一 |
| 总量 | string | "500ml"/"200g"/"一瓶" |
| 剩余比例 | fraction | 1, 1/2, 1/3, 1/4, 1/5 等 |
| 单位 | string | g / ml / 个 / 袋 等 |

#### 厨具字段

| 字段 | 类型 | 说明 |
|------|------|------|
| 名称 | string | 必填 |
| 数量 | number | 默认1 |
| 备注 | string | 可选，如"26cm不粘锅" |

#### 页面功能
- 按分类Tab切换查看
- 支持搜索、添加、编辑、删除
- "更新库存"按钮：批量修改剩余比例（采购回来后快速更新）
- 库存不足提醒：**仅对调料、主食/干货、蛋奶豆制品生效**（蔬菜和肉类不参与库存预警），阈值默认 ≤ 1/5

### 3.3 菜谱管理 (`/recipes`)

#### 菜谱字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 菜名 | string | 是 | |
| 主要食材 | 关联+用量 | 是 | 关联inventory表，主食材需填写用量(如"牛肉300g") |
| 辅助食材 | 关联 | 否 | 关联inventory表，不强制填用量 |
| 所需调料 | 关联 | 是 | 关联inventory表 |
| 所需厨具 | 关联 | 是 | 关联inventory表 |
| 烹饪步骤 | rich text | 否 | 有序步骤列表 |
| 烹饪时间 | number(分钟) | 否 | 存入数据库，用于推荐筛选 |
| 难度 | enum | 否 | 简单/中等/困难 |
| 口味标签 | multi-select | 否 | 辣、清淡、甜（后续可扩展） |
| 烹饪方式标签 | multi-select | 否 | 炒、炖、蒸、煮、烤、凉拌、炸 |
| 照片 | image[] | 否 | 成品照片，存Supabase Storage |
| 备注/Tips | text | 否 | 自由文本，经验心得 |

#### 页面功能
- 菜谱列表：卡片/列表视图切换，支持按标签筛选和搜索
- 新增菜谱：弹窗(Modal)表单填写
- 菜谱详情页：展示所有信息 + **食材状态检查**（绿色=充足，黄色=余量少，红色=没有）
- 编辑、删除

### 3.4 日历 (`/calendar`)

#### 记录一次烹饪

| 字段 | 说明 |
|------|------|
| 日期 | 默认今天，可选其他日期 |
| 菜谱 | 从已有菜谱中选择 |
| 实际消耗 | 手动填写各食材/调料的剩余量更新 |
| 照片 | 可选，本次实际成品照 |

#### 提前规划
- 在日历任意未来日期上标记"计划做XX菜"
- 到了当天，用户点击确认 → 弹出该菜谱信息 → 可修改后确认完成 → 更新库存

#### 页面功能
- 月视图日历（Ant Design Calendar组件）
- 每天格子上显示当天做了/计划做的菜名
- 点击某天展开详情

### 3.5 智能推荐 (`/recommend`)

#### 推荐模块A：现有食材能做的菜
- 遍历所有菜谱，检查关联食材库存
- 食材全部充足 → 推荐列表，按"距离上次做的天数"降序排列

#### 推荐模块B：很久没做但食材不足的菜
- 食材不完全充足，但距离上次做已超过N天
- 展示缺少的食材，自动加入购物清单

#### 筛选条件
- 口味标签：辣/清淡/甜
- 烹饪方式：炒/炖/蒸/煮/烤/凉拌/炸
- 烹饪时间范围
- 难度

#### 购物清单
- **自动生成来源**：
  1. 调料/主食/蛋奶 库存 ≤ 1/5 阈值的自动加入
  2. 用户选择的"想做的菜"所缺食材
  3. 日历上"计划做的菜"所缺食材
- 清单展示：食材名 + 所属菜谱来源 + 建议购买量
- 购物完成后 → 去 `/inventory` 页面手动更新库存

### 3.6 Dashboard (`/dashboard`)

四张卡片，支持拖拽排序和自定义布局（react-grid-layout）：

| 卡片 | 内容 | 点击跳转 |
|------|------|---------|
| 库存预警 | 显示库存不足的调料/主食/蛋奶（≤1/5） | → /inventory |
| 过去一周 | 过去7天做的菜列表 | → /calendar |
| 今日推荐 | 推荐今天做什么 + 今日购物清单 | → /recommend |
| 菜谱统计 | 菜谱总数、各标签分布、最常做/最少做的菜 | → /recipes |

用户的卡片布局偏好保存到数据库，下次登录恢复。

---

## 4. 数据库设计 (Supabase PostgreSQL)

### 核心表

```
users (Supabase Auth内置)

inventory
  - id: uuid PK
  - user_id: uuid FK → users
  - name: text
  - category: enum (vegetable, meat, egg_dairy_bean, staple, seasoning, utensil)
  - total_amount: text (如 "500ml", "200g")
  - remaining_ratio: decimal (0~1, 如0.33表示剩1/3)
  - unit: text
  - quantity: int (厨具专用，默认1)
  - note: text
  - created_at, updated_at

recipes
  - id: uuid PK
  - user_id: uuid FK → users
  - name: text
  - steps: jsonb (有序步骤数组)
  - cook_time_minutes: int
  - difficulty: enum (easy, medium, hard)
  - taste_tags: text[] (辣, 清淡, 甜)
  - method_tags: text[] (炒, 炖, 蒸, 煮, 烤, 凉拌, 炸)
  - tips: text
  - created_at, updated_at

recipe_ingredients (菜谱-食材关联表)
  - id: uuid PK
  - recipe_id: uuid FK → recipes
  - inventory_id: uuid FK → inventory
  - role: enum (main, auxiliary, seasoning, utensil)
  - amount: text (如 "300g", 可为空)

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

dashboard_layout
  - id: uuid PK
  - user_id: uuid FK → users
  - layout: jsonb (react-grid-layout配置)
  - updated_at
```

所有表启用 RLS，policy: `user_id = auth.uid()`

### Demo数据
准备一套种子数据（seed.sql），包含示例食材、菜谱、日历记录，供Demo页面展示。Demo使用固定的示例数据，不走RLS。

---

## 5. 国际化 (i18n)

- 使用 next-intl
- 语言文件：`/messages/zh.json`, `/messages/en.json`
- 右上角一键切换，页面即时刷新（不重新加载，客户端切换locale）
- 所有UI文本、标签名、枚举值均需国际化
- 用户添加的数据（菜名、食材名）不做翻译

---

## 6. 主题

- Ant Design 5 的 ConfigProvider 支持 light/dark token切换
- 右上角切换按钮，即时生效
- 主题偏好存 localStorage

---

## 7. 项目结构

```
cook-helper/
├── public/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # 需要登录的路由组
│   │   │   ├── dashboard/
│   │   │   ├── inventory/
│   │   │   ├── recipes/
│   │   │   ├── calendar/
│   │   │   └── recommend/
│   │   ├── demo/               # 公开Demo页
│   │   ├── login/
│   │   └── layout.tsx
│   ├── components/             # 通用组件
│   │   ├── layout/             # 导航、TopBar
│   │   └── shared/             # 复用组件
│   ├── lib/
│   │   ├── supabase/           # Supabase client & helpers
│   │   └── utils/
│   ├── hooks/                  # 自定义hooks
│   ├── store/                  # Zustand stores
│   ├── types/                  # TypeScript类型定义
│   └── messages/               # i18n语言文件
│       ├── zh.json
│       └── en.json
├── supabase/
│   ├── migrations/             # 数据库迁移文件
│   └── seed.sql                # Demo种子数据
├── next.config.js
├── package.json
├── tsconfig.json
├── Dockerfile                  # 生产构建用
└── .env.local                  # Supabase keys (不提交git)
```

---

## 8. 部署流程

1. **本地开发**：`npm run dev` → localhost:3000 热更新
2. **数据库变更**：`supabase migration new xxx` → 写SQL → `supabase db push`
3. **生产部署**：Git push → Vercel自动构建部署
4. **域名**：cook.xxx.com → Vercel自定义域名配置
5. **Dockerfile**：仅用于本地验证生产构建 (`docker build && docker run`)

---

## 9. 开发分期

### 一期（MVP）
1. 项目初始化（Next.js + antd + Supabase + i18n + 主题）
2. 认证系统 + 路由守卫
3. 食材/调料/厨具管理（CRUD）
4. 菜谱管理（CRUD + 食材关联）
5. 日历（记录 + 规划）
6. 智能推荐 + 购物清单
7. Dashboard
8. Demo页面
9. Vercel部署上线

### 二期
- AI解析菜谱（URL/截图 → 自动填写菜谱表单）
- iOS端（PWA 或 React Native）
- CLI工具（供AI Agent调用）

---

## 10. 验证方式

- 每个模块完成后，本地 `npm run dev` 在浏览器中手动验证功能
- 数据库操作通过 Supabase Dashboard 验证数据正确性
- 部署后通过 cook.xxx.com 验证线上环境
- Demo页面：退出登录后访问，确认只读且数据正确展示
