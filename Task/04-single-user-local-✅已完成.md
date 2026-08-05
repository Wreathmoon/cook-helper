# 04 — 去多用户：单用户本地 vault 部署 + 一期遗留收尾

> **状态**: ✅ 已完成（2026-07-26）。Step 0–6 全部落地，四份已发布文档已同步。**唯一剩余项：只读沙盒的 Vercel 实际部署**（需作者账号）——见文末完成记录
> **依赖**: 05 ✅, 06 ✅ ⚠️ **注意：本任务的编号不等于执行顺序**，见下方「执行顺序的例外」
> **阶段**: 本地化（原为「近期收尾」，已因主线任务加入而变更）

## 目标

**把 Cook Helper 从「云端多用户 Web 应用」改造成「本地部署的单用户工具」**：数据以纯文本 vault 存在用户自己的磁盘上，无登录、无注册、无多租户、无 Supabase；仓库自带一份调好的默认数据，`git clone && npm install && npm run dev` 之后打开浏览器就能看到一个有内容、可操作的完整应用。

顺带清掉一期遗留的打磨项——但只清那些在新形态下**依然成立**的（原清单里有一半随认证一起消失了，见 §5）。

## 为什么做

这不是新方向，是**把已经写在文档里的定位落到代码上**：

- [DESIGN.md](../DESIGN.md) §1.2 —— 真实受众是**自托管 / 开源爱好者**（Home Assistant、Obsidian 那一类人群），一期的多用户形态「是**部署形态**的选择，不是市场定位」。
- [DESIGN.md](../DESIGN.md) §1.4 —— 路径 A：开源个人工具，**首要用户是作者自己**，不需要护城河。
- [DESIGN.md](../DESIGN.md) §12.3 —— Obsidian 范本：local-first、用户拥有自己的数据、App 只是「透镜」而非「牢笼」。
- [FUTURE.md](../FUTURE.md) §1 —— 已定方向：数据以纯文本文件保存在本地，应用以本地 Web 服务形态运行。

**多用户 + 云端认证是唯一还站在这个定位对面的东西。** 它带来的全部成本（RLS、OTP 注册、种子复制的 service_role 逻辑、middleware 路由守卫、Rate Limit、注册通知）服务的是一个**本项目明确声明不追求的用户群**。删掉它不是缩减功能，是**去掉一层与定位冲突的负债**。

而「仓库自带默认数据」补上了本地化最后一块短板：自托管项目最大的流失点是 onboarding，而空库 → 推荐全空 → 「这玩意儿没用」是最快的弃用路径（[DESIGN.md](../DESIGN.md) §1.5 (3)）。

> ⚠️ **战略纠正（2026-07-26）**
>
> 本项目早期文档（[DESIGN.md](../DESIGN.md) §9 部署架构、§7 安全模型、[README.md](../README.md) 本地运行章节）描述的是「Vercel + Supabase 云端多用户部署，自助注册 + RLS 数据隔离」。**该形态已决定废弃。**
>
> **理由**：多用户是一期为了「先上线跑通流程」选的部署形态，从未是产品定位。它服务的假想用户群（需要注册账号的大众消费者）与 §1.2 声明的真实受众（自托管爱好者）正相反，而维护它的成本（认证 + RLS + 多租户 + 种子复制特权逻辑）全部由作者独自承担。
>
> **因此**：单用户本地部署是**唯一形态**。`cook.wreathmoon.com` 降级为**只读沙盒**（同一份代码 + `READ_ONLY` 开关），仅作演示，不再可注册使用。

## 执行顺序的例外 ⚠️

FUTURE.md §6 的规则是「**编号 = 执行顺序**」。**本任务是唯一的例外**：

```
实际执行顺序：  05  →  06  →  04  →  (07 / 08 / 09 视残余范围而定)  →  10 ...
```

编号保留为 04 是因为**编号是稳定引用，不重排**。但它现在依赖 05、06：

- **依赖 05（vault 格式规范）**：本任务要把 vault 写成代码，格式没定就没法写。
- **依赖 06（食材名归一化 / 别名表）**：纯文本世界的 join key 是**名称**而不是 UUID（[FUTURE.md](../FUTURE.md) §1.3 决策②）。现状 `RecipeIngredient.inventory_id` 是 UUID 外键（`src/types/index.ts:65`），必须改成按名称关联，而名称关联**必须**配一张别名表，否则「西红柿」和「番茄」会被当成两种食材，推荐直接算错。

> ⚠️ **前置条件必须双写**（吸取 2026-07-26 的教训，见 §5 P2-6）：
> 「Task 04 依赖本任务」这句话已同时写进 [Task/05](./05-vault-format-spec-✅已完成.md) 和 [Task/06](./06-ingredient-name-normalization-✅已完成.md) 的正文。**只写在被依赖方这里等于没写。**

## 现状核实（2026-07-26 实测，非估算）

### 测试与 lint 基线

```
npx vitest run   →  5 files, 39 tests, 全绿
npm run lint     →  36 errors / 48 warnings
```

### Supabase / 多用户的全部触点

删除范围是明确可枚举的：

| 类别 | 文件 | 处置 |
|------|------|:----:|
| 认证页 | `src/app/login/page.tsx` (116)、`src/app/register/page.tsx` (178) | **删** |
| 认证动作 | `src/app/actions/auth.ts` (65) | **删** |
| 路由守卫 | `src/middleware.ts` (12)、`src/lib/supabase/middleware.ts` (28) | **删** |
| 客户端 | `src/lib/supabase/{browser,server,service-role}.ts` (8+22+14) | **删** |
| 数据库 | `supabase/migrations/*.sql`、`supabase/.temp/` | **删** |
| 种子复制 | `src/lib/services/seed/initUser.ts` (129) | **删**（改为复制文件目录） |
| Demo 页 | `src/app/demo/page.tsx` (237)、`src/app/demo/layout.tsx` | **删** |
| Demo fixture | `src/lib/seed/fixtures.ts` (87) | **删**（种子 vault 顶替它） |
| 环境变量模板 | `.env.example` | **删** —— 不再有任何必填 key，留着会误导人以为需要配置 |
| 路由组 | `src/app/(auth)/` **6 个页面**（calendar / inventory / recipes / recipes/new / recommend / utensils）+ `layout.tsx` | **上移**到 `src/app/`，业务逻辑保留 |
| Server Actions | `src/app/actions/{inventory,recipe,calendar,utensil,recommend}.ts` | **重写**取用户的那几行 |
| A 层 Service | `src/lib/services/*/index.ts`（5 个，共 858 行） | **改签名** |
| 照片存储 | Supabase Storage（bucket `recipe-photos` / `calendar-photos`）的上传下载路径，散落在 `actions/recipe.ts`、`services/recipe/index.ts`、`services/calendar/index.ts`、`components/shared/RecipeDetailModal.tsx`、`types/index.ts` | **改为**写 `data/assets/` 真实文件 |
| 类型 | `src/types/index.ts` 的 4 处 `user_id`（:19/:33/:54/:88） | **删字段** |
| 种子数据源 | `src/lib/seed/seed-data.ts` (957) | **转换**成 `seed/` vault 文件后删除，见下 |
| 种子生成脚本 | `scripts/parse-howtocook.ts` | **改产物**：从生成 `seed-data.ts` 改为直接生成 vault 文件 |
| 依赖 | `@supabase/ssr`、`@supabase/supabase-js`、devDep `supabase` | **卸载** |
| 布局 | `src/components/layout/app-layout.tsx` 的 `user` prop / `GuestNav` / 登出按钮 / `signOut` | **简化** |

> ⚠️ **`seed-data.ts` 的 957 行不是「删掉」，是「换载体」**：那 54 道菜谱是项目最有价值的人工资产之一。它要被**转换**成 `seed/` 下的 vault 文件（一菜一 `.md` + 5 个分类 `.yaml`），转换后 TS 文件才能删。转换脚本要留下来可重跑，别做成一次性手工搬运。

