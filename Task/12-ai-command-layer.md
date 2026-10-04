# 12 — AI 命令层（function calling + BYOK）

> **状态**: **代码已落地，待真机验收**（决策全部定稿，见文末执行记录）
> **依赖**: 10 ✅、11 ✅
> **阶段**: 二期 AI
>
> ⚠️ **依赖变更（2026-08-05）**：本任务原本只依赖 10。现在也依赖 [Task/11](./11-ai-capture.md)——
> 11 建的 **provider 层**（`src/lib/ai/`：OpenAI 兼容端点 + BYOK + 模型角色）是项目第一次真正发出模型请求，
> 本任务直接复用，不重建。11 同时替本任务结掉了三条待决问题：provider 选型、SDK 选型、key 存哪。
>
> ⚠️ **记忆的生效逻辑在本任务，不在 10。** Task/10 交付了格式、存储、检索、管理页与免责声明，
> 但**记忆在此之前不改变任何推荐结果**——管理页上那些「未生效」的标注，是在这里才变成「生效中」的。

## 目标

在现有 GUI **之上**加一层自然语言命令入口，专治 GUI 难表达的查询与多步操作；
并让 [Task/10](./10-memory-layer-✅已完成.md) 的记忆真正开始影响结果。

## 为什么做

对话式 UI 不是普遍更优，但它在一类意图上无可替代——**模糊的、多步的、低频的**：

> 「帮我排一周的菜，避开我最近吃过的，用掉那块快坏的猪肉，周三要快手」

这个需求用现有筛选器**表达不出来**：它同时涉及日历历史、库存陈旧度、时长偏好和跨天规划。而这正是 LLM 擅长的编排。

反过来，**浏览**菜谱瀑布流吊打聊天框，**一眼看**库存状态吊打问 bot。所以定位是**加速器，不是替代品**——参照 Linear / Raycast / Arc（[DESIGN.md](../DESIGN.md) §1.3、§13 反模式 1）。

## 现成的地基（一期已经铺好了）

这是一期架构决策的回报——**A 层纯函数天生就是 agent 的工具集**：

```
src/lib/services/inventory/  listInventory / addInventoryItem / updateInventoryItem /
                             batchUpdateStockLevel / updateStockOnCook / markRestocked …
src/lib/services/recipe/     listRecipes / getRecipeDetail / createRecipe …
src/lib/services/calendar/   getCalendarEntries / addCalendarEntry / completeEntry …
src/lib/services/shopping/   generateShoppingList / checkoutShoppingList
src/lib/services/utensil/    listUtensils / addUtensil / deleteUtensil
```

签名统一为 `fn(vault, args)`，**直接可包成 tool**。这正是 [DESIGN.md](../DESIGN.md) §6 #5 那条决策的兑现。

> ⚠️ **文案更正（2026-08-05）**：本行原写「签名统一为 `fn(supabase, userId, args)`」。那是
> [Task/04](./04-single-user-local-✅已完成.md) 把 Supabase 整块删掉**之前**的形状——实际签名早已是
> `fn(vault, args)`（核实：`src/lib/services/inventory/index.ts:19` 等全部导出函数）。
> 结论不变（A 层天生适配 tool），但**别照着旧签名写 tool 定义**。同一处陈旧文案也存在于
> [FUTURE.md](../FUTURE.md) §3.2，已一并更正。

---

## 关键决策（已定稿）

### ① 入口形态：全局命令栏（⌘K）

- [x] 命令栏，不是侧边抽屉、不是页内输入框、更不是 `/chat` 全屏页。

**形态本身就是一句声明**：命令栏盖在现有 GUI 之上、随手唤出、用完消失。全屏聊天页会宣告「对话才是主入口」，那正是 [DESIGN.md](../DESIGN.md) §13 反模式 1 明确拒绝的方向。

配套：侧边栏放一个**看得见的入口按钮**。只有快捷键的功能等于不存在——没人会去猜 ⌘K。

### ② provider / SDK / key —— 由 [Task/11](./11-ai-capture.md) 结掉，本任务沿用

- [x] provider 中立的 OpenAI 兼容端点（`AI_BASE_URL` + `AI_API_KEY` + `AI_MODEL`），Vercel AI SDK，key 只存服务端。**不另选、不另配。**

### ③ 不做应用内配置页

- [x] 沿用环境变量，**不做设置页**。

Task/11 把这个问题推给了本任务，现在回答：**不做**。理由不是「懒得做」：

- vault 是设计成**可以扔进 git / iCloud 同步**的（[FUTURE.md](../FUTURE.md) §1.6 ①）。把 API key 存进 vault，等于教用户把密钥提交进版本库——这是个安全陷阱，不是便利功能。
- 存到 vault 之外的某个本地文件，就多出「配置文件在哪、跟不跟着 `VAULT_PATH` 走、Docker 里怎么挂」一整套问题，换来的只是省掉一次重启。
- 只读沙盒和 Docker 本来就靠环境变量注入，加一条应用内路径等于两个真相来源。

