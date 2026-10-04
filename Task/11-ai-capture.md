# 11 — AI 录入折叠（拍照 / 小票 / 一句话 → 结构化写入）

> **状态**: **代码已落地，待真机验收**（见文末执行记录——4 条验收标准需要作者的 key 才能验）
> **依赖**: 06 ✅、04 ✅
> ⚠️ **依赖变更（2026-07-26）**：原依赖 07 是为了复用它的 vault 写入路径，但 [Task/07](./07-export-import.md) 范围已失效——那条写入路径现在是 [Task/04](./04-single-user-local-✅已完成.md) 里的运行时数据层本身。
> ⚠️ **反向依赖（2026-08-05 新增）**：本任务建立的 provider 层（`src/lib/ai/`）是**项目第一次真正发出模型请求**，[Task/12](./12-ai-command-layer.md) 直接复用它。所以 12 现在依赖 11，不只依赖 10。
> **阶段**: 二期 AI

## 目标

把「维护数据」这件事的成本压到接近零：拍一张照、说一句话，库存和日历自己就更新了。

## 为什么做

**这是二期真正的主角，也是整个产品能否长期活下去的关键。**

论证链（见 [DESIGN.md](../DESIGN.md) §1.5）：

1. 唯一失败模式是**作者自己弃用**
2. 根因是**数据变馊**——维护录入是无偿劳动，而这正是人类最讨厌的事
3. Pantry tracker / meal planner 品类的坟场就是这么堆起来的（Mealie / Grocy 的共同天花板也正是「录入极重」）
4. 三档库存制只是缓解，仍要求每次买菜、每顿饭后手动点
5. **所以：只有 AI 能把录入成本压到接近零 —— AI 不是威胁，是这个产品的救命稻草**

> 对比一下就清楚了：「对话取代界面」是**为了炫而找问题**；「无摩擦录入」是**真实的、未被开垦的需求**。枪口必须对准后者。

## 场景（按价值排序）

| # | 场景 | 输入 | 输出 | 本任务 |
|---|------|------|------|--------|
| 1 | **买菜回来** | 一张购物袋 / 冰箱照片 | 批量识别食材 → 建议档位改 `enough` → 用户确认 | ✅ 做 |
| 2 | **小票入库** | 一张超市小票 | 解析条目 → 归一化名称 → 批量入库 | ✅ 做（与 1 同一条管线，只是提示词不同） |
| 3 | **做完饭** | 一句话「我做完了宫保鸡丁」 | 写日历 `completed` + 弹出该菜食材的档位调整 | ✅ 做 |
| 4 | **随手记** | 「西红柿没了」 | 直接改档位 | ✅ 做（与 3 同一条文本管线，同一个 schema 的另一个分支） |

> **远期的杀手锏在写入侧**：一次自然语言输入**扇出到多个系统**（「我买了双鞋 800」→ 衣柜 + 账本 + 资产三处同时动）。厨房模块是这个模式的第一次验证。

---

## 现状（已核实，2026-08-05）

写步骤之前实测过的事实。**这一节是决策的地基，不是背景介绍。**

| 事实 | 证据 |
|------|------|
| Service 层签名是 `fn(vault, args)` | `src/lib/services/inventory/index.ts:19` 等全部函数。⚠️ FUTURE.md §3.2 与 Task/12 里写的 `fn(supabase, userId, args)` 是 Task 04 之前的陈旧文案，已一并修正 |
| **加食材的手动基线：一次一个 Modal** | `src/components/views/InventoryView.tsx:229` —— 名称 + 分类 + 档位 + 可选字段。买菜回来录 10 样 = 10 轮弹窗 |
| **做完饭的手动基线已经很便宜** | `src/components/views/CalendarView.tsx:157` `openDoneModal()` —— 点日历条目即弹窗，**食材与当前档位已预填**，拉几下 Segmented 就完事 |
| 批量改档位的 A 层函数现成 | `batchUpdateStockLevel(vault, items)` (`inventory/index.ts:130`)、`updateStockOnCook` 是它的别名 (`:158`) |
| 日历「完成 + 改档位」的 Server Action 现成 | `completeEntryAction` / `updateStockOnCookAction`（`src/app/actions/calendar.ts`） |
| 名称归一化现成且带别名表 | `normalizeIngredientName(name, vault.aliases)` (`src/lib/utils/normalize-name.ts`) |
| 图片写入路径现成 | `uploadRecipePhoto()` (`recipe/index.ts:275`) + `/api/photo` 读取端点 |
| **项目没有任何 AI SDK 依赖** | `package.json` 的 `dependencies` 里没有任何模型 SDK |
| `AI_API_KEY` 目前只被当布尔量读 | `src/lib/ai/config.ts:16` `isAiConfigured()` —— Task/10 建立的口径 |
| 写入拦截现成 | `assertWritable(action)` (`src/lib/vault/writer.ts:44`)、`isReadOnly()` (`paths.ts:29`)、UI 侧 `useReadOnly()` + `READ_ONLY_TIP` |
| Server Action 错误外壳现成 | `guardData` / `guardResult`（`src/lib/utils/error.ts`） |
| zod 已在依赖里 | `zod ^4.4.3` |