### 测试的波及范围（实测分文件）

39 个测试**不是**平均受影响的——这直接决定了改造时的安全网在哪：

| 测试文件 | 数量 | 受影响程度 |
|---------|-----:|-----------|
| `src/lib/recommend/__tests__/tiering.test.ts` | 10 | ✅ **零影响** —— 测的是纯函数吃内存数组，不碰 Supabase |
| `src/lib/recommend/__tests__/scoring.test.ts` | 8 | ✅ **零影响** —— 同上 |
| `src/lib/services/seed/__tests__/initUser.test.ts` | 9 | ⚠️ **拆开**：6 个「种子数据质量」测试（分类覆盖 / 数量 / 食材名匹配率 / attributes 完整性）**必须保留并改指向 `seed/` vault**；3 个 hash 档位分配测试随 `initUser.ts` 一起删 |
| `src/lib/services/inventory/__tests__/inventory.test.ts` | 7 | 🔄 **重写** —— 现在靠手搓的 Supabase thenable mock，改造后直接喂数组，会**更简单** |
| `src/lib/services/shopping/__tests__/shopping.test.ts` | 5 | 🔄 **重写** —— 同上 |

**关键结论：18 个推荐引擎测试完全不受影响，它们就是这次改造的回归基准。** 推荐结果是本项目的核心价值，而验证它正确的那批测试恰好完全独立于数据层——换库之前它们绿，换完之后还得绿，且**一个用例都不许改**。这条取代了原先设想的「和 Supabase 版本对拍」。

那 6 个种子数据质量测试同样重要：它们守的是「下载下来一打开就好看」这个承诺（54 道菜、5 个分类齐全、食材名匹配率 >95%）。**改指向 vault 后必须依然全绿**，否则种子 vault 转换过程中掉了数据都没人知道。

### 两个改写了原计划的发现

**① Demo Banner 已经做完了。** 原 P1-1 挂着「⚠️ 需先核实 Task/01 是否已加」——**已加**：`src/components/layout/app-layout.tsx:252-256` 在 `isGuest` 时渲染一条 sticky 的「Demo 演示数据」黄条。这条遗留项无需再做，而且它正是 §4 Step 5 里 `READ_ONLY` 沙盒 Banner 要复用的机制。

**② 原 lint 表把 error 和 warning 混在一起了，导致优先级判断反了。** 实测按规则拆分：

| 规则 | 数量 | 级别 | 性质 |
|------|-----:|:----:|------|
| `@typescript-eslint/no-explicit-any` | 24 | **error** | 补类型 |
| `react-hooks/set-state-in-effect` | 8 | **error** | ⚠️ 可能是真 bug |
| `@typescript-eslint/no-assign-module-variable` (`@next/next/`) | 2 | **error** | 在 `claude design/` 第三方文件里 |
| `react/no-deprecated` | 2 | **error** | ✅ **也全在 `claude design/` 里**——与 React 19 无关 |
| `@typescript-eslint/no-unused-vars` | 41 | warning | 不阻断 |
| `@typescript-eslint/no-unused-expressions` | 4 | warning | 不阻断 |
| `react-hooks/exhaustive-deps` | 2 | warning | 逐个判断 |
| `@next/next/no-img-element` | 1 | warning | 换 `next/image` |

**原表的两处错误已在此更正**：
- 原表把最大头 `no-unused-vars`（41）列进 error 统计，实际是 **warning，根本不阻断**。
- 原表说 `react/no-deprecated`「⚠️ 与 React 19 升级相关，值得查」——**不对，两处全在 `claude design/*/support.js` 这个第三方设计交付物里**，本项目代码零处。

**由此得到一个关键结论**（见 §4 Step 0 和 §5 P2-7）：把 `claude design/` 加进 eslint 的 `ignores` 一项，**直接消掉 4 个 error + 16 个 warning**，并让 4 条 error 规则里的 2 条彻底归零。

## 关键决策

### 已定（本次对话，2026-07-26）

- [x] **存储运行时** → **vault 纯文本文件为唯一真相**。不走「只剥认证保留 Supabase」的中间态，也不走「先上 SQLite 再换文件」的两次搬家。
  > 代价：本任务因此依赖 05、06，不再是「近期收尾」量级。这是睁眼选的。
- [x] **云端 `cook.wreathmoon.com`** → **降级为只读沙盒**。部署同一份代码 + `READ_ONLY=1`。Vercel 的文件系统本来就是只读的，所以这个形态几乎是白拿的：读仓库里的 `seed/` 展示，写入优雅报错，重启自动重置。**它同时顶替了被删掉的 `/demo` 页**，README 可以继续给出一个「先看一眼」的链接。
- [x] **Supabase 依赖** → **彻底删**。不留双 adapter 抽象。
  > 理由：单用户定位下双 adapter 是纯负债；路径 A 不需要为假想用户留扩展点。**这同时定下了 [Task/08](./08-local-data-layer.md) 的头号决策：云端不留。**
- [x] **默认数据** → **人工调好的固定种子 vault**，随仓库发布。54 道菜 + 48 食材全量，但库存档位**手工调**并提交进仓库，保证首次打开时三档推荐都有好看的内容（几道「现在就能做」、几道「差 1-2 样」、有食材久放触发「清库存」），再配几条日历记录。
  > 不沿用 `initUser.ts` 的 hash 生成——那样首屏推荐质量是碰运气的。
- [x] **不做数据导出 / 备份**（作者确认 2026-07-26）→ Supabase 上没有值得保留的真实数据，**直接删库**。
  > 这取消了原计划里「删代码前先导出 + review」的强制前置步骤，也让 [Task/07](./07-export-import.md) 失去了最后一块必做内容。
  > **代价要认清**：项目从此没有「和旧实现对拍」的回归基准了。替代方案见 §8 风险——**18 个推荐引擎测试**成为唯一的正确性锚点，因为它们本来就不碰数据层。

### 待定（已全部定稿，2026-07-26）

- [x] **是否引入派生索引？** → **不引 SQLite。纯内存索引。** 48 食材 + 54 菜谱的量级，启动时全量解析进内存，`Map.get(name)` 是 O(1)。`better-sqlite3` 是 native addon，跨平台编译是负优化。
- [x] **新增依赖到什么程度？** → **仅 `yaml`**（`npm install yaml`）。frontmatter 拆分手写 10 行（`split('---', 2)` + `yaml.parse`）。ULID 生成手写 20 行（`Date.now()` + `crypto.randomBytes` + Crockford base32 编码）。Markdown 步骤解析用正则。
- [x] **手改坏了的文件怎么报错？** → **Zod schema 校验**。已在 `node_modules`（Next.js 生态标配），不是新依赖。产物是结构化错误信息，UI 层可直接消费指向具体字段。Schema 定义从 `src/types/index.ts` 逐字段翻译。
  > 报错必须包含**文件路径 + 行号**（YAML parse error 自带行号；schema 校验失败时包装一层）。
- [x] **vault 路径怎么配？** → **仓库内 `data/`（进 `.gitignore`）**。`vault/kitchen/config.yaml` 预留 `vaultPath` 字段，默认 `./data`。种子 vault 在 `seed/`（进 git），首次启动自动复制 `seed/` → `data/`。`git clone && npm run dev` 零配置。
- [x] **写入原子性与并发** → **temp + rename，不加锁。** 写临时文件 → fsync → rename（同目录下原子操作）。单用户场景双重进程是使用失误，rename 原子性已足够。
- [x] **照片怎么办** → **不附带种子照片。** 用 `NoPhotoCard` 兜底。用户自己拍的照片存在 `recipes/{菜谱名}/` 同目录下。
- [x] **推荐算法配置外置** → **`vault/kitchen/config.yaml`**。字段沿用 `RECOMMEND_CONFIG`。首次从 `seed/kitchen/config.yaml` 复制。
- [x] **局域网访问** → 归 [Task/09](./09-local-web-service-✅已完成.md)。本任务默认绑 `localhost` only，不堵死未来 `0.0.0.0` 的可能性。

