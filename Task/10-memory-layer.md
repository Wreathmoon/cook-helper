# 10 — 记忆层设计与实现

> **状态**: 待细化
> **依赖**: 05
> **阶段**: 记忆层

## 目标

让系统能记住「我不吃辣」「这个月想少吃肉」这类跨域偏好，并把它们**可靠地、可解释地**作用到推荐上。

## 为什么做

「不吃辣」「这月少吃肉」**不属于任何单个模块**——它是跨域的、随时间沉淀的，是让 agent 感觉「它认识我」的**唯一**来源。

> **这是本项目唯一真正独有的资产。** 菜谱可以借（Mealie 有）、记账可以借（Firefly 有）、连接器只是水管——而「关于你这个人」的这层记忆，只能自己长出来。

而且它恰恰**最适合做成真·Obsidian 式本地 Markdown**：纯文本、可 grep、用户能自己打开改删——**这就是信任的全部来源**。

## 文件格式（草案）

一条记忆一个文件 + 一个索引。位置：`vault/memory/`。

```markdown
---
id: 01J9AB3C
type: preference          # preference(长期偏好) | goal(临时目标) | constraint(硬约束)
scope: [kitchen]          # 或 [global]，决定哪些模块能看到
source: stated            # stated(用户明说) | inferred(agent 推断)
confidence: high
enforcement: soft         # soft(进 prompt/评分) | hard(在代码里过滤)
created: 2026-07-25
expires: null             # goal / constraint 必须给日期
status: active
---
不吃辣。推荐时排除「中辣」「重辣」；「微辣」先问一句。
```

索引 `vault/memory/index.md`——一行一条，全量读进来（很小）：

```markdown
- [不吃辣](no-spicy.md) — 排除中辣重辣，微辣需询问
- [这月少吃肉](less-meat-2026-07.md) — 至 2026-07-31，素菜加权
```

### 三个字段是骨架，缺一个就会烂

- **`type` 决定生命周期**
  - `preference` 长期有效
  - `goal`（这月少吃肉）**必须带 `expires`**，否则三个月后它还在悄悄压着推荐
  - `constraint`（术后软食、过敏）同样带失效期
  > ⚠️ **不区分这三种，是个人 AI 记忆系统最常见的死法**——记忆只增不减，慢慢把推荐悄无声息地毒化。而且毒化过程没有报错、没有征兆，等你发现推荐变差时已经找不到原因。

- **`source` + `confidence` 决定信任** — agent 推断出来的必须可被用户一键否掉

- **`scope` 决定跨域** — 「不吃辣」只管厨房；「我是极简主义者」可能同时影响衣柜 + 订阅 + 厨房

## harness 四件事

### ① 检索：明确不上向量库

量级是**几十到几百条**。在这个规模上，**关键词 + scope 过滤完胜 embedding，而且可调试**。

做法：`index.md` 全量读入 → 按 `scope` 命中当前域的 + `global` 的 + `status: active` 的 → 展开成完整文件。

> 上向量数据库是这里最典型的过度工程（见 [DESIGN.md](../DESIGN.md) §13 反模式 3）。

### ② 注入：hard 约束绝不能只写进 prompt

| 类型 | 落点 | 现有代码（已核实） |
|------|------|------------------|
| **soft**（不吃辣、想少吃肉） | 进评分权重，或渲染进 system prompt 的「关于你」区块 | `scoreAndSort(input: ScoringInput)` — `src/lib/recommend/scoring.ts:18` |
| **hard**（过敏、医疗禁忌） | **在代码里过滤掉，让模型根本看不到那些菜谱** | `tierRecipes(input: TieringInput)` — `src/lib/recommend/tiering.ts:21` |

> **提示词遵从性永远不是 100%。** 把过敏原交给「希望模型记得」是不可接受的。

**好消息：现有 A/B 分层天然支持这个**——不用新建机制，只是把「筛选器的值」从「用户当场点的」扩展成「记忆里长期存着的」。硬过滤本来就走 `tierRecipes`（现有时间 / 辣度 / 荤素筛选器就是这条路）。

### ③ 写入：agent 提议，用户确认

记忆写入是**显式**工具调用（`remember(...)`），且**新记忆要露出来给用户看一眼**。