**由这张表直接得出的一条结论**（见决策 ①）：场景 1/2 的手动基线是「N 轮弹窗」，场景 3 的手动基线是「点一下 + 拉几下」。**两者的加速空间差一个数量级**，验收标准里那条「至少快 3 倍」对它们不是同一个难度。

---

## 关键决策（已定稿）

### ① 范围：视觉入口与文本入口都做，但**视觉先行**

- [x] **两个场景都做**（作者定，2026-08-05）。

理由与代价都要写清楚：

- **场景 1/2（视觉 → 批量库存）是「快 3 倍」几乎必然达成的那个**：手动基线是 N 轮弹窗，一张照片换一次确认，N 越大优势越大。
- **场景 3（一句话 → 日历 + 档位）的加速空间要小得多**：现状点日历条目就能弹出预填好的档位表。它真正赢的情形是「这道菜根本不在日历上」——手动要先开添加弹窗、选日期、搜菜谱、标完成，再走一次档位表。**验收时必须按这个情形计时，别拿已在日历上的菜自欺欺人。**
- **代价（明说）**：两个场景一起做，本任务体量约为单做视觉的 1.6 倍。

**内部执行顺序：视觉管线 → 抽出通用确认层 → 文本管线。** 不要两条并行开工——确认 UI 是两者共用的，先让它被真实的批量场景（视觉）打磨出来，文本场景再套进去。反过来做会得到一个为单条记录设计、撑不住批量的确认层。

### ② BYOK 形态：**provider 中立**的 OpenAI 兼容端点，不绑任何厂商

- [x] 用 **base URL + api key** 的 OpenAI 兼容协议接入，用户给什么 key 就用什么模型（作者定，2026-08-05）。

这是自托管 BYOK 项目的事实标准形态（GitHub Copilot BYOK、LibreChat 自定义端点、Open WebUI、Factory、Kodus 全是这个形状）：只要端点说 OpenAI 的方言，官方 API、中转站、Ollama、vLLM 全都能接。

> ⚠️ **明确否掉了「直接用某一家的官方 SDK」**。写死一家 SDK 会让「你的 key 你的模型」这句话变成假的，而这条恰恰是路径 A（开源个人工具）的 ethos 本身。代价是放弃各家的私有特性（Anthropic 的 thinking / effort、OpenAI 的 responses API 等）——本任务只做结构化抽取，用不上它们，**这个代价现在是零**。

### ③ 模型角色（model roles）：默认模型 + 视觉模型

- [x] 两个角色，视觉模型缺省继承默认模型（作者定，2026-08-05）。

```
AI_BASE_URL         # OpenAI 兼容端点，例：https://api.openai.com/v1
AI_API_KEY          # 已存在（Task/10 建立），语义不变
AI_MODEL            # 默认模型，处理所有文本活
AI_VISION_MODEL     # 可选。不设时 = AI_MODEL
AI_VISION_BASE_URL  # 可选。不设时 = AI_BASE_URL   ← 2026-08-05 修订补入
AI_VISION_API_KEY   # 可选。不设时 = AI_API_KEY    ← 同上
```

> ⚠️ **修订（2026-08-05，作者实配时暴露）——原方案里视觉角色只能换模型名，端点和 key 跟着默认角色走。**
>
> 那默认了「另一个模型就在同一个端点上」（中转站同时供两个模型的情形）。
> 但作者的真实配置是 **DeepSeek 官方 API + 本机 Ollama 上的 Qwen VL**——
> **两个端点、两个 key**。而 DeepSeek 正是本决策自己举的那个「默认模型不是多模态」的例子。
> 也就是说：**这条出路在它最该生效的场景里是堵死的**，且堵得很隐蔽——
> 填了 `AI_VISION_MODEL=qwen2.5vl:7b` 之后请求照样发往 DeepSeek，
> 报回来的是一句 `model not found`，长得和「模型名拼错了」一模一样，
> 用户会在模型名上反复试，永远试不出问题其实在端点。
>
> **改为**：模型角色 = **端点 + key + 模型名**三件套，三者**各自独立回落**到默认角色。
> 独立是要点——「只换端点不换 key」（同一家的另一个网关）和「只换模型名不换端点」
> （中转站）都是真实配法，绑成一组会逼用户重复填。三个变量全部可选，
> **单端点用户逐字无感**。`describeModelError` 一并改为报出**实际用的端点**，
> 有测试钉着（见「一般原则 ⑲」）。