## 实施前的决策修正（2026-07-26，动手当天核实代码后定）

细化到可执行粒度时，逐文件核对发现原步骤里有 4 处与代码现实冲突。**以下修正优先于上文与下文的原始写法。**

### A. 推荐引擎源码一行不动，名称解析下沉数据层

原 [Task/06](./06-ingredient-name-normalization-✅已完成.md) Step 4 要求把 `tiering.ts:24` 改成按归一化名称建索引。**与本任务「18 个推荐测试一个用例都不许改」的不变量直接冲突**——10 个 tiering 用例喂的是 `inventory_id: 'i1'` 配 `id: 'i1'`，改完会在运行时整体落进「未知食材」分支。

**因此**：vault 读取层构造 `InventoryItem` 时令 `id = normalizeIngredientName(name)`，构造 `recipeIngredients` 时 `inventory_id` 填同一个归一化名称。`tiering.ts` 既有的 `new Map(inventory.map((i) => [i.id, i]))` 于是天然按归一化名称索引，**源码零改动**。已双写进 Task/06 的「决策修正 A」。

### B. 删 `user_id` 会让 18 个测试编译不过——只删 fixture 里的死字段

`tsconfig.json` 的 `include` 是 `**/*.ts`，`next build` 会类型检查测试文件；而三个 fixture helper 写死了 `user_id: 'u1'` / `created_at` / `updated_at`（`tiering.test.ts:8-15`、`:20-33`、`:47`）。字段一删就是 excess property 编译错误。

**因此**（作者确认 2026-07-26）：**只删 helper 里这几行死字段，10 个 `it()` 用例体与全部断言逐字不动。** 改完用 `git diff` 证明只动了这几行。这是「一字不改」这条不变量唯一的、且不触及任何行为的例外。

### C. 库存 / 厨具**没有** ULID，`id` 由加载时合成

[docs/vault-format.md](../docs/vault-format.md) 自相矛盾：§5、§7.1 称库存/厨具/日历条目都有 ULID，但 §3.2/§3.3 的字段表与**全部样例文件里根本没有 `id` 字段**。

**以字段表和样例为准**（它们才是「name 即 join key」这条根本决策的体现）：库存与厨具的 vault 文件**不写 `id`**，`InventoryItem.id` / `Utensil.id` 在读取时合成（库存 = 归一化 name，厨具 = name）。ULID 只用于**菜谱**与**日历条目**——它们确实需要一个不随重命名而变的稳定引用。规范文档 §5 已同步更正。

### D. `(auth)/layout.tsx` 不能 `mv` 成根布局

Step 1b 原文的 `mv src/app/\(auth\)/layout.tsx src/app/layout.tsx` 会**覆盖掉根布局**——现有 `src/app/layout.tsx` 持有 `<html>`/`<body>`、Geist 字体、`AntdRegistry`、`ThemeProvider`，全丢。

**因此**：`(auth)/layout.tsx` **直接删除**，把它里面唯一还成立的东西（`<AppLayout>` 包裹）合并进根布局。

## 交付物

### 主线：单用户本地化

- `src/lib/vault/` —— vault 读写层（解析、序列化、原子写、路径解析、校验与报错）
- 内存数据层 + 缓存失效（**不是** SQLite，除非实测不够）
- A 层 5 个 Service 的签名改造：`fn(supabase, userId, args)` → `fn(vault, args)`
- Server Actions 去掉取用户逻辑
- 路由结构：`(auth)` 路由组解散，页面上移；`/` 直达 `/recommend`
- `seed/` —— 随仓库发布的默认 vault（人工调好档位）+ 首次启动复制逻辑
- `READ_ONLY` 沙盒模式（复用 `app-layout.tsx` 现有 Banner 机制）
- `seed-data.ts` → vault 文件的转换脚本（可重跑，不是一次性手工搬运）
- 测试改造：12 个 service 测试**去掉 mock** 改喂数组；6 个种子质量测试改指向 vault；18 个推荐测试**一行不改**

### 收尾：仍然成立的遗留项

- 分类化的错误处理工具（`src/lib/utils/error.ts`）——**错误分类全部换了一批**，见 §5 P1-2
- 空态组件（`src/components/shared/`，目录已存在待填充）
- 图片压缩（进度条基本不再需要，见 §5 P2-1）
- 购物清单参考价格 `price` 字段
- lint 清零 —— **必须放最后**，理由见 §5 P2-7

### 文档同步（本任务执行完才改，不提前改）

`DESIGN.md`（逐节核对过，别漏）：

| 节 | 要改什么 |
|----|---------|
| §2 核心问题表 | 末行「新用户进来是空的？→ 注册即复制…→ 注册流程」整行重写：没有注册了，改为「开箱自带种子 vault」 |
| §3 整体架构图 | 底部整个 Supabase 方块（RLS / Auth / Storage）换成本地 vault + 派生索引 |
| §4 页面地图 | 删 `/demo`、`/login`、`/register`；「公开 / 需登录」的分组本身也没有意义了 |
| §6 决策表 | **#8**（种子复制 + 外键重映射）、**#9**（Demo 纯前端 fixture）、**#10**（RLS `user_id = auth.uid()`）三条**失效**；**#15**（关联键用名称而非 UUID）从「需统一」改为**已落地**。⚠️ **#11「一期不碰 LLM」仍然有效**，别顺手删了 |
| §7 安全模型 | 四层模型全部消失，换成「无认证，只跑本机」的说明 |
| §8 数据模型 | 表 → vault 文件的映射；`user_id` 字段全消失 |
| §9 部署架构 | Vercel + Supabase + Resend 三件套 → 本地 `npm run dev`；云端仅剩只读沙盒 |
| §10 技术栈 | 删 Supabase / Resend 行；测试行的「39 个单测」数字要按实际更新 |

其余：

- `SPEC.md` —— 全面重写数据层与部署章节（改动量最大的一份）
- `README.md` —— 本地运行章节不再需要 Supabase 三个环境变量；「Demo 模式」那条功能介绍改为只读沙盒链接
- `CONTRIBUTING.md` —— **别漏这份**：:15 和 :18 让贡献者「复制 `.env.example` 填入 Supabase 项目信息」（该文件本任务会删），:35 的「39 个测试必须全绿」数字也会变
- `FUTURE.md` §1.6 ② —— ✅ 已提前标为**已决**（2026-07-26）

> ⚠️ 上面 5 份文档里，`DESIGN.md` / `SPEC.md` / `README.md` / `CONTRIBUTING.md` **都已发布进仓库**。本任务一旦落地而文档没跟上，陌生贡献者照着 README 走的第一步就是去建一个根本不需要的 Supabase 项目。**文档同步不是收尾工作，是交付物的一部分。**

## 操作步骤

> ⚠️ 所有 Step 的验证命令标在末尾。每步做完就跑对应的验证，别攒到最后。

### Step 0 — 零风险预热（可立即做，不依赖 05/06）

1. `eslint.config.mjs` 的 `globalIgnores` 加 `"claude design/**"`。
2. 跑 `npm run lint` 确认：36 errors / 48 warnings → **32 / 32**。

**验证**: `npm run lint` → 32 errors / 32 warnings

---

### Step 1 — 删多用户

> ✅ **无需导出备份**（作者确认 2026-07-26）：Supabase 上没有值得保留的真实数据，直接删。

按 §3「Supabase / 多用户的全部触点」表逐条执行：

#### 1a. 删除文件