> 悄悄记下一条推断错的记忆、然后用它默默影响半年的推荐——这是这类产品让人觉得「阴间」的第一大来源。解药就是 Obsidian ethos：那是一个 markdown 文件夹，用户随时能打开改删。

### ④ 复盘：让记忆可解释

现有 UI **已经埋好了坑**——推荐主推卡上有「**为什么推荐它：**」+ 最多 4 条理由（`RecommendedRecipe.reason`，`src/types/index.ts:106`）。

**把命中的记忆直接写进那几条理由里**：

> 「你说过不吃辣，已避开川辣类」

一举解决三件事：可解释性、用户发现记忆错了、AI 价值可被感知。

> 为规则引擎做的那个「为什么推荐它」，恰好是 AI 记忆最好的展示位。

## 关键决策（待讨论）

- [ ] 记忆是**先做纯手工维护**（用户自己写 markdown / 在设置页增删），还是一上来就接 AI 写入？
  > 倾向：**先手工**。手工版就能验证「hard/soft 接入推荐」是否有效，而且不依赖 [Task/12](./12-ai-command-layer.md)
- [ ] `soft` 偏好落在哪：新增评分维度，还是改造现有 `RECOMMEND_CONFIG.weights`？
  > 现有权重已占满 1.0（`noRepeat 0.35 / clearStock 0.25 / timeMatch 0.20 / nutritionBalance 0.20`，见 `src/lib/recommend/config.ts`），加维度要重新分配
- [ ] `expires` 到期后：自动置 `status: expired` 还是提示用户复核？谁触发（启动时扫一遍？）
- [ ] `inferred` 记忆是否需要先经用户确认才生效，还是先生效但可撤销？
- [ ] 记忆冲突怎么办（「不吃辣」和「想试试川菜」同时存在）？
- [ ] `scope` 的取值空间怎么定，好为未来模块留位置
- [ ] 记忆要不要参与 `/demo`（演示 AI 记忆效果很有说服力，但 Demo 是只读的）

## 交付物

- 记忆格式规范（追加进 [Task/05](./05-vault-format-spec-✅已完成.md) 产出的 `docs/vault-format.md`，保持风格一致）
- `src/lib/memory/` — 读取、索引、检索、写入
- `tierRecipes` / `scoreAndSort` 的记忆接入
- 「为什么推荐它」的记忆引用展示
- 记忆管理 UI（列表 + 增删改 + 一键否掉推断项）
- 测试

## 操作步骤

1. 定格式（与 Task/05 的 frontmatter 风格统一）
2. 实现读取 + 检索纯函数，先不接 UI
3. **接 `tierRecipes` 的 hard 过滤**——先做这个，因为它最重要且最容易验证
4. 接 `scoreAndSort` 的 soft 权重
5. 把命中记忆写进 `reason`，在主推卡展示
6. 做记忆管理 UI
7. ⚠️ 顺手把 `src/lib/recommend/config.ts` 顶部那句注释 `// 二期将由 LLM 决策取代` 改掉——按已纠正的战略，**B 层保留为基线被 LLM 增强，不是被取代**（[DESIGN.md](../DESIGN.md) §6 #3/#4）

## 验收标准

- 写一条 `enforcement: hard` 的「不吃辣」记忆 → 所有中辣 / 重辣菜谱**不出现在推荐里**，且这是在 `tierRecipes` 中过滤掉的（不是靠 prompt）
- 写一条 `soft` 的「少吃肉」→ 素菜排序上升，但荤菜仍可见
- 一条带 `expires` 的 goal 过期后**不再影响推荐**
- 主推卡的「为什么推荐它」能显示记忆来源
- 用户能在 UI 里删掉任意一条记忆，且删掉后推荐立即变化
- `npx vitest run` 全绿（含记忆检索与 hard 过滤的新测试）

## 风险与不做什么

- ⚠️ **hard 约束的实现必须是确定性的代码过滤**。任何「把过敏信息写进 prompt 然后相信模型」的实现都不可接受，即使它看起来能工作
- **不做**向量检索
- **不做**跨设备记忆同步（走 BYO，见 [Task/08](./08-local-data-layer.md)）
- **不做**自动推断记忆（第一版全部 `source: stated`），推断留给 [Task/12](./12-ai-command-layer.md)