**为什么需要单独的视觉模型**：用户的默认模型可能根本不是多模态的（DeepSeek 这类），此时拍照录入必须能指到另一个模型上，而不是整个功能塌掉。

「**模型角色**」不是自创概念——Continue 的 `roles:` 字段（`chat` / `edit` / `apply` / `autocomplete` / `embed` / `rerank`）就是同一件事的完整形态。

> **本任务只要两个角色，不要引入完整的 roles 体系。** 现在只有两种活（文本抽取、图像抽取），三个以上的角色是为想象中的需求造机制。Task/12 若需要「便宜模型跑分类、贵模型跑编排」，那时再加第三个角色，加的成本很低。

- **没配 `AI_VISION_MODEL` 且默认模型不支持图片**时的表现：不做能力探测（协议里问不出来），**直接把模型返回的错误原样透出**，并在文案里点明「这个模型可能不支持图片，试试配 `AI_VISION_MODEL`」。猜测式的降级会把一个清晰的配置问题变成一个玄学问题。

### ④ SDK 选型：Vercel AI SDK + OpenAI 兼容 provider

- [x] `ai`（v7）+ `@ai-sdk/openai-compatible`。

理由：
1. **provider 中立**正是它的设计目标，和决策 ② 同构；
2. `generateObject` + **zod schema** 直接产出结构化结果——项目已经装了 `zod ^4.4.3`，schema 可以和确认 UI 共用一份类型；
3. Next.js 生态内的标准选择，Server Action 里直接用。

> ⚠️ **实施时必须现查官方文档确认**，不要照抄本文档里的任何 API 形状：AI SDK v7 的 `generateObject` 签名、`createOpenAICompatible` 的参数名、以及**它对 zod 4 的兼容情况**（项目锁的是 zod 4.4.3，若 SDK 只支持 zod 3，要么升级 SDK 要么改用它的 JSON Schema 入口——**别为此把项目降级到 zod 3**）。

> ✅ **实施结果（2026-08-05）——上面这条警告命中了**：
> **`generateObject` 在 AI SDK v7 里已废弃**（类型定义里明写 `@deprecated Use generateText with an output setting instead`）。
> 实际用的是 `generateText({ output: Output.object({ schema }) })`，结果读 `result.output`。
> zod 4 **兼容**：`ai@7.0.52` 的 peer 是 `zod: ^3.25.76 || ^4.1.8`，项目的 4.4.3 落在范围内，无需降级。
> 装的版本：`ai@7.0.52` + `@ai-sdk/openai-compatible@3.0.23`。

### ⑤ 调用一律在服务端，key 永不进浏览器

- [x] 全部走 Server Action。图片以 `FormData` 上传到服务端，在服务端转成模型要的格式再发出去。

浏览器侧永远拿不到 `AI_API_KEY`。这条和「本地单用户」的定位无关——就算只有作者自己用，把 key 塞进客户端 bundle 也是错的，因为只读沙盒（`cook.wreathmoon.com`）跑的是同一份代码。

### ⑥ 结构化输出，不解析自由文本

- [x] 用**结构化输出** + zod schema 拿结果，**不写任何「从模型的散文里抠 JSON」的解析器**。
  （原文写的是 `generateObject`——它在 v7 已废弃，实际用 `generateText` + `Output.object()`，见决策 ④ 的实施结果块。**这条决策的内容不变，只是 API 名字变了**。）

自由文本解析是这类功能第一大 bug 来源，且失败方式无穷无尽。schema 校验失败就是失败，报错给用户重来一次，不做「尽力猜」。

> ⚠️ **修订（2026-08-05，作者实配时暴露）——「用了 `Output.object` 就等于有了结构化输出」是错的。**
>
> 实测（curl 直接问两边的服务器）：
>
> | 端点 | `response_format: json_schema` |
> |------|-------------------------------|
> | DeepSeek `deepseek-v4-flash` | ❌ `This response_format type is unavailable now` |
> | Ollama `qwen3.6:35b` | ✅ |
>
> 而 `@ai-sdk/openai-compatible` 的 `supportsStructuredOutputs` **默认 false**
> （`dist/index.js:435`），于是它对**所有**端点都走降级：发 `json_object`、
> **把 schema 整个丢掉**、只推一条 warning（`:525`）。再核 `ai` v7 的 `Output.object`
> （`dist/index.js:3500`）：它只设 responseFormat + 事后 zod 校验，**不往提示词里写 schema**。
>
> 两件事叠起来 = **模型压根不知道要哪些字段**。DeepSeek 报的
> 「Prompt must contain the word 'json'」其实是在替我们挡住一个更糟的结果：
> 绕过它之后回来的只会是一个字段名全靠猜的 JSON。
>
> **改为**：`schemaInstruction()`（`src/lib/ai/structured.ts`）把 schema 渲染进提示词，
> 三个调用点（两个抽取 + 推荐页标注）全部套上。`Output.object` 留在原位继续做
> 事后 zod 校验——**这条决策的内容不变，是它的实现原先漏了一半**。
>
> **可提炼的一般原则（新决策 ⑳）**：见文末。