### ④ 暴露哪些函数：**读工具逐个 opt-in，写操作一个都不给**

- [x] 工具集里**没有任何会写盘的工具**。

给出的读工具（一个一个手写进去的，不是反射 `services/`）：

| 工具 | 包的是 |
|------|--------|
| `list_inventory` | `listInventory` |
| `list_recipes` | `listRecipes`（**不含步骤正文**——那是纯 token 浪费） |
| `get_recipe_detail` | `getRecipeDetail` |
| `list_utensils` | `listUtensils` |
| `get_calendar` | `getCalendarEntries` |
| `get_recommendations` | **规则引擎**（`tiering` + `scoring`），见决策 ⑦ |
| `generate_shopping_list` | `generateShoppingList` |

> **为什么不反射式暴露**：反射意味着以后任何人新增一个 service 函数，都在无意中扩大了 agent 的权限面（[DESIGN.md](../DESIGN.md) §6 #17）。

### ⑤ 写操作：**终止型提案工具**，写入永不进入循环

- [x] 模型想改东西时只能调 `propose_changes`——一个**故意不带 `execute` 的工具**。

AI SDK 在「调用了没有 execute 的工具」时会停止循环，把这次调用原样交还。于是提案浮到 UI 等用户确认，**真正的落库由确定性代码在另一个 action 里完成**。

为什么是这个形状，而不是给每个写工具挂审批回调：

- **写入根本没进入循环。** 不存在「审批逻辑漏了一个分支」这种失败模式——循环里没有写能力，漏也漏不出来。
- 和 [Task/11](./11-ai-capture.md) 的心智模型完全一致：提案 → 确认 → 落库 → 可撤销。用户在命令栏看到的确认屏，和拍照录入是同一套东西。
- Server Action 是无状态一来一回。多轮审批往返要自己维护会话状态，而那份状态一旦和模型上下文对不上，就会出现「确认了 A 却执行了 B」。

**能提的改动只有两类**：日历条目、库存档位。**不给新增食材**——凭一句话往库存里添东西是 Task/11 拍照录入那条路径的活，那里有专门的分类确认。

### ⑥ 提案在给用户看之前先校验

- [x] `validateProposal()`：菜谱 id 必须真实存在、日期格式必须合法、食材必须在库存里。被剔掉的**要显示出来**。

让一条引用了不存在菜谱的提案走到确认屏、用户点了确认才报错，等于把模型的幻觉转嫁成用户的挫败感。而静默丢弃更糟——用户以为做了，其实没做。

### ⑦ 推荐：规则引擎保留为基线，agent 调它而不是取代它

- [x] `get_recommendations` 工具让模型去**调规则引擎**，提示词里明写「挑菜排菜一律先调它，不要自己从菜谱列表里凭感觉挑」。

自己挑会推出用户上周刚吃过、或者食材根本不齐的菜——规则引擎已经算好了这些（[DESIGN.md](../DESIGN.md) §6 #3/#4）。无 key 时产品完全可用这条也因此不变。

### ⑧ 记忆注入：全部渲染进 system prompt

- [x] `renderMemoryBlock()` 把活着的记忆渲染成「关于你」区块，**agent 与推荐标注两处共用**。

- **代码不按 `enforcement` 分支**（Task/10 决策 ③④）。`hard` / `soft` 只是渲染进 prompt 的强度提示。
- 区块里**必须**带一句「食材表记的是冰箱库存，不是完整配料表」——这是决策 ③ 的整个前提（宫保鸡丁的食材表里没有花生）。有测试钉着。

### ⑨ 记忆生效范围：推荐页也生效，且**下沉不删除**

- [x] 记忆同时影响两处：命令栏的 system prompt，以及**主推荐页的事后标注**（作者定，2026-08-05）。

做法：规则引擎照常跑完并**先渲染出来**，随后异步跑一次标注，模型逐道判断候选菜与记忆的关系：

| 判定 | 结果 |
|------|------|
| `ok` | 什么都不做 |
| `note` | 写一句理由进 `rec.reason` → 占 `buildReasons()` 的第一格（Task/10 决策 ⑧ 留的槽位） |
| `avoid` | 写理由 + **下沉到列表末尾** |

**为什么是「下沉 + 说明」而不是「过滤掉」**：过滤 = 用户永远不知道发生过什么。模型判断错了（它会错），用户只会觉得「这个应用怎么从来不推我爱吃的那道菜」，且无从排查。下沉之后菜还在、理由写在卡片上，一眼能看出是记忆在起作用，也一眼能看出它判错了。

