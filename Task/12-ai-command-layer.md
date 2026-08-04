# 12 — AI 命令层（function calling + BYOK）

> **状态**: 待细化
> **依赖**: 10
> **阶段**: 二期 AI

## 目标

在现有 GUI **之上**加一层自然语言命令入口，专治 GUI 难表达的查询与多步操作。

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

签名统一为 `fn(supabase, userId, args)`，**直接可包成 tool**。这正是 [DESIGN.md](../DESIGN.md) §6 #5 那条决策的兑现。

## 关键决策（待讨论）

- [ ] 入口形态：全局命令栏（⌘K）／侧边抽屉／页内输入框？
  > 倾向命令栏——它在形态上就宣告了「我是加速器不是新界面」
- [ ] 模型与 provider 选型：需要 function calling / 多轮工具调用。**实施时须查当时的官方 API 文档**确认可用模型、参数与定价，不要照抄本文档里的任何假设
- [ ] BYOK：key 存哪？（本地 / 浏览器 localStorage / 服务端加密）——本地优先方向下应存本地，但要想清楚服务端调用时 key 怎么流转
- [ ] 哪些 A 层函数暴露给 agent？**逐个 opt-in**（[DESIGN.md](../DESIGN.md) §6 #17）——写操作要不要全部需确认？
- [ ] 写操作的确认策略：`listXxx` 可直接执行，`delete` / `batchUpdate` 必须确认。边界画在哪？
- [ ] 推荐用 LLM 还是保留规则引擎？
  > **已定：规则引擎保留为基线**（[DESIGN.md](../DESIGN.md) §6 #3/#4）——无 key 时产品完全可用。LLM 是增强，不是替换
- [ ] 记忆如何注入 prompt（依赖 [Task/10](./10-memory-layer.md)：soft 进 prompt，hard 已在 `tierRecipes` 里过滤）
- [ ] 多轮工具调用的失败处理与预算上限（防止死循环烧 token）

## 交付物

- Tool 定义层：把选定的 A 层函数包成 agent 可调工具（自描述 schema）
- Agent 循环（多轮工具调用）
- 命令栏 UI + 工具调用结果的卡片渲染
- BYOK 配置页
- 写操作确认机制

## 操作步骤

> 待决策定稿后回填。

## 验收标准

- 上面那句「排一周的菜」的复杂请求能被正确执行，且执行的每一步用户都看得见
- 无 API key 时：命令栏优雅提示，**其余全部功能不受影响**
- 任何写操作在落库前都有确认
- **记忆（含过敏 / 禁忌）被渲染进 system prompt 并真的影响输出**——这是 [Task/10](./10-memory-layer.md) 明确留给本任务的部分
- 未配 API key 时，记忆管理页里那些「未生效」标注在配好 key 后**变为生效**（[Task/10](./10-memory-layer.md) 决策 ⑤ 的另一半）
- 单次请求的工具调用次数有上限，不会失控

## 风险与不做什么

- ⚠️ **绝不因为「有了 AI」就削弱 GUI**。GUI 是永久资产
- ⚠️ **免责声明必须先于生效逻辑到位**。[Task/10](./10-memory-layer.md) 交付了声明，本任务让筛查真的跑起来——两者顺序不能反，也不能因为「模型已经很准了」就把声明摘掉

> ⚠️ **本节曾有一条相反的规定（2026-08-04 推翻）**：「**hard 约束不能依赖 prompt**」，
> 且验收标准里写着「hard 约束（如过敏）即使在 AI 路径下也依然生效——因为它在 `tierRecipes` 里，
> AI 拿到的候选集已经过滤过」。**两条都已废弃**：`tierRecipes` 里从来就没有过滤逻辑（筛选器在 `scoring.ts`），
> 而过敏所需的配料数据根本不存在于食材表中。改为模型判断 + 免责声明，
> 完整论证见 [Task/10](./10-memory-layer.md) 决策 ③ 与 [DESIGN.md](../DESIGN.md) §6 #14。
- **不做** `/chat` 全屏聊天页取代界面
- **不做**自研 agent 框架
- **不做**云端代理用户 key