> ⚠️ **实施提示**：`{type:'image'}` 的 message part 在 AI SDK v7 里也已弃用，
> 现在的形状是 `{type:'file', data, mediaType}`。运行时只打 DeprecationWarning 不报错，
> 所以单测和构建都发现不了——只有真跑一次才看得见。

### ⑦ 确认策略：**一律确认，没有高置信度旁路**

- [x] 任何 AI 产生的写入，落库前都必须经过用户过目并点确认。不设置信度阈值，不做「高置信度直接落库」。

> 原任务里这条写的是「倾向」，现在定死。理由不变且更强了：**批量误写库存会直接毁掉推荐质量，而推荐质量是产品的全部价值**。一个「95% 置信度自动落库」的旁路，换来的是省掉一次点击，赔上的是「这个系统会背着我改数据」——那正是 [DESIGN.md](../DESIGN.md) 说的「阴间」感的来源。

### ⑧ 归一化：分「已有 / 新食材」两组，新食材必须有分类

- [x] 模型输出的原始名称 → `normalizeIngredientName(name, vault.aliases)` → 按是否命中现有库存分成两组渲染：

| 组 | 含义 | 确认 UI 里长什么样 |
|----|------|-------------------|
| **已有食材** | 归一化后的名字在 `vault.inventory` 里 | 显示当前档位 → 建议档位，可改可取消勾选 |
| **新食材** | 归一化后不在库存里 | **必须选分类**（模型给建议值，用户可改），可整条丢弃 |

- **匹配不上的绝不静默丢弃**——它进「新食材」组，让用户自己决定是新增还是删掉。静默丢弃会让用户以为录进去了。
- **模型不负责归一化**，只负责把名字读出来。归一化是 [Task/06](./06-ingredient-name-normalization-✅已完成.md) 那套确定性规则的活，别让模型重做一遍——它做得不稳定，且绕过了别名表。

### ⑨ 撤销：写入前快照，一次性回滚

- [x] 每次批量落库前记录 before-state，落库后在 UI 上给一个「撤销」入口，作用域是**刚刚那一批**。

可回滚的三类动作都有现成的逆操作：

| 动作 | 逆操作 |
|------|--------|
| 改档位 | ~~`batchUpdateStockLevel` 写回快照里的旧档位~~ → **`restoreInventoryState`**，见下 |
| 新增食材 | `deleteInventoryItem` |
| 新增日历条目 | `deleteCalendarEntry` |

> ⚠️ **实施纠正（2026-08-05）——「用 `batchUpdateStockLevel` 写回旧档位」是错的。**
>
> 它有一条业务规则：档位变成 `enough` 就视同补货、把 `last_restocked_at` 盖成今天。
> 那条规则对「用户真的补货了」是对的，对「撤销一次误录入」是错的：
> 一样放了 8 天的青菜被误标成「刚买」、确认落库、再撤销之后，**档位回来了但补货日期变成今天**，
> 它于是静默退出「清库存」推荐档（`src/lib/recommend/tiering.ts:62` 按这个字段算陈旧度）。
> 用户看不到任何异常，只是推荐从此少了一道该优先吃掉的菜。
>
> **因此**：新增 `restoreInventoryState()`（回滚专用，不套补货规则），
> 快照存的是三元组 `{id, stock_level, last_restocked_at}` 而不是二元组。
> 有一条专门的回归测试守着这件事。
>
> **可提炼的一般原则（新决策 ⑯）**：撤销的定义是**让世界回到原样**，
> 包括那些用户看不见的字段——而不是「把用户看得见的那个值改回去」。

- **撤销状态只活在当前页面会话里**，不落盘、不做撤销栈、不做跨会话历史。真正的「后悔药」是 vault 本身——纯文本 + git，这条在 [FUTURE.md](../FUTURE.md) §1.6 ① 已经承诺过了。**这里的撤销只是省掉一次「打开文件手动改回去」。**

### ⑩ 无 key 时的降级：入口可见但禁用，文案说清