这与 [Task/11](./11-ai-capture.md) 决策 ⑦ 是同一条原则的两种形态：**AI 可以改变你看到什么，但不能背着你改变。**

**为什么是事后标注而不是塞进推荐主流程**：推荐页是首屏。把模型调用放进它的加载路径，等于让每个配了 key 的人每次开首页都多等一两秒，而且模型一挂首屏就白屏。渐进增强还白拿一个保证：**没配 key 的人走的代码路径与 Task/10 之前逐字相同**。

### ⑩ 记忆页文案必须说清「在哪里生效」

- [x] 「生效中」分区的说明改成「推荐页会按它们标注并把冲突的下沉；命令栏问问题时也会带上」。

含糊的「已生效」会让用户以为菜谱页、购物清单也被筛查过。这是 Task/10 决策 ⑤ 那条原则的延续——**不能让用户以为它在保护自己**，无论是「其实没生效」还是「只在一半地方生效」。

### ⑪ 预算：步数封顶，超时封顶

- [x] `stopWhen: stepCountIs(8)` + 120 秒超时。

「排一周的菜」实测 3–5 步够用（查库存 → 跑推荐 → 查日历 → 提案）。没有上限的 agent 循环就是一台连着用户钱包的永动机。

### ⑫ 免责声明先于生效逻辑，且不因为「模型已经很准了」而摘掉

- [x] `MEMORY_DISCLAIMER` 常驻记忆页，一个字不动。

Task/10 交付了声明，本任务让筛查真的跑起来——两者顺序不能反。

---

## 交付物

| # | 交付物 | 文件 |
|---|--------|------|
| 1 | 记忆 → prompt 渲染 | `src/lib/ai/memory-prompt.ts` |
| 2 | 推荐页记忆标注（模型调用） | `src/lib/ai/annotate.ts` |
| 3 | 标注的纯数据部分（客户端安全） | `src/lib/ai/verdict.ts`、`src/lib/ai/limits.ts` |
| 4 | 工具层 | `src/lib/ai/tools.ts` |
| 5 | agent 循环 | `src/lib/ai/agent.ts` |
| 6 | 提案落库 + 校验（A 层） | `src/lib/services/command/index.ts` |
| 7 | Server Actions | `src/app/actions/command.ts`、`annotateRecommendationsAction` |
| 8 | 命令栏 UI | `src/components/command/CommandBar.tsx` |
| 9 | 规则引擎组装的复用 | `src/lib/recommend/compose.ts` |

---

## 验收标准

| # | 条件 | 状态 |
|---|------|:--:|
| 1 | `npm run build` 零错误 | ✅ |
| 2 | `npx vitest run` 全绿，推荐引擎 18 个测试逐字未改 | ✅ 171 passed |
| 3 | 「排一周的菜」这类复杂请求能被正确执行，**且每一步用户都看得见** | ⏳ 待真机 |
| 4 | 无 API key 时：命令栏优雅提示，**其余全部功能不受影响** | ✅ 可静态核对 + 有测试 |
| 5 | 任何写操作在落库前都有确认 | ✅ 结构上保证（写工具不存在） |
| 6 | **记忆被渲染进 system prompt 并真的影响输出** | ⏳ 待真机 |
| 7 | 配好 key 后记忆页的「未生效」变为「生效中」 | ✅ 逻辑已通 |
| 8 | 单次请求的工具调用次数有上限 | ✅ `stepCountIs(8)` |
| 9 | 撤销把世界恢复原样（含 `last_restocked_at`） | ✅ 有回归测试 |

---

## 风险与不做什么

- ⚠️ **绝不因为「有了 AI」就削弱 GUI**。GUI 是永久资产。
- ⚠️ **免责声明必须先于生效逻辑到位**，也不能因为「模型已经很准了」就摘掉（决策 ⑫）。
- ⚠️ **别给 agent 加写工具**。这个功能的安全性不是靠审批逻辑写得对，而是靠循环里根本没有写能力（决策 ⑤）。
- ⚠️ **客户端组件不要从 `agent.ts` / `annotate.ts` import 运行时值**——会把 `node:fs` 拖进客户端 bundle，构建直接失败。纯常量在 `limits.ts`，纯函数在 `verdict.ts`。这个坑已经踩过一次。
- **不做** `/chat` 全屏聊天页取代界面。
- **不做**自研 agent 框架。
- **不做**云端代理用户 key。
- **不做**应用内配置页（决策 ③）。
- **不做**流式输出。命令栏是一问一答，不是聊天。