```bash
rm src/app/login/page.tsx
rm src/app/register/page.tsx
rm src/app/actions/auth.ts
rm src/middleware.ts
rm src/lib/supabase/browser.ts
rm src/lib/supabase/server.ts
rm src/lib/supabase/middleware.ts
rm src/lib/supabase/service-role.ts
rm -rf supabase/migrations/
rm -rf supabase/.temp/
rm src/lib/services/seed/initUser.ts
rm src/app/demo/page.tsx
rm src/app/demo/layout.tsx
rm src/lib/seed/fixtures.ts
rm .env.example
```

#### 1b. 上移路由组

`src/app/(auth)/` 下的 6 个页面 + `layout.tsx` → 上移到 `src/app/`：

```bash
mv src/app/\(auth\)/calendar   src/app/calendar
mv src/app/\(auth\)/inventory  src/app/inventory
mv src/app/\(auth\)/recipes    src/app/recipes
mv src/app/\(auth\)/recommend  src/app/recommend
mv src/app/\(auth\)/utensils   src/app/utensils
rm src/app/\(auth\)/layout.tsx     # ⚠️ 见「决策修正 D」：不能 mv 成根布局，会覆盖 <html>/字体/AntdRegistry
```

`(auth)/layout.tsx` 里唯一还成立的是 `<AppLayout>` 包裹，合并进现有的 `src/app/layout.tsx`。

#### 1c. 卸载依赖

```bash
npm uninstall @supabase/ssr @supabase/supabase-js supabase
```

#### 1d. 验证

```bash
npm run build          # 必须过（此时应用无数据层，业务跑不通是预期）
npx vitest run src/lib/recommend  # 18 个推荐测试必须全绿
```

---

### Step 2 — vault 读写层

**参考规范**: [docs/vault-format.md](../docs/vault-format.md)（所有实体字段定义）

#### 2a. 安装依赖

```bash
npm install yaml
```

#### 2b. 创建 `src/lib/vault/` 目录结构

| 文件 | 职责 |
|------|------|
| `src/lib/vault/ulid.ts` | ULID 生成器（`generateUlid(): string`） |
| `src/lib/vault/frontmatter.ts` | 从 `.md` 文件拆分 YAML frontmatter + Markdown body |
| `src/lib/vault/schema.ts` | Zod schema——所有实体的校验定义（从 `src/types/index.ts` 翻译，删 `user_id`/`created_at`/`updated_at`，外键改名称引用） |
| `src/lib/vault/config.ts` | vault 路径解析（读 `config.yaml` 的 `vaultPath`，默认 `./data`） |
| `src/lib/vault/reader.ts` | **启动时一次性**：解析全部 vault 文件 → 内存对象（`Recipe[]`、`InventoryItem[]`、`Utensil[]`、`CalendarEntry[]`、别名 `Map`、推荐配置 `RECOMMEND_CONFIG`）。调 schema 校验，失败时抛出指向文件+行号的错误 |
| `src/lib/vault/writer.ts` | 写入单个实体 → 对应的 vault 文件（temp + rename 原子写）。菜谱写入 = 创建 `recipes/{name}/recipe.md` |
| `src/lib/vault/index.ts` | 统一导出 |

#### 2c. ULID 生成器（手写 20 行，不加包）

```ts
// src/lib/vault/ulid.ts
import { randomBytes } from 'crypto';

const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford

function encodeTime(time: number): string {
  // 10 chars for millisecond timestamp
  let str = '';
  for (let i = 0; i < 10; i++) {
    str = BASE32[time & 0x1f] + str;
    time >>>= 5;
  }
  return str;
}

function encodeRandom(bytes: Buffer): string {
  let str = '';
  for (let i = 0; i < 16; i++) {
    str += BASE32[bytes[i] & 0x1f];
  }
  return str;
}

export function generateUlid(): string {
  return encodeTime(Date.now()) + encodeRandom(randomBytes(16));
}
```

#### 2d. frontmatter 解析（手写 10 行）

```ts
// src/lib/vault/frontmatter.ts
import { parse as parseYaml } from 'yaml';

export function parseFrontmatter(mdContent: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const parts = mdContent.split('---', 3);
  if (parts.length < 3 || !parts[0].trim()) {
    throw new Error('Invalid frontmatter: missing --- delimiters');
  }
  return {
    frontmatter: parseYaml(parts[1]),
    body: parts.slice(2).join('---').trim(),
  };
}
```

#### 2e. reader 核心流程

```
启动时:
1. 读 config.yaml → 得到 vaultPath
2. 遍历 vault 目录:
   a. recipes/*/recipe.md → parseFrontmatter → Zod 校验 → Recipe + ingredients + photos
   b. inventory/*.yaml → yaml.parse → Zod 校验 → InventoryItem[]
   c. utensils.yaml → yaml.parse → Zod 校验 → Utensil[]
   d. calendar/*.yaml → yaml.parse → Zod 校验 → CalendarEntry[]
   e. aliases.yaml → yaml.parse → Map<alias, canonical>
   f. config.yaml → yaml.parse → RECOMMEND_CONFIG
3. 全部在内存，不做 SQLite
4. 索引: Map<recipeName, Recipe>、Map<normalizedName, InventoryItem> 等
```

**验证**: `npm run build` 通过；写一个临时测试脚本读 `docs/vault-examples/` 验证解析正确。

---

### Step 3 — A 层 Service 改造 + 测试重写

#### 3a. 改 Service 签名

5 个 Service 文件的签名从 `fn(supabase, userId, args)` → `fn(vault, args)`：

| 文件 | 改动 |
|------|------|
| `src/lib/services/recipe/index.ts` | 删 `supabase` 和 `userId` 参数；`listRecipes` 从 vault 内存数组筛选；`getRecipeDetail` 从 vault `Map` 取；`createRecipe`/`updateRecipe`/`deleteRecipe` 调 vault writer |
| `src/lib/services/inventory/index.ts` | 同上；`batchUpdateStockLevel` 改写成写 `inventory/*.yaml` |
| `src/lib/services/calendar/index.ts` | 同上 |
| `src/lib/services/shopping/index.ts` | 同上；购物清单生成只需库存数组 + 菜谱食材名，不依赖 Supabase |
| `src/lib/services/utensil/index.ts` | 同上 |

#### 3b. 改 Server Actions

| 文件 | 改动 |
|------|------|
| `src/app/actions/calendar.ts` | 删 `supabase.auth.getUser()`，直接用 vault |
| `src/app/actions/inventory.ts` | 同上 |
| `src/app/actions/recipe.ts` | 同上 |
| `src/app/actions/utensil.ts` | 同上 |
| `src/app/actions/recommend.ts` | 同上 |

#### 3c. 路由改造

- `src/app/layout.tsx`：删 `(auth)` 路由组相关逻辑，`/` 直达 `/recommend`
- `src/components/layout/app-layout.tsx`：删 `user` prop、`GuestNav`、登出按钮、`signOut`

#### 3d. 测试重写

| 文件 | 操作 | 说明 |
|------|:--:|------|
| `src/lib/services/inventory/__tests__/inventory.test.ts` | 🔄 重写 | 去掉 supabase thenable mock，直接喂 `InventoryItem[]`，测纯逻辑 |
| `src/lib/services/shopping/__tests__/shopping.test.ts` | 🔄 重写 | 同上 |
| `src/lib/services/seed/__tests__/initUser.test.ts` | 🔄 拆开 | 删 3 个 hash 档位分配测试；6 个种子数据质量测试改指向 `seed/` vault 文件 |
| `src/lib/recommend/__tests__/tiering.test.ts` | ✅ 不动 | 10 个测试，一字不改 |
| `src/lib/recommend/__tests__/scoring.test.ts` | ✅ 不动 | 8 个测试，一字不改 |

**验证**: `npx vitest run` 全绿，尤其确认 18 个推荐测试逐字未改。

---

### Step 4 — 种子 vault

#### 4a. 创建 `seed/` 目录结构

按照 [docs/vault-format.md](../docs/vault-format.md) §2 的目录布局，在 `seed/kitchen/` 下创建：