- [x] 没配 `AI_API_KEY` / `AI_MODEL` 时，AI 录入入口**显示但禁用**，点击提示要配什么；一期全部手动路径**逐字不变**。

沿用 Task/10 决策 ⑤ 的口径：**不能让用户以为它在工作**。也不做「藏起来」——藏起来的功能等于不存在，用户不会知道配了 key 能换来什么。

### ⑪ 只读沙盒：整个 AI 录入入口禁用

- [x] `READ_ONLY=1` 时，AI 录入入口走和其它写操作一样的禁用路径（`useReadOnly()` + `READ_ONLY_TIP`），**不要等 `assertWritable` 抛错**。

理由是钱：让用户在只读演示站上传照片、真的发出一次模型请求、然后在落库那一步才被拒——那是**白烧一次 token** 换一条错误提示。拦在入口。

### ⑫ 识别用的照片**不入 vault**

- [x] 拍照录入的图片只在服务端内存里过一遍，发给模型之后即丢弃，**不写进 vault**。

菜谱照片是资产（用户要反复看），小票和冰箱照不是——它们是一次性的输入。把它们落盘只会让 vault 在几个月内堆满没人会再打开的图片，而 vault 的可读可迁移正是整个项目的卖点。

### ⑬ 成本上限：单次请求硬上限，不做重试循环

- [x] 单次请求最多 1 张图片；schema 校验失败最多重试 1 次；**不做多轮 agent 循环**。

本任务是「一次输入 → 一次抽取 → 一次确认」，不是 agent。多轮工具调用与预算上限属于 [Task/12](./12-ai-command-layer.md)。

### ⑭ 场景 3 的菜谱匹配：匹配不上就问，不猜

- [x] 模型抽出菜名 → 在 `vault.recipes` 里按名称匹配（先精确，再归一化后精确）。匹配不上时**在确认 UI 里让用户从菜谱列表选一个**，不做模糊匹配自动选中。

「我做完了红烧肉」在有「红烧肉」和「红烧排骨」两条菜谱时猜错，代价是往日历里写了一条假记录，而日历历史正是「不重样」推荐的输入。**假匹配比不匹配更难排查**——这句话在 [Task/06](./06-ingredient-name-normalization-✅已完成.md) 的归一化规则里已经写过一次，这里是同一条原则。

### ⑮ 不做语音识别

- [x] 场景 3 的入口是**文本输入框**。要语音就用系统输入法自带的听写——它已经在每个人的手机和电脑上了。

原任务写的是「若要语音优先用现成 API」，现在收紧为「本任务不做」：多接一个 API 意味着多一个 key、多一份配置、多一类错误，而它换来的东西输入法免费提供。

---

## 交付物

| # | 交付物 | 说明 |
|---|--------|------|
| 1 | **AI provider 层** `src/lib/ai/` | provider 构造（base URL / key / 模型角色）、配置读取与校验、结构化抽取函数 + zod schema。**Task/12 直接复用这一层** |
| 2 | **Capture service（A 层）** `src/lib/services/capture/` | 抽取结果 → 待确认提案；应用提案；生成撤销快照。签名沿用 `fn(vault, args)` |
| 3 | **Server Actions** `src/app/actions/capture.ts` | 图片 / 文本 → 提案；应用提案；撤销 |
| 4 | **通用确认 UI** `src/components/capture/` | 「AI 提议 → 用户过目 → 批量落库」——两个场景共用，先给视觉场景写，再让文本场景套 |
| 5 | **两个入口** | 库存页的「拍照录入」；一句话输入框 |
| 6 | **测试** | schema 校验、归一化分组、菜谱匹配、无 key 降级、只读拒绝。**模型调用全部 mock**——不在测试里烧 token |
| 7 | **文档** | README 的可选配置表加三个环境变量；`docker-compose.yml` 透传；SPEC.md 补 service 签名与文件树 |

---

## 操作步骤

### 阶段 A：provider 层（先跑通一次真实请求，再写任何 UI）

1. 装依赖：`npm i ai @ai-sdk/openai-compatible`。**先查官方文档确认 v7 的 API 形状与 zod 4 兼容性**（决策 ④）。
2. 扩写 `src/lib/ai/config.ts`：
   - 保留 `isAiConfigured()` 的现有语义（`/memory` 页在用，不能破）
   - 新增 `getAiConfig()` → `{ baseUrl, apiKey, model, visionModel }`，`visionModel` 缺省回落到 `model`
   - 配置不完整时返回结构化的「缺什么」，供 UI 显示具体该配哪个变量
