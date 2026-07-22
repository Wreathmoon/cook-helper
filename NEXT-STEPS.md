# Cook Helper — 下一步行动计划

> 生成日期：2026-07-18
> 当前进度：**Task 1-11 已完成，仅剩 Task 12（部署上线）**

---

## 目录

1. [部署上线步骤（Task 12 细化）](#1-部署上线步骤task-12-细化)
2. [上线前检查清单](#2-上线前检查清单)
3. [代码遗留问题修正](#3-代码遗留问题修正)
4. [后续优化建议（按优先级）](#4-后续优化建议按优先级)
5. [潜在风险与注意事项](#5-潜在风险与注意事项)

---

## 1. 部署上线步骤（Task 12 细化）

### 1.1 Supabase 账号注册与项目创建

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1 | 访问 [supabase.com](https://supabase.com) → 注册账号 | 可用 GitHub 登录 |
| 2 | Create a new project → 选择免费计划 | 区域建议选 **Singapore**（东南亚，离国内近） |
| 3 | 设置 Database Password（记住它） | 用于后续本地连接 |
| 4 | 等待项目初始化完成（约 2-5 分钟） | 状态变为 Available 后继续 |
| 5 | 进入项目 Dashboard → Project Settings → API | 复制以下 **3 个值**： |

```
NEXT_PUBLIC_SUPABASE_URL      = https://<项目id>.supabase.co   （API URL 字段）
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJh...                        （anon public 字段）
SUPABASE_SERVICE_ROLE_KEY     = eyJh...                        （service_role 字段，⚠️ 保密）
```

### 1.2 本地 `.env.local` 配置

编辑 `E:\Coding\cook-helper\.env.local`，填入上面获取的值：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...
```

> `.env.local` 已在 `.gitignore` 中，不会提交到 git。

### 1.3 数据库迁移

安装 Supabase CLI（若尚未安装）：

```bash
npm install -g supabase
# 或验证：supabase --version
```

登录 Supabase：

```bash
supabase login
```

链接本地项目与云端项目：

```bash
supabase link --project-ref <项目引用id>
# 项目引用 id 在项目 Settings → General → Reference ID
```

推送迁移文件：

```bash
supabase db push
```

> 迁移文件在 `supabase/migrations/20260705000000_initial_schema.sql`，包含建表、RLS、Storage buckets、触发器等全部内容。推送后所有表会自动创建。

执行种子数据（可选，仅用于测试本地环境有初始数据）：

```bash
# Supabase seed 脚本当前仅通过注册流程触发，
# 你也可以在 Supabase Dashboard → SQL Editor → 执行 SQL 注入
```

### 1.4 Resend SMTP 配置

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1 | 访问 [resend.com](https://resend.com) → 注册账号 |  |
| 2 | 进入 Dashboard → API Keys → Create API Key | 复制 key（类似 `re_xxxxxxxx`） |
| 3 | 左侧 Domains → Add Domain → 输入 `wreathmoon.com` |  |
| 4 | 按 Resend 提示添加 DNS 记录（域名管理面板操作）： | 添加 **TXT / MX** 记录完成域名验证 |
| 5 | 验证域名状态变为 **Verified** | 可能需要几分钟到几小时 |

**在 Supabase 后台配置 SMTP：**

| 步骤 | 操作 |
|------|------|
| 1 | Supabase Dashboard → Authentication → Settings |
| 2 | 找到 SMTP Settings → 启用 Custom SMTP |
| 3 | 填写 Resend SMTP 参数： |

| 字段 | 值 |
|------|------|
| Sender name | `Cook Helper` |
| Sender email | `noreply@wreathmoon.com`（需先在 Resend 验证该域名） |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `smtp` |
| Password | 刚才复制的 Resend API Key |

| 步骤 | 操作 |
|------|------|
| 4 | 保存 → 点击 "Send Test Email" 验证配置是否可用 |
| 5 | 确保 **Enable email confirmations** 已开启 |

**自定义 OTP 邮件模板：**

在 Supabase Auth → Templates，找到 OTP 模板，将邮件内容设为：

```
您的 Cook Helper 验证码为：{{ .Token }}

此验证码有效期为 10 分钟，请勿泄露给他人。

如果不是您本人操作，请忽略此邮件。
```

### 1.5 Vercel 部署流程

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1 | 访问 [vercel.com](https://vercel.com) → 用 GitHub 登录 |  |
| 2 | Add New → Project → 导入 `cook-helper` 仓库 | 若仓库未推 GitHub，参考下方 **1.5.1** |
| 3 | 在 Environment Variables 区域填入 3 个 key（与 `.env.local` 相同） | 见下方键名表 |
| 4 | Framework Preset 选 **Next.js** | 自动识别 |
| 5 | Root Directory 保持 `/` |  |
| 6 | Build Command 保持默认 `next build` |  |
| 7 | Deploy → 等待构建完成（约 3-5 分钟） |  |
| 8 | 验证：访问 `https://cook-helper-<随机>.vercel.app` | 应能看到 /demo 页面 |

**环境变量键名（Vercel 中必须手动添加）：**

| Key | 说明 | 来源 |
|-----|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL | Supabase Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key | Supabase Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key（⚠️ 保密） | Supabase Settings → API |

> **安全提醒**：`SUPABASE_SERVICE_ROLE_KEY` 拥有管理员权限，Vercel 环境中**仅服务端**（Server Actions / API Routes）可访问，前端代码不可见。切勿泄露。

#### 1.5.1（备选） 如果代码尚未推送到 GitHub

```bash
# 1. 在 GitHub 新建一个私有仓库（例如 cook-helper）
# 2. 本地推代码：
git remote add origin https://github.com/<你的用户名>/cook-helper.git
git push -u origin main
# 3. 然后在 Vercel 中 Import 这个仓库
```

### 1.6 域名绑定 `cook.wreathmoon.com`

| 步骤 | 操作 |
|------|------|
| 1 | Vercel Dashboard → Project → Domains |
| 2 | 输入 `cook.wreathmoon.com` → Add |
| 3 | Vercel 提供一条 CNAME 记录值，类似 `cname.vercel-dns.com` |
| 4 | 在您的域名管理面板（如 Cloudflare、阿里云等）添加 DNS 记录： |

| 类型 | 名称 | 值 |
|------|------|------|
| CNAME | `cook` | `cname.vercel-dns.com` |

| 步骤 | 操作 |
|------|------|
| 5 | 等待 DNS 生效（几分钟到 48 小时） |
| 6 | Vercel 上状态变为 **Valid** → 部署成功 |

---

## 2. 上线前检查清单

### 2.1 功能验证（手动测试）

- [ ] **根路由重定向**：访问 `https://cook.wreathmoon.com` → 未登录跳转 `/demo`，已登录跳转 `/recommend`
- [ ] **Demo 页**：访问 `/demo` → 能正常显示全部 4 个 Tab（食材/菜谱/推荐/日历），所有编辑/删除按钮显示灰色禁用
- [ ] **注册流程**：`/register` → 输入邮箱 + 密码 → 收到 6 位 OTP 验证码邮件 → 输入验证码 → 注册成功跳转 `/recommend`
- [ ] **注册后初始化**：新用户登录后 → `/recommend` 有 50+ 菜谱推荐数据，三档都有内容
- [ ] **登录流程**：`/login` → 邮箱 + 密码 → 跳转 `/recommend`
- [ ] **路由保护**：未登录时访问 `/inventory`、`/recipes`、`/calendar`、`/utensils` → 自动重定向到 `/login`
- [ ] **食材管理**：`/inventory` → 按分类切换、搜索、添加、编辑、删除、批量更新库存全部可用
- [ ] **厨具管理**：`/utensils` → 添加、删除可用
- [ ] **菜谱管理**：`/recipes` → 卡片/列表视图切换、按标签筛选、新建/编辑（含食材关联、步骤、照片）、详情查看、删除
- [ ] **日历**：`/calendar` → 月视图显示条目、点击日期查看详情、添加记录、规划未来、标记完成、"我做完了"库存更新
- [ ] **推荐引擎**：`/recommend` → 按档位分组推荐、筛选器（时间/辣度/荤素/烹饪方式）可用、勾选菜品生成购物清单
- [ ] **购物清单闭环**：勾选菜品 → 生成购物清单 → 勾选已采购项 → 采购完成 → 库存变回 `enough` → 推荐随之变化
- [ ] **主题切换**：右上角太阳/月亮图标 → 切换 light/dark 主题

### 2.2 配置检查

- [ ] Supabase Auth SMTP 配置正确：已填 Resend SMTP 参数且测试邮件通过
- [ ] Supabase Auth 邮件模板已修改为 6 位数字验证码格式
- [ ] Supabase **Enable email confirmations** 已开启
- [ ] Resend 域名 `wreathmoon.com` 已验证通过
- [ ] Vercel 环境变量 3 个 key 全部填入且拼写正确
- [ ] DNS CNAME 记录已添加且生效（`cook.wreathmoon.com` → `cname.vercel-dns.com`）
- [ ] Vercel 部署日志无报错

### 2.3 构建验证

```bash
# 本地验证生产构建（确保无编译错误）
npm run build

# 运行测试
npm run test
```

---

## 3. 代码遗留问题修正

在代码审阅中发现以下可优化的问题，建议在上线前修复：

### 3.1 注册页面上残留旧注释

**文件**：`src/app/register/page.tsx` 第 46-48 行

```typescript
// TODO: Task 7 实现种子复制 service
// import { initUserFromSeed } from '@/lib/services/seed/initUser';
// await initUserFromSeed(user.id);
```

现在 initUserFromSeed 已在 `auth.ts` 的 `verifyOtp` 中正确调用，注册页面这些注释已过时，应删除。

### 3.2 register/page.tsx 中 createServiceRoleClient 未被直接调用

`verifyOtp` Server Action 中已经调用了 `initUserFromSeed`，所以这段注释不造成功能问题，但会让人困惑。**低优先级，建议删除。**

---

## 4. 后续优化建议（按优先级）

### P0 — 上线前必须确认

| # | 建议 | 原因 | 工作量估 |
|---|------|------|----------|
| 1 | 创建 `.env.example` 文件（列出所有需要的环境变量名，不含值） | 方便后续开发者/自己换机器时快速配置 | 5 分钟 |

### P1 — 上线后尽快做

| # | 建议 | 原因 | 工作量估计 |
|---|------|------|-----------|
| 1 | **Supabase Auth Rate Limit 关注** | 免费版 Auth 有每小时 30 次注册的限制；上线后若有用户注册被限，监控 Dashboard | 无需代码改动 |
| 2 | **添加注册成功的邮件通知** | 目前注册后无通知给管理员；建议在 `verifyOtp` 成功时发一封通知邮件到管理员邮箱 | 小（半天） |
| 3 | **错误处理补全** | 部分 Server Action 的 try/catch 中仅 `message.error(TEXT.common.error)`，没有区分错误类型；建议区分网络错误、权限错误、验证错误 | 中（1天） |
| 4 | **Demo 页缺少「体验 Demo」模式顶部提示** | 目前 Demo 页写操作按钮都变灰，但没有醒目的顶部 Banner 告知这是 Demo 模式；建议顶部加一条 Alert | 小（2小时） |

### P2 — 中期优化

| # | 建议 | 原因 | 工作量估计 |
|---|------|------|-----------|
| 1 | **图片上传体验优化** | 目前菜谱照片和日历照片直接走 Supabase Storage `insert`，无压缩、无进度条、无裁剪；建议接入 `react-easy-crop` + `compressorjs` 做客户端压缩再上传 | 中（1-2天） |
| 2 | **菜谱管理页组件拆分** | `src/app/(auth)/recipes/page.tsx` 达 1354 行，一个文件内包含列表、搜索筛选、表单（含多步骤 Modal）、详情 Drawer，可拆为 3-4 个子组件文件 | 中（1天） |
| 3 | **推荐算法配置界面** | 当前 `config.ts` 中的权重和阈值只能改代码；建议加一个 Settings 页面或 .env 变量覆盖，方便调参数不用重新部署 | 中（1-2天） |
| 4 | **购物清单增加预计价格** | 目前仅显示名称和来源，没有参考价格；可以考虑后期加一个 optional 字段让用户记录单价 | 小（半天） |
| 5 | **Loading / 空态优化** | 部分页面（如菜谱编辑 Modal 加载库存数据时）没有 loading indicator；搜索无结果时建议显示更友好的提示 | 小（半天） |

### P3 — 长期 / 二期预留

| # | 建议 | 原因 | 工作量估计 |
|---|------|------|-----------|
| 1 | **II8n 支持（`next-intl`）** | PRD §5 已写明二期做国际化；文案已在 `text.ts` 集中，接入 `next-intl` 后只需补英文翻译文件 | 中（2天） |
| 2 | **AI Mode 入口（二期核心）** | 新增 `/chat` 路由 + Web mode / AI mode 切换开关 + BYOK 配置页 | 大（1-2周） |
| 3 | **LLM 替换 B 层推荐** | 整块删除 `src/lib/recommend/` 目录，替换为 LLM function calling | 大（取决于 LLM 选型） |
| 4 | **种子菜谱 AI 补全标签** | 当前 50+ 道菜中有部分标签（油腻度/营养/场景/菜系）留空；二期用 LLM 读取每个菜谱的步骤推断并填上 | 中（1-2天） |
| 5 | **PWA / 离线支持** | 目前纯 Web；加 Service Worker 后可在移动端首屏添加到桌面 | 中（1天） |
| 6 | **数据备份机制** | 建议定期导出用户数据（支持 JSON 下载），以防 Supabase 免费计划有数据限制 | 小（半天） |

---

## 5. 潜在风险与注意事项

### 5.1 Supabase 免费计划限制

| 限制项 | 免费计划上限 | 风险等级 |
|--------|-------------|---------|
| 数据库大小 | 500 MB | 🟢 低（一期纯文本数据远小于此） |
| Auth 用户数 | 50,000 | 🟢 低 |
| Auth Rate Limit | 30 registrations/hour | 🟡 中（如果有推广活动，注意监控） |
| 存储空间 | 1 GB | 🟢 低 |
| 带宽 | 5 GB / 月 | 🟡 中（照片上传多时需关注） |
| 单表行数 RLS 查询性能 | 无硬限制 | 🟡 中（50-100 个菜谱时无问题；如果用户达到数千，需加分页） |

**应对**：上线后前 1-3 个月免费计划完全够用。若用户量增长，升级 Pro 计划（$25/月）即可。

### 5.2 Resend 免费计划限制

| 限制项 | 免费计划上限 | 风险 |
|--------|-------------|------|
| 每月发送量 | 3,000 封 | 🟢 低（仅注册验证码，单用户发 2-3 封） |
| 每天发送量 | 100 封 | 🟢 低 |
| 域名验证 | 最多 1 个 | 🟢 低 |

### 5.3 域名 / DNS 相关

- `wreathmoon.com` 的域名管理权需要确认在哪（Cloudflare / 阿里云 / 其他），以便添加 DNS 记录
- CNAME 变更生效时间从几分钟到 48 小时不等（取决于 TTL），建议提前操作
- 如果当前域名已有其他子域名的 CNAME 记录，不影响 `cook.wreathmoon.com` 的新增

### 5.4 本地环境迁移到生产时的注意事项

- 建议在 Supabase 正式项目上**先跑迁移再部署 Vercel**，不要在 Vercel 构建时触发数据库变更
- **区分测试 Supabase 项目和生产 Supabase 项目**：不要用同一个 Supabase 项目做开发和测试
  - 开发：本地 `.env.local` 指向测试项目
  - 生产：Vercel Environment Variables 指向正式项目
- **.env.local 不提交 git** — 每次搭建新环境需要手动创建

### 5.5 未来已知限制 / 架构债务

| 问题 | 影响 | 建议处理时机 |
|------|------|------------|
| `browser.ts` 中 Supabase client 在 Demo 页面不连接数据库，但浏览器端仍初始化了 SDK | 轻度（无害，仅初始化） | P3 |
| 种子复制 `initUser.ts` 用 `for` 循环逐个 insert 食材和菜谱 | 慢但仅有用户注册时才执行一次，不是热路径 | P2（可改批量 insert） |
| register 页面中 createServiceRoleClient 在验证后调用，但验证码失效的用户也会触发 | 极低（OTP 验证后 10 分钟过期） | P2 |
| **没有用户注销/删除账号功能** | 一期未实现，若有用户需要删除数据需手动去 Supabase Dashboard 操作 | P2 |

---

## 快速参考：关键文件索引

| 用途 | 文件路径 |
|------|---------|
| 产品需求 | `PRD.md` |
| 实施计划 | `PLAN.md` |
| 推荐算法设计 | `docs/recommend-algorithm.md` |
| 数据库迁移 | `supabase/migrations/20260705000000_initial_schema.sql` |
| 种子数据 | `src/lib/seed/seed-data.ts` |
| Demo 数据 | `src/lib/seed/fixtures.ts` |
| 所有文案集中 | `src/lib/constants/text.ts` |
| 类型定义 | `src/types/index.ts` |
| A 层 Services | `src/lib/services/` |
| B 层推荐引擎 | `src/lib/recommend/` |
| Server Actions | `src/app/actions/` |
| 单元测试 | `src/lib/recommend/__tests__/` |
| 环境变量模板 | （需要创建 `.env.example`） |