```
seed/
  kitchen/
    recipes/          # 54 个菜谱子目录（从 seed-data.ts 转换）
      红烧肉/recipe.md
      宫保鸡丁/recipe.md
      ...（共 54 个）
    inventory/        # 5 个分类文件，档位人工调好
      vegetable.yaml
      meat.yaml
      egg_dairy_bean.yaml
      staple.yaml
      seasoning.yaml
    utensils.yaml     # 厨具
    calendar/         # 几条示例日历记录
      2026-07.yaml
    log/              # 空或几条示例
      2026-07.jsonl
    aliases.yaml      # 从 Task 06 产出
    config.yaml       # 推荐配置
```

#### 4b. 种子档位手工调优

**这是关键——不能依赖 hash 碰运气。** 调整目标：
- 三档推荐「现在就能做」有 4 道以上菜、「差 1-2 样」有菜、「清库存」有菜
- 几个 `stock_level: enough` 的食材 `last_restocked_at` 设为足够久以前（触发清库存）
- 几条 `low` / `out` 的食材保证有「缺料」菜谱

#### 4c. 转换脚本

**文件**: `scripts/parse-howtocook.ts`（修改现有脚本）

原来生成 `seed-data.ts` → 现在生成 `seed/` vault 文件。脚本保留可重跑。

#### 4d. 首次启动复制

**文件**: `src/lib/vault/init.ts`

```ts
// 伪代码
if (!exists(dataDir)) {
  copyRecursive('seed/', dataDir);
}
```

在应用启动时调用（Next.js instrumentation 或在 vault reader 初始化前）。

#### 4e. `.gitignore`

```
data/
```

`seed/` 进 git，`data/` 不进。

**验证**: `rm -rf data/ && npm run dev` → 打开浏览器看到有内容的推荐页，三档都有菜。

### Step 5 — 只读沙盒

1. `READ_ONLY` 环境变量：所有写路径统一拦截并优雅报错（**不是**抛未捕获异常）。
2. 复用 `app-layout.tsx:252-256` 的 Banner，文案从「Demo 演示数据」改为只读沙盒提示。
3. View 组件的 `readOnly` prop **已全部就位**（`RecommendView` / `InventoryView` / `UtensilsView` / `CalendarView`），直接接上即可。
4. 部署到 Vercel 验证。

### Step 6 — 遗留项打磨（顺序不可调）

1. 错误处理分类（新的一批类型，见 §5 P1-2）
2. 空态组件
3. 图片压缩
4. 购物清单 `price`
5. **lint 清零放在最后**。理由（实测）：32 个 error 里 **25 个**在本任务会删掉或重写的文件中——`actions/inventory.ts`(4)、`actions/recipe.ts`(3)、`initUser.ts`(2)、两个 service 测试(8)、7 个页面组件的 `set-state-in-effect`(8)。**提前清就是白清两遍。**

## 验收标准

- **一台没装过 Supabase、没有任何 key 的干净机器上**：`git clone` → `npm install` → `npm run dev` → 打开浏览器**立刻**看到有内容的推荐页，三档都有菜，无任何配置步骤
- **断网后全部功能可用**（AI 功能除外，那需要 BYOK）
- 全仓库 `grep -ri supabase src/` **零结果**；`package.json` 无 supabase 相关依赖
- 手工在编辑器里改一个 vault 文件里的 `stock_level`，刷新页面推荐结果随之变化
- 故意把一个 vault 文件改成非法 YAML，应用给出**指明文件与位置**的可行动报错，而不是白屏或堆栈
- 写入过程中强制杀进程，vault 文件不出现损坏（原子写生效）
- `npm run build` 无错误；`npx vitest run` 全绿
- **18 个推荐引擎测试（`tiering` 10 + `scoring` 8）逐字未改且全绿** —— 这是核心价值没被改坏的唯一硬证据
- **6 个种子数据质量测试改指向 `seed/` vault 后全绿** —— 证明 54 道菜谱在格式转换中没掉东西
- 种子 vault 实际内容与代码一致：**54 道菜谱 + 48 种食材**（不是任何文档里曾出现过的「215」，见 §3）
- `npm run lint` **0 error**
- `READ_ONLY=1` 下所有写入被优雅拒绝并有明确提示，无未捕获异常
- 断网 / 文件损坏 / 输入非法 三种情况下报错文案各不相同且可行动
- 列表页在「无数据」下有设计过的样子（空态，非空白）

## 风险与不做什么

- ⚠️ **最高风险项已经变了。** 原本是「数据搬家」，但云端没有真实数据，那条风险归零。**现在的最高风险是「推荐引擎在换数据层的过程中被悄悄改坏」**——它是本项目的核心价值，而且坏得不明显：推荐照常出结果，只是结果变差了，人眼看不出来。
  > **逃生舱：18 个推荐测试（`tiering` 10 + `scoring` 8）完全独立于数据层，改造全程必须保持全绿，且一个用例都不许改。** 一旦你发现「得改测试才能过」，那就是在改推荐行为，停下来先想清楚。
  > 次级兜底：全部改动在 git 里；Supabase 项目不必立刻销毁。
- ⚠️ **第二风险：种子数据在格式转换中悄悄掉东西。** 957 行 TS → vault 文件是机械转换，但「机械」不等于「无损」。**逃生舱：6 个种子质量测试改指向 vault 后必须全绿**（5 分类齐全、菜谱 ≥30、食材名匹配率 >95%、每道菜都有 attributes 和至少一个食材）。
- ⚠️ **`set-state-in-effect`（8 处）不是格式问题**，可能指向真实缺陷。这些文件本任务都会动，**顺手看懂再改，别用 `eslint-disable` 焊死 bug。**
- **不做**移动端适配。本地 Web 服务下手机够不到本地文件，这是已知代价（[FUTURE.md](../FUTURE.md) §1.6 ③）。若最终开放局域网访问，手机浏览器能连算附带收获，不是承诺。
- **不做**同步机制。走 BYO（vault 扔进 iCloud / Dropbox，或用 git）。**不要自己写同步**——那是 Obsidian 都要收费的难题。
- **不做**桌面端打包（Tauri / Electron），已明确短期不做。
- **不做**任何为二期 AI 准备的改动——那些在 [Task/10](./10-memory-layer.md) 之后。
- **不做**「保留一个登录以防万一」。半个认证系统比没有认证更危险：它会让人以为数据被保护着。要么没有认证 + README 明确说明只跑 localhost，要么交给反向代理（Tailscale / Cloudflare Access）。
- **不重构** Service 层的职责划分。改的是签名和后端，不是 A/B 分层结构——那个结构是一期验证过的资产（[FUTURE.md](../FUTURE.md) §4.1）。

---

## 附：原「一期遗留问题」清单的逐条处置

原任务的全部条目来自 PRD v2 §9.3 / §9.4。本地化改造让其中**一半失去了对象**。逐条交代，避免有人日后翻出旧 PRD 照着做已经不存在的功能。

### P1

| # | 原问题 | 处置 | 说明 |
|---|--------|:----:|------|
| 1 | Demo 页缺顶部提示 Banner | ✅ **已完成** | Task/01 已加，`app-layout.tsx:252-256`。Demo 页本身即将删除，Banner 机制转为 `READ_ONLY` 沙盒复用 |
| 2 | 错误处理不区分类型 | 🔄 **保留但换内容** | 见下 |
| 3 | 注册成功无通知 | ❌ **消失** | 没有注册了 |
| 4 | Supabase Auth Rate Limit（30 注册/小时） | ❌ **消失** | 没有 Supabase Auth 了 |

**P1-2 的错误分类整批换掉**。原建议是「网络错误 / 权限错误（RLS 拒绝）/ 校验错误 / 未知错误」——本地化后前两类基本不存在，新的分类应是：