3. 新建 `src/lib/ai/provider.ts`：用 `createOpenAICompatible` 构造 provider，导出 `textModel()` / `visionModel()` 两个取模型的函数。
4. 新建 `src/lib/ai/extract.ts`：
   - zod schema：`IngredientCapture`（name / suggested_category / suggested_level）、`CookedCapture`（recipe_name / ingredient_hints）
   - `extractFromImage(file, kind: 'photo' | 'receipt')`、`extractFromText(text)`
   - 单次 1 图、失败最多重试 1 次（决策 ⑬）
5. **手动验一次真实请求**（拿一张真实的冰箱照）再往下走。这一步不通过，后面全部是空中楼阁。

### 阶段 B：视觉管线闭环

6. 新建 `src/lib/services/capture/index.ts`：
   - `buildInventoryProposal(vault, captures)` —— 调 `normalizeIngredientName(name, vault.aliases)`，分「已有 / 新食材」两组（决策 ⑧）
   - `applyInventoryProposal(vault, decisions)` —— 内部走 `addInventoryItem` + `batchUpdateStockLevel`，返回撤销快照
   - `undoCapture(vault, snapshot)` —— 决策 ⑨ 的逆操作表
   - 全部 `assertWritable` 开头，与其它 service 一致
7. 新建 `src/app/actions/capture.ts`：`guardData` / `guardResult` 包好，`revalidatePath('/inventory')`。
8. 新建 `src/components/capture/`：确认列表（两组分区、逐条可取消、新食材必须选分类）+ 落库后的撤销条。
9. 库存页加「拍照录入」入口，接 `useReadOnly()`（决策 ⑪）与无 key 禁用（决策 ⑩）。
10. **实测计时**：手动录 10 样 vs 拍照录 10 样，记录真实秒数写进完成记录。

### 阶段 C：文本管线套进同一个确认层

11. `extractFromText` 的结果分两支：「做完饭」→ 菜谱匹配（决策 ⑭）+ 该菜食材的档位提案；「随手记」→ 直接的档位提案。
12. `buildCookedProposal(vault, capture)`：匹配不上时返回待选菜谱列表，交给 UI 让用户选。
13. 应用侧复用 `addCalendarEntry`(status: `completed`) + `batchUpdateStockLevel`。
14. 一句话输入框入口——**不新开页面**（[DESIGN.md](../DESIGN.md) §1.3 已废弃 `/chat`）。
15. **实测计时**：按「这道菜不在日历上」的情形计（决策 ①），手动 vs 一句话。

### 阶段 D：收口

16. 测试：`src/lib/ai/__tests__/`、`src/lib/services/capture/__tests__/`，模型调用全部 mock。
17. README 可选配置表 + `docker-compose.yml` 环境变量透传。
18. SPEC.md 补 provider 层 / capture service 签名 + 文件树。
19. **顺手修的陈旧文案**：FUTURE.md §3.2 与 Task/12「现成的地基」一节里的 `fn(supabase, userId, args)` 改成 `fn(vault, args)`。

---

## 验收标准

| # | 条件 | 怎么验 |
|---|------|--------|
| 1 | `npm run build` 零错误 | `npm run build` |
| 2 | `npx vitest run` 全绿，且**推荐引擎的 18 个测试逐字未改** | `npx vitest run` + `git diff` 确认 |
| 3 | **拍照录入 10 样食材，比手动至少快 3 倍** | 真实计时，两个数字都写进完成记录。做不到就是失败 |
| 4 | **「这道菜不在日历上」时，一句话记录比手动至少快 3 倍** | 同上。**不许拿已在日历上的菜计时** |
| 5 | 每一次 AI 写入前，用户都看到了将要发生什么 | 手动走查两条管线 |
| 6 | 落库后可一键撤销，撤销后 vault 文件回到原样 | `git diff data/` 或 `git status` 应干净 |
| 7 | 不配 `AI_API_KEY` 时：入口禁用且说清缺什么，**一期全部手动路径完好** | 清掉环境变量重启，走一遍库存 / 日历 / 推荐 |
| 8 | 配了 `AI_MODEL` 但模型不支持图片时，报错原样透出并提示配 `AI_VISION_MODEL` | 拿一个纯文本模型试一次 |
| 9 | `READ_ONLY=1` 时入口即禁用，**不发出任何模型请求** | 看服务端日志确认零请求 |
| 10 | 识别用的图片没有落进 vault | `git status data/` 应无新增图片 |

---

## 风险与不做什么