> ⚠️ **本节曾有一条相反的规定（2026-08-04 推翻）**：「**hard 约束不能依赖 prompt**」，
> 且验收标准里写着「hard 约束（如过敏）即使在 AI 路径下也依然生效——因为它在 `tierRecipes` 里，
> AI 拿到的候选集已经过滤过」。**两条都已废弃**：`tierRecipes` 里从来就没有过滤逻辑（筛选器在 `scoring.ts`），
> 而过敏所需的配料数据根本不存在于食材表中。改为模型判断 + 免责声明，
> 完整论证见 [Task/10](./10-memory-layer-✅已完成.md) 决策 ③ 与 [DESIGN.md](../DESIGN.md) §6 #14。

---

## 📝 执行记录

> **实现日期**: 2026-08-05
> **状态**: 代码全部落地。**两条验收标准需要作者的 key 才能验**（#3、#6），因此没有改名成 `✅已完成`。

### 已验证

| 检查 | 结果 |
|------|:--:|
| `npm run build` | ✅ 0 错误 |
| `npx vitest run` | ✅ 171 passed（154 → 171，本任务新增 17） |
| `npx eslint` | ✅ 新增代码 0 warning |
| 推荐引擎 18 个测试逐字未改 | ✅ |

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/lib/ai/memory-prompt.ts` | 记忆 → 「关于你」区块，agent 与标注共用 |
| `src/lib/ai/annotate.ts` | 推荐页的记忆标注（模型调用，**只在服务端**） |
| `src/lib/ai/verdict.ts` | 标注的纯数据部分 —— 客户端安全 |
| `src/lib/ai/limits.ts` | `MAX_STEPS` / `ANNOTATE_LIMIT` —— **零 import**，客户端安全 |
| `src/lib/ai/tools.ts` | 7 个读工具 + 1 个终止型提案工具 |
| `src/lib/ai/agent.ts` | agent 循环，步数与超时封顶 |
| `src/lib/services/command/index.ts` | 提案校验 + 落库，撤销复用 Task/11 |
| `src/app/actions/command.ts` | 跑 agent（只读）与落库（写）分开 |
| `src/components/command/CommandBar.tsx` | ⌘K 命令栏 |
| `src/lib/recommend/compose.ts` | 规则引擎组装的复用（两个调用方） |
| `src/lib/ai/__tests__/command.test.ts` | 17 例 |

改动：`recommend.ts` action（+ `annotateRecommendationsAction`）、推荐页（渐进增强接线）、`app-layout.tsx`（挂命令栏 + 可见入口）、`MemoryView`（「在哪生效」文案）、`memory/text.ts`。

### 实施中发现的两件事

1. **⚠️ 客户端 bundle 边界（真 bug，已修）。** 命令栏最初从 `agent.ts` import 了运行时常量 `MAX_STEPS`，
   顺着把 `agent → tools → services → vault` 整条服务端链拖进客户端 bundle，构建直接失败：
   `the chunking context does not support external modules (request: node:fs)`。
   一个被 import 的**运行时值**会带上它的整条依赖链，`import type` 才不会。
   修法：纯常量拆到 `limits.ts`（零 import），纯函数拆到 `verdict.ts`（只 import 类型）。
   **新决策 ⑬**：给客户端用的东西必须住在自己的模块里，不能顺手从服务端模块里导出。

2. **规则引擎的组装出现了第二个调用方。** `getRecommendations` action 和 agent 的
   `get_recommendations` 工具都要拼那六个参数。两边各拼一遍迟早漂移，而一旦漂移，
   「命令栏给的推荐」和「推荐页给的推荐」就会不一样，用户没有任何办法发现是哪边错了。
   抽成了 `compose.ts`——**不含任何新逻辑，`tiering.ts` / `scoring.ts` 一行未改**。

### 待作者验收（需要 key）

```bash
npx tsx --env-file=.env.local scripts/verify-ai.ts   # 先确认 key 和端点通
```

> ⚠️ `--env-file` 不能省——`tsx` 不像 `next dev` 那样自动读 `.env.local`。

然后：

| # | 验什么 | 怎么验 |
|---|--------|--------|
| 1 | 复杂编排 | ⌘K → 「帮我排三天的菜，避开最近吃过的」→ 看它是否调了 `跑推荐引擎`、提案是否合理 |
| 2 | 过程可见 | 确认屏上方那行「查库存 → 跑推荐引擎 → 提出改动」是否如实反映 |
| 3 | 写入确认 + 撤销 | 执行提案 → 看日历 → 撤销 → 确认 `git diff data/` 干净 |
| 4 | 幻觉拦截 | 若模型编了不存在的菜谱，确认屏上应显示「已跳过」而不是静默丢弃 |
| 5 | **记忆真的生效** | 在 `memory/` 写一条「不吃辣」→ 打开推荐页，看川辣菜是否被下沉且卡片上有理由 |
| 6 | 无 key 降级 | 清掉环境变量重启，⌘K 应说清缺什么，推荐页照常工作 |