| 新分类 | 典型场景 | 文案要点 |
|--------|---------|---------|
| **vault 文件格式非法** | 用户手改坏了 YAML / frontmatter | **必须指出哪个文件、哪一行**——这是「你能自己改文件」承诺的兑现处 |
| **文件读写失败** | 权限不足、文件被别的进程占用、磁盘满 | 给出 vault 路径，说明是环境问题不是数据问题 |
| **数据校验错误** | 表单输入非法、菜谱引用了不存在的食材 | 可重试，指向具体字段 |
| **只读模式拒绝** | 沙盒里尝试写入 | 说明这是演示实例，引导去本地部署 |
| **未知错误** | 兜底 | 至少给出可复制的错误信息 |

### P2

| # | 原问题 | 处置 | 说明 |
|---|--------|:----:|------|
| 1 | 图片上传无压缩 / 无进度条 | 🔄 **压缩保留，进度条基本不必** | 不再是网络上传，是本地文件写入（毫秒级）。压缩仍要做——省磁盘、加载快 |
| 2 | 推荐算法配置需改代码 | ✅ **决策已收敛** | 原「Settings 页 / `.env` / vault 配置文件」三选一，现自动定为 **vault 配置文件** |
| 3 | 购物清单无参考价格 | 🔄 **保留** | 不受本地化影响，加 optional `price` 字段 |
| 4 | Loading / 空态提示不足 | 🔄 **空态保留，骨架屏缩水** | 本地读取无网络延迟，骨架屏可能根本闪不出来。空态仍然重要：圆形图标 + 一句「为什么要填」+ 单一主行动（设计稿 3o 规范） |
| 5 | `initUser.ts` 用 for 循环 insert | ❌ **消失** | 整个文件删除。种子初始化改为**复制文件目录**，外键重映射这个最易错的环节随之整体消失 |
| 6 | SPEC.md 推荐配置记载与代码不符 | ✅ **已修复** 2026-07-26 | 见下 |
| 7 | `npm run lint` 跑不干净 | 🔄 **保留，但必须最后做** | 数据已更正，见 §3 ② 与 Step 6.5 |

### P2-6 的记录与那条教训（保留，不要删）

`SPEC.md` §6 曾写 `novelty 0.4 / clearStock 0.3 / timeMatch 0.15 / nutrition 0.15`、`TOP_N_PER_TIER = 5`；而 `src/lib/recommend/config.ts` 实际是 `noRepeat 0.35 / clearStock 0.25 / timeMatch 0.20 / nutritionBalance 0.20`、`topPerTier: 4`、`maxMissingForShopping: 3`。已以代码为准改写 SPEC.md，常量名对齐为实际的 `RECOMMEND_CONFIG` 结构。`docs/recommend-algorithm.md` 的数值本来就是对的。

顺带修掉：`src/lib/recommend/config.ts` 顶部注释原为「二期将由 LLM 决策取代」，与 [DESIGN.md](../DESIGN.md) §1.3 的战略纠正（LLM 增强而非替换 B 层）矛盾，已一并改写。

> ⚠️ **教训（2026-07-26）——这条比它修的 bug 更重要，永久保留**
>
> 本条原文写着「这条要在 [Task/03](./03-open-source-essentials-✅已完成.md) 把 SPEC.md 提交进仓库**之前**修掉」。**执行 Task 03 时没人读到这句，错数据确实被发布了**（提交 `fe68c0c`），事后才补修。
>
> **根因**：跨任务的前置条件写在了**被依赖方的正文里**，而执行方没有理由去翻它。
>
> **今后**：任何「必须在任务 X 之前完成」的约束，必须**同时写进 X 的操作步骤或验收标准**。否则等于没写。
>
> **本任务已照此执行**：对 05 / 06 的依赖已双写进 [Task/05](./05-vault-format-spec-✅已完成.md) 和 [Task/06](./06-ingredient-name-normalization-✅已完成.md) 的正文抬头，而不是只写在这里。

### 又一次同类事故：「215 种食材」（2026-07-26 发现）

**这条教训刚写完就又犯了一次，所以记下来。**

细化本任务时实测 `src/lib/seed/seed-data.ts`，发现种子食材实际是 **48 种**，不是各处文档写的 **215 种**：

```
seedIngredients: 48   （vegetable 18 / seasoning 17 / meat 7 / egg_dairy_bean 3 / staple 3）
seedRecipes:     54   ✅ 这个数字是对的
菜谱食材引用总数: 308  ← 「215」也对不上这个
```

错误源头是 `claude design/design_handoff_cook_helper v2/00_PRD_v2.md`（已过期的旧 PRD），从那里扩散进了 **DESIGN.md、SPEC.md（各 1 处 / 3 处，均已发布进仓库）、FUTURE.md 和 6 个任务文件**。原 Task 04 的验收标准里那条「新用户注册后 54 道菜谱 + 215 种食材正确复制」——**是一条永远不可能通过的验收标准**。

**已全部更正为 48**（`claude design/` 里的旧 PRD 未改，它是已标注过期的污染源，且在 `.gitignore` 中）。

> **共同根因（与 P2-6 完全一致）**：数字被从别的文档抄进来，**没有一次是去代码里数的**。
>
> **今后**：文档里任何**可数的数字**（条数、行数、测试数、错误数），写进去之前必须有一条能复现的命令产出它，并把命令一起写在旁边。本任务 §3 的所有数字都是这么来的。

> **已在别处处理，本任务不含**：`recipes/page.tsx` 拆分 → [Task/02](./02-recipes-calendar-redesign-✅已完成.md)。
> **注**：`.env.example`（[Task/03](./03-open-source-essentials-✅已完成.md) 建的）本任务**要删掉**，已列进 §3 的表——不再有任何必填 key，留着会误导人以为需要配置。

---

## 🚧 实施记录：Step 0–4 已完成（2026-07-26）

> **执行人**: Claude Code
> **状态**: **未完结**。Step 0–4 落地，**Step 5（只读沙盒）、Step 6（遗留打磨 + lint 清零）、以及全部文档同步未做**——未做的部分见文末「剩余工作」。

### 执行摘要（数字均为实测）

| 检查项 | 改造前 | 改造后 |
|--------|:--:|:--:|
| `npx vitest run` | 5 files / 39 tests 全绿 | **6 files / 74 tests 全绿** |
| `npm run lint` | 36 error / 48 warn | **15 error / 18 warn**（Step 0 先降到 32/32，删多用户代码又消掉 17 个 error） |
| `npm run build` | 通过 | **通过**（含 TypeScript 全量检查） |
| `grep -ri supabase src/` | 大量命中 | **零结果** |
| `package.json` 的 supabase 依赖 | 3 个 | **0 个** |
| 新增运行时依赖 | — | **`yaml` + `zod`**（zod 见下方偏差说明） |

### 核心不变量的兑现情况

| 不变量 | 结果 |
|--------|:--:|
| **18 个推荐测试全绿** | ✅ tiering 10 + scoring 8 |
| **推荐引擎源码零改动** | ✅ `tiering.ts` / `scoring.ts` / `config.ts` 逻辑一行未动 |
| **18 个用例逐字未改** | ⭕ 用例体与断言逐字未改；仅删掉 fixture 里已不存在的 `user_id` 字段（决策修正 B，作者确认）。`git diff` 里这两个文件只有 `user_id` 的增删行 |
| **6 个种子质量测试改指向 vault 后全绿** | ✅ 见下 |

### 落地的主要产物

| 文件 | 说明 |
|------|------|
| `src/lib/vault/{errors,ulid,frontmatter,schema,paths,reader,writer,init,store,index}.ts` | vault 数据层：解析 / Zod 校验 / 原子写 / 首启复制 / 内存缓存 |
| `src/lib/vault/__tests__/make-test-vault.ts` | 临时目录 vault 工厂，service 测试用它替掉了手搓的 thenable mock |
| `src/app/api/photo/route.ts` | 照片读取端点（含路径越界防护），顶替 Supabase Storage 的公开 URL |
| `seed/`（54 菜谱 + 49 食材 + 4 厨具 + 4 日历 + 别名表 + 配置） | 随仓库发布的默认 vault |
| `seed/README.md` | 种子怎么调、`last_restocked_at` 的坑 |
| `src/lib/seed/__tests__/seed-vault.test.ts` | 种子质量 7 条 + 首屏三档质量 4 条 |