- ⚠️ **AI 批量写库存是破坏性操作**。没有「确认 + 可撤销」不要上线（决策 ⑦⑨）。
- ⚠️ **不要为了省一次点击加「高置信度自动落库」**。这是本任务最容易被自己说服的一条捷径，也是最贵的一条。
- ⚠️ **不要让模型做归一化**。归一化是 Task/06 的确定性规则，模型绕过别名表会制造随机的错配（决策 ⑧）。
- ⚠️ **不要在测试里发真实模型请求**。测试要能在没有 key 的机器上全绿。
- **不做**任何厂商的官方 SDK 直连——BYOK 意味着 provider 中立（决策 ②）。
- **不做**第三个模型角色。两个角色够用，加机制等有真实需求（决策 ③）。
- **不做**设置页 / key 的应用内配置——沿用环境变量，配置页归 [Task/12](./12-ai-command-layer.md)（作者定，2026-08-05）。
- **不做**图片入库。小票和冰箱照是一次性输入，不是资产（决策 ⑫）。
- **不做**多轮工具调用 / agent 循环——那是 [Task/12](./12-ai-command-layer.md)。
- **不做**语音识别（决策 ⑮）。
- **不做** `/chat` 独立聊天页（[DESIGN.md](../DESIGN.md) §1.3 已废弃该方案）。
- **不做**跨模块扇出——现在只有厨房一个模块，扇出等有了第二个模块再说（[Task/13](./13-module-contract.md)）。
- **不做**流式输出。一次抽取一个结构化结果，没有可流的东西。

---

## 参考

BYOK 配置形态的同类项目（决策 ②③ 的依据，2026-08-05 核实）：