### 首屏推荐实测（`rm -rf data/ && npm run dev` 后的真实结果）

```
菜谱 54 道，全部进档：现在就能做 31 · 该清库存 15 · 差一点 8
首屏展示：4 + 4 + 4，缺料提示为「缺: 虾 / 鸭 / 豆干 / 西兰花」，零「未知食材」
```

浏览器实测通过的还有：点击库存档位 → YAML 文件即时改写且无 `.tmp` 残留；在编辑器里手改 `stock_level` → 刷新页面数字随之变化；故意用 Tab 缩进破坏 YAML → 抛出带**文件名 + 行号 + 「YAML 只认空格」提示**的 `VaultError`。

### 与原计划的偏差（全部是实施中撞到现实后改的）

| # | 原计划 | 实际做法 | 原因 |
|---|--------|---------|------|
| 1 | 仅新增 `yaml` 一个依赖，zod「已在 node_modules，不是新依赖」 | **`npm install zod`，列为直接依赖** | 它当时只是 Next.js 的**传递依赖**。靠传递依赖吃饭，上游哪天换实现就当场炸掉，这与「clone 完就能跑」直接冲突 |
| 2 | `parse-howtocook.ts` **改产物**为直接生成 vault | 未改。另写 `seed-to-vault.ts` 完成转换，**转换完连同 `seed-data.ts` 一起删除** | 该脚本从来就没有生成过 `seed-data.ts`（它只打印解析摘要），所以「改产物」无从改起。转换完成后 vault 即唯一真相，**保留 957 行 TS 副本等于第二个数据源**——本项目已被「两处数据源不同步」坑过两次（P2-6、215 vs 48）。手工调档位的理由与规则移进了 `seed/README.md`，那才是下一个人会去看的地方 |
| 3 | frontmatter 用 `content.split('---', 3)` | 按行扫描定位闭合分隔符 | 原写法是**错的**：JS 的 `split` 带 limit 会丢掉剩余内容，正文里再出现一条 `---` 就会被截断 |
| 4 | ULID 时间戳编码用 `time >>>= 5` | 改用 `Math.floor(time / 32)` | 原写法是**错的**：`>>>` 在 32 位处截断，而毫秒时间戳有 48 位，生成的 ID 会撞车且不再单调 |
| 5 | 库存 / 厨具带 ULID | 文件里不写 id，读取时按名称合成 | 规范自相矛盾，已修正（Task/05 完成记录 §1） |
| 6 | `mv (auth)/layout.tsx → app/layout.tsx` | 删除并把 `<AppLayout>` 合并进根布局 | 原写法会**覆盖根布局**，丢掉 `<html>`/字体/`AntdRegistry`/`ThemeProvider`（决策修正 D） |
| 7 | 内存缓存加载一次 | 加载后按「文件数 + 最新 mtime」签名做 500ms 节流校验，变了就重读 | 否则「在编辑器里手改文件 → 刷新页面生效」这条**验收标准直接不成立**——一个永不失效的缓存会把本项目的核心承诺变成谎言 |
| 8 | 日志 `log/*.jsonl` 写进种子 | **未创建** | 目前没有任何代码读或写烹饪日志。凭空造几行假日志属于伪造数据，等真有人写它时再说 |

### 剩余工作（下一轮）

- **Step 5 只读沙盒**：`READ_ONLY` 的**拦截与 Banner 已就位**（`assertWritable()` + `AppLayout readOnly` prop），未做的是 Vercel 实际部署与验证。
- **Step 6 遗留打磨**：错误分类 UI、空态组件、图片压缩、购物清单 `price`、lint 清零。
  > 剩余 15 个 lint error 全部落在 7 个页面组件里（`set-state-in-effect` 7 处 + `no-explicit-any` 7 处）+ `parse-howtocook.ts` 1 处，正是 Step 6.5 说的「留到最后一起清」的那批。**新写的 vault 层与 service 层零 lint error。**
- **⚠️ 文档同步（未做，且现在是最紧的一件）**：`DESIGN.md` / `SPEC.md` / `README.md` / `CONTRIBUTING.md` 四份**已发布进仓库**的文档仍在描述 Supabase 云端多用户形态。README 现在会让陌生贡献者去建一个根本不需要的 Supabase 项目。**这批改动提交前必须先把这四份文档改掉**，否则就是本任务 §5 P2-6 那条教训的第三次重演。
- **VaultError 的用户可见形态**：结构化错误（kind / file / line / field / hint）已经产出，但目前只到服务端日志，浏览器看到的仍是 Next 的报错页。把它渲染成人话属于 Step 6 的错误分类工作。

---

## ✅ 完成记录（Step 5 / 6 / 文档同步，2026-07-26）

> **执行人**: Claude Code
> **本条覆盖**: Step 5 只读沙盒、Step 6 遗留打磨、以及四份已发布文档的同步。
> Step 0–4 的记录见上一节。

### 执行摘要

| 检查项 | 会话开始时 | 现在 |
|--------|:--:|:--:|
| `npx vitest run` | 39 passed | **94 passed**（9 个文件） |
| `npm run lint` | 36 error / 48 warn | **0 error** / 17 warn |
| `npm run build` | 通过 | 通过（含 TypeScript 全量检查） |
| `grep -ri supabase src/` | 大量命中 | 零结果 |

### Step 5 — 只读沙盒（代码完成，部署待作者执行）

| 项 | 状态 |
|----|:--:|
| 服务端拦截 `assertWritable()`（15 个写函数全覆盖） | ✅ |
| 只读状态从服务端注入客户端（`ReadOnlyProvider` + `useReadOnly()`） | ✅ |
| 顶部横幅复用 `AppLayout` 既有机制 | ✅ |
| 四个 View 的 `readOnly` 接上（原来只有 prop、没人传） | ✅ |
| 文案换掉「请登录后…」（已经没有登录了） | ✅ |
| 只读模式下 vault 根指向 `seed/`，不尝试复制 | ✅ |
| 5 个自动化测试（拒绝写入 + 不落盘 + 文案是引导而非堆栈） | ✅ |
| **实测**：`READ_ONLY=1` 起服务 → 横幅出现 → 点击写操作 → `seed/` 校验和不变、无 `.tmp` 残留 | ✅ |
| **部署到 Vercel 并验证线上** | ⬜ **需要作者的 Vercel 账号，步骤见 [SPEC.md](../SPEC.md) §10.2** |

### Step 6 — 遗留打磨

| # | 项 | 结果 |
|---|----|------|
| 1 | 错误处理分类 | `src/lib/utils/error.ts`：5 类（`vault_format` / `validation` / `io` / `read_only` / `unknown`）+ `guardData` / `guardResult` 两个 Server Action 外壳。**所有 action 已接上**——vault 加载失败现在返回人话错误，而不是把异常抛穿到 Next 的报错页 |
| 2 | 空态组件 | `src/components/shared/EmptyState.tsx`（图标 + 为什么要填 + 单一主行动），已接入库存 / 厨具 / 菜谱三处，替掉了原来的「暂无食材」一行字 |
| 3 | 图片压缩 | `src/lib/utils/compress-image.ts`（长边 1600px / JPEG 0.82，压不小或失败就用原图）。**顺带把上传本身接通了**——详情弹窗里的「📷 加照片」原来是个什么都不做的装饰徽章，`uploadRecipePhotoAction` 是 UI 从未调用过的死代码 |
| 4 | 购物清单参考价 | 库存加可选 `price` 字段（vault schema / 表单 / 清单展示 / 合计），并标注「N/M 项有参考价」，免得看着偏低的合计以为是全部花销 |
| 5 | lint 清零 | **36 error → 0 error**（详见下） |