- [GitHub Copilot BYOK](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/use-byok-models) —— `*_PROVIDER_BASE_URL` + `*_PROVIDER_API_KEY`；模型条目上单独标 `vision: true`，不标就把图片部分从请求里剥掉
- [LibreChat 环境变量](https://www.librechat.ai/docs/configuration/dotenv) —— `.env` + `librechat.yaml` 配自定义 OpenAI 兼容端点
- [Continue 模型角色](https://docs.continue.dev/customize/model-roles) —— `roles:` 字段（`chat` / `edit` / `apply` / `autocomplete` / `embed` / `rerank`），「一个默认模型 + 特定活派给特定模型」的完整形态
- [Vercel AI SDK：OpenAI 兼容 provider](https://ai-sdk.dev/providers/openai-compatible-providers) —— `createOpenAICompatible({ name, apiKey, baseURL })`

---

## 📝 执行记录

> **实现日期**: 2026-08-05
> **状态**: 代码全部落地，**但验收未闭合**——10 条验收标准里有 4 条需要作者的 API key 才能验（见下）。
> 因此本任务**没有**改名成 `✅已完成`。

### 已验证

| 检查 | 结果 |
|------|:--:|
| `npm run build` | ✅ 0 错误 |
| `npx vitest run` | ✅ 154 passed（128 → 154，新增 26） |
| `npx eslint src` | ✅ 新增代码 0 warning（既有 17 条未动） |
| 推荐引擎 18 个测试逐字未改 | ✅ `git diff` 确认 `tiering.test.ts` / `scoring.test.ts` 无改动 |

### 待作者验收（需要 key）

| # | 验收标准 | 怎么验 |
|---|----------|--------|
| 3 | 拍照录入 10 样比手动快 3 倍 | 真实计时。手动基线是 10 轮 Modal |
| 4 | 「菜不在日历上」时一句话比手动快 3 倍 | 真实计时。**别拿已在日历上的菜计时** |
| 8 | 模型不支持图片时报错并提示配 `AI_VISION_MODEL` | 拿一个纯文本模型试一次 |
| — | 端到端跑通 | `npx tsx --env-file=.env.local scripts/verify-ai.ts [图片]`（`--env-file` 不能省，`tsx` 不自动读 `.env.local`） |

其余 6 条（确认屏、撤销、无 key 降级、只读拒绝、图片不落盘）已在代码层面实现并有测试或可静态核对。

### 新增文件

| 文件 | 行数 | 说明 |
|------|-----:|------|
| `src/lib/ai/config.ts` | 111 | 改写。provider 中立配置 + 模型角色，`isAiConfigured()` 语义收紧 |
| `src/lib/ai/provider.ts` | 62 | `createOpenAICompatible` + 文本/视觉两个角色 + 错误翻译 |
| `src/lib/ai/extract.ts` | 178 | zod schema + 提示词 + 两个抽取函数 |
| `src/lib/ai/vocab.ts` | 33 | 交给模型的枚举，编译期与 `types/` 同步 |
| `src/lib/ai/text.ts` | 20 | 服务端/客户端共用文案 |
| `src/lib/ai/__tests__/ai.test.ts` | 158 | 13 例，**模型调用全 mock** |
| `src/lib/services/capture/index.ts` | 313 | 提案 / 落库 / 撤销 |
| `src/lib/services/capture/__tests__/capture.test.ts` | 205 | 13 例 |
| `src/app/actions/capture.ts` | 178 | 抽取（只读）与落库（写）分开 |
| `src/components/capture/CaptureConfirm.tsx` | 219 | **两条管线共用的确认层** |
| `src/components/capture/CapturePanel.tsx` | 386 | 四态状态机 + 菜谱手选 |
| `src/components/capture/CaptureEntry.tsx` | 84 | 入口按钮 + 三种状态 |
| `scripts/verify-ai.ts` | 88 | 真实请求冒烟测试 |

改动：`inventory` service（+`restoreInventoryState`）、`InventoryView` / `CalendarView`（`headerExtra` 插槽）、两个页面接线、`MemoryView` 文案、`make-test-vault`（补 `memories`）。

### 实施中发现、并改变了实现的三件事

1. **`generateObject` 在 AI SDK v7 里已废弃**（`@deprecated Use generateText with an output setting instead`）。
   任务书里写的「实施时须查当时的官方文档，不要照抄」正好命中——改用
   `generateText({ output: Output.object({ schema }) })`。

2. **⚠️ 撤销会静默劣化推荐质量（真 bug，已修）。** 原计划用 `batchUpdateStockLevel` 做撤销的逆操作。
   但它有一条业务规则：档位变 `enough` 就视同补货、把 `last_restocked_at` 盖成今天。
   于是「误把一样放了 8 天的青菜标成刚买 → 撤销」之后，档位回来了，**补货日期变成今天**——
   它从此静默退出「清库存」档（`tiering.ts:62` 按这个字段算陈旧度）。用户看不到任何异常，
   只是推荐里少了一道该优先吃掉的菜。
   修法：新增 `restoreInventoryState()`（回滚专用，不套补货规则），快照存三元组
   `{id, stock_level, last_restocked_at}`。有一条专门的回归测试守着。

3. **Server Action 的 body 默认上限是 1MB**，手机原图 2–5MB 必超。
   复用了已有的 `compressImage()`（1600px / JPEG 0.82）在客户端先缩——顺带也把图像 token 降下来了。
   ⚠️ **顺带发现：菜谱照片上传（`uploadRecipePhotoAction`）走的是同一条 Server Action 路径，
   且没有配 `bodySizeLimit`。** 它在上传大图时应该早就会失败——本任务没动它，已单独记录。

### 新定的决策（补充原 15 条）

- **⑯ 撤销必须恢复用户看不见的字段。** 见上面第 2 条。「撤销」的定义是让世界回到原样，
  不是「把用户看得见的那个值改回去」。
- **⑰ 建议档位不猜下降。** 「做完饭」场景里，建议档位 = 当前档位，与手动路径一致。
  做过一顿饭不代表食材少了一档（2kg 米做一次还是 `enough`），而一个经常出错的建议
  会训练用户无视确认屏——那比不给建议更糟。AI 在这个场景省掉的是
  「开弹窗、选日期、搜菜谱、标完成」，不是「替你决定还剩多少」。
- **⑱ 已在库存里的食材，分类以库存为准。** 模型对已有食材给的分类建议一律忽略——
  用户当初分好的类，不该被一次识别改掉。
- **⑲ 报错必须报出「实际用的是哪个端点」，不能只报模型名。**（2026-08-05，随决策 ③ 修订补入）
  配错视觉角色最常见的一种是「换了模型名但没换端点」，而它的原始报错
  （`model not found`）与「模型名拼错了」在字面上无法区分。只报模型名的错误提示
  会把用户锁死在错误的排查方向上——**一条不能把人引向正确下一步的报错，
  和没有报错的区别只是它浪费了更多时间**。这与决策 ③ 拒绝能力探测是同一条原则的两面：
  不猜、不吞、把事实摆出来。
- **⑳ 不能假设端点的私有能力，正如不能假设厂商的私有 SDK。**（2026-08-05，随决策 ⑥ 修订补入）
  决策 ② 拒绝绑定厂商 SDK，是为了让「你的 key 你的模型」这句话是真的。但**协议层的
  可选特性**（严格结构化输出、`json_schema`、各家的私有 `response_format`）是同一个陷阱的
  另一半——一旦依赖它，「provider 中立」就只在支持它的那部分端点上成立。
  **凡是能在提示词里表达的约束，就在提示词里表达**，把端点特性当纯粹的加分项。
  代价（约束力从协议层降到提示词 + 事后校验）由决策 ⑥ 本来的兜底承担：zod 校验 + 一次重试。
  ⚠️ 这条也解释了**为什么不加「端点支不支持严格模式」的开关**：那等于把
  「配错了不报错、只是结果变差」这个坑重新交给用户踩一遍——正是决策 ⑲ 要消灭的那种失败态。