### lint 是怎么清到 0 的（没有一处 `eslint-disable`）

| 规则 | 数量 | 处理方式 |
|------|:--:|------|
| `@typescript-eslint/no-explicit-any` | 7 | 补上真实类型（表单值接口 / 筛选参数类型），不是 `as unknown as` 一把梭 |
| `react-hooks/rules-of-hooks` | 4 | **我自己引入的真 bug**：`readOnlyProp ?? useReadOnly()` 会短路掉 hook 调用。改成无条件先调 hook |
| `react-hooks/set-state-in-effect` | 8 | 改成**带取消标记的内联 async IIFE**。这不是绕过——它顺带修好了「筛选连续变化时旧请求覆盖新结果」和「卸载后仍写状态」两个真实竞态。详情弹窗则改用 `key={recipe.id}` 让组件重挂载，去掉了「props 变了手动重置 state」这个 React 官方点名的反模式 |
| 其它 error | 1 | `scripts/parse-howtocook.ts` 里一处多余的 `as any` |

> 剩下 17 个 warning 全是历史遗留的 `no-unused-vars`（含刻意的 `_loading` 约定），不阻断。

### 顺带修掉的一个真 bug

写照片删除测试时发现：**`rmSync(文件路径, { force: true })` 在 Windows + Node 23 上静默不删也不报错**。
删照片会返回成功、frontmatter 记录消失，但**文件永远留在磁盘上变成孤儿**。已改用 `unlinkSync`，
并留了注释说明原因。没有这个测试，这个 bug 会一直躺着。

### 文档同步（本任务最紧的一块，已完成）

| 文档 | 改了什么 |
|------|---------|
| `README.md` | 重写。删掉 Supabase 三个环境变量与 `.env.example` 步骤，改为「三行命令、零配置」；新增「你的数据是一堆你能读懂的文件」一节 |
| `CONTRIBUTING.md` | 本地跑起来不再需要任何 key；测试数 39 → 94 并点名 18 个推荐测试是回归基准；lint 要求从「别引入新的」改为「0 error」；新增「数据是纯文本文件，不是数据库」一条约定 |
| `DESIGN.md` | v1.2 → **v2.0**。§2 核心问题表、§3 架构图（Supabase 方块 → vault 数据层 + 本机磁盘）、§4 页面地图（删 `/demo` `/login` `/register`）、§6 决策表（#8/#9/#10 标失效并给出替代，#15 标已落地，新增 #18–#20）、§7 安全模型（**战略纠正块** + 无认证模型）、§8 数据模型（表 → 文件）、§9 部署架构（**战略纠正块** + 本地为主 / 沙盒为辅）、§10 技术栈、§11 分期 |
| `SPEC.md` | v1.0 → **v2.0**，整篇重写。§2 数据库设计 → vault 数据设计（关联键规则、内存 Vault 形状、校验与报错、写入策略）、§3 路由（去守卫，新增数据加载约定）、§4 Actions、§5 Service 签名 `fn(vault, args)`、§7 Supabase Client → vault 数据层、§9 文件树、§10 部署、§11 测试（逐文件用例数）、§12 种子数据 |
| `FUTURE.md` | v2.0 → v2.1，§1.6 ② 补落地状态（代码完成，只差 Vercel 部署） |

> ⚠️ 两处**战略纠正块**（DESIGN §7 安全模型、§9 部署架构）按规范保留了旧说法的原文与废弃理由，
> 没有静默删除——因为旧 PRD 和早期提交里还留着那套说法。

### 剩余工作

- ✅ **只读沙盒的实际部署** → 已拆成 [Task/15](./15-readonly-sandbox-deploy-✅已完成.md)，**2026-07-27 上线完成**，
  <https://cook.wreathmoon.com> 6 条验收全过
- ⬜ 17 个 `no-unused-vars` warning（不阻断，随手清即可）—— **仍未处理**，实测确认仍是 17 个
- ✅ **旧 Supabase 凭据已彻底清除（2026-07-27，作者执行）**：`.env.local` 已删除（实测文件不存在），
  且作者已在 Supabase 控制台**删掉整个项目**——这一步才是真正吊销 `SUPABASE_SERVICE_ROLE_KEY` 的动作。
  另核实：该文件**从未被提交过**（`git log --all -- .env.local` 为空），历史里没有泄漏。
- ✅ **VaultError 的用户可见形态**（原列在 Step 0–4 的剩余工作里）：错误分类已在 Step 6 完成，
  但「用户真的看得见」这最后一米直到 2026-07-27 才通——`message.*` 整体失效，见 [Task/16](./16-global-ui-defects-✅已完成.md)

---

## 📌 完成记录之后的补记（2026-07-26 同日，提交环节）

写完上面那份记录之后又发生了三件事，记在这里而不是改上面——上面那份是「实施当时」的快照。

### ① 落库：4 个提交

| commit | 内容 |
|--------|------|
| `75ae15f` | `feat!: 去多用户，数据层改为本机纯文本 vault`（含 Task 05/06 产出、Step 0–6） |
| `040413d` | `docs: 四份已发布文档同步到本地化形态` |
| `748a6a0` | `chore: 删除遗留的 supabase migrations`（前一个提交的 pathspec 漏了 `supabase/`） |
| `0ebc263` | `fix: 把 seed/ 强制打进 serverless 产物`（见下，**这是个真问题**） |

合计 158 files changed, +7467 / −4400。提交后重新验证：94 tests 全绿、构建通过。
**尚未 push。**

> 「合并主分支」这一步实测**无对象**：本来就在 `master` 上，`master == origin/master`，
> 另外两个分支（`wt/recommend-redesign`、`wt/fe-redesign`）相对 master 领先 0 个提交，
> 早已并入。没有造空的 merge commit。

### ② 发现并修掉一个会让沙盒部署直接 500 的问题

**症状（未修时）**：只读沙盒部署到 Vercel 后，每个页面都会 `ENOENT`。

**根因**：`READ_ONLY=1` 时 vault 根指向 `seed/`，而读取路径是
`path.join(process.cwd(), 'seed')` **动态拼出来的**——Next 的静态文件追踪（nft）看不见它，
默认不会把这 64 个文件打进 serverless 产物。本地 `npm run dev` 永远发现不了，
因为本地就在项目目录里跑。

**修法**（`next.config.ts`，已查过 `node_modules/next/dist/docs/…/output.md` 确认 API）：

```ts
outputFileTracingIncludes: {
  "/**": ["./seed/**/*"],
}
```

key 是**路由 glob**（picomatch 匹配路由路径）。用 `/**` 而不是文档举例的 `/*`——
后者按 picomatch 语义只匹配单层路径，`/recipes/new` 和 `/api/photo` 会漏掉。

**验证**：构建后逐个检查 `.next/server/app/**/*.nft.json`，每条路由都包含 **64 个 seed 文件**
（54 菜谱 + 5 库存分类 + 厨具/别名/配置/日历/README），数量与 `seed/` 实际文件数一致。

> **教训**：**「本地跑得通」对「读运行时文件」这类代码不构成部署可行的证据。**
> 凡是用 `process.cwd()` 拼路径读文件的地方，都要单独确认它进没进部署产物。

### ③ `READ_ONLY=1` 是必填项，不是可选项

原完成记录和 SPEC §10.2 都把它写成「加一条环境变量」，语气像是可选。实际上**忘了设就整站起不来**：
`ensureVaultInitialized()` 会尝试把 `seed/` 复制成 `data/`，而 Vercel 的文件系统只读 → `EROFS`。
这条已写进 [Task/15](./15-readonly-sandbox-deploy-✅已完成.md) 的「风险与不做什么」。
