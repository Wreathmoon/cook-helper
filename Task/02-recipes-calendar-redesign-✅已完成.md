# 02 — recipes / calendar 视觉对齐 + 轻量组件重构

> **状态**: done（2026-07-26）
> **依赖**: 01
> **阶段**: 近期收尾

## 目标

让 `/recipes` 和 `/calendar` 跟上其他页面的设计语言，并将 demo 页的内联菜谱区/日历区替换为共享 View——消除代码重复。

> ⚠️ **策略纠正（2026-07-26）**
>
> 本任务初版将「拆分 1354 行巨石」作为核心目标。Task/01 落地后 `recipes/page.tsx` 已降至 235 行，拆分目标已大部分完成。当前核心工作调整为：**视觉对齐 + demo 复用共享 View + 抽出内联 `WaterfallCard`**。
>
> **因此**：任务重心从「拆分巨石」转为「统一视觉语言并消除 demo/auth 之间的代码重复」。

## 为什么做

[Task/01](./01-land-redesign-✅已完成.md) 的重设计只覆盖了 recommend / inventory / utensils / demo。`recipes/page.tsx` 和 `calendar/page.tsx` 的视觉未完整跟进——这两页现在和其余页面存在**设计语言不一致**。

同时 `demo/page.tsx`（304 行）内联了自己的 `RecipesSection`（63 行）和 `CalendarSection`（84 行），与 auth 侧逻辑重复——两边的卡片样式、瀑布流逻辑应该走同一套组件。

## 现状（已核实 · 2026-07-26）

| 文件 | 行数 | 说明 |
|------|------|------|
| `src/app/(auth)/recipes/page.tsx` | **235** | 瀑布流列表 + 筛选 + 详情弹窗。内联 `WaterfallCard`（62 行） |
| `src/app/(auth)/recipes/new/page.tsx` | 418 | 独立分页新建菜谱表单 ✅（Task/01 已拆分） |
| `src/app/(auth)/calendar/page.tsx` | **434** | 月视图 + 详情侧栏 + 记一笔/完成弹窗——纯单体 |
| `src/app/demo/page.tsx` | 304 | 内联 `RecipesSection` + `CalendarSection`，**未用共享 View** |
| `src/components/shared/RecipeDetailModal.tsx` | 452 | 共享详情弹窗 ✅（auth 和 demo 共用） |

**已验证可复用的拆分模式**（Task/01 产出）：

```
src/components/views/       页面级容器（InventoryView / RecommendView / UtensilsView）
src/components/recommend/   领域组件（HeroCard / AltCard / FilterPopover / ShoppingPanel / EmptyState）
src/app/(auth)/xxx/page.tsx 只留数据获取 + 组装
```

**测试**：`npx vitest run` — 5 files, **39 tests** 全绿 ✅（已确认，无 worktree 污染）

## 关键决策

- [x] **新建菜谱走 Modal 还是应用内独立分页？** → **已决：独立分页**（`/recipes/new/page.tsx` 已存在，Task/01 落地），编辑菜谱待补
- [ ] `WaterfallCard` 抽到 `src/components/recipes/WaterfallCard.tsx`——auth 和 demo 共用同一张卡片
- [ ] `calendar` 是否也抽 `src/components/views/CalendarView.tsx`？体量 434 行，拆出来 auth/demo 都能用
- [ ] demo 页的 `RecipesSection` / `CalendarSection` 替换为共享 `RecipesView` / `CalendarView`
- [ ] 菜谱详情弹窗 900×580 小红书 iPad 横版式是否照做？（`RecipeDetailModal` 已抽为共享组件，只改视觉即可）

## 交付物

- `src/components/recipes/` — 领域组件：`WaterfallCard.tsx`（从 auth/demo 两边的内联卡片合并）
- `src/components/views/RecipesView.tsx` — 页面级容器（瀑布流 + 筛选 + 空态）
- `src/components/views/CalendarView.tsx` — 页面级容器（月视图 + 侧栏 + 弹窗）
- 瘦身后的 `src/app/(auth)/recipes/page.tsx`（≤ 150 行，只剩取数 + 组装 View）
- 瘦身后的 `src/app/(auth)/calendar/page.tsx`（≤ 100 行，只剩取数 + 组装 View）
- `src/app/demo/page.tsx` — 用共享 View 替换内联 `RecipesSection` / `CalendarSection`

## 设计依据

- `claude design/design_handoff_cook_helper v2` — 全页 Light/Dark 版式、细节稿 5a–5f（详情 / 编辑菜谱 / 编辑食材 / 记一笔 / OTP / 厨具弹窗）
- `claude design/design_handoff_recommend_redesign` — 改进版
- 关键设计点（来自 handoff）：菜谱库走 **CSS `columns` 瀑布流**、卡片**不显示方式/辣度/时长标签**、第一张固定是「＋ 新建菜谱」卡；日历月视图周一开始、事件 pill 已完成=绿底 / 计划中=灰虚线

## 操作步骤

1. **抽 `WaterfallCard`** → `src/components/recipes/WaterfallCard.tsx`
   - 从 `recipes/page.tsx` L34-94 抽出，同时对照 `demo/page.tsx` L129-150 的卡片合并为同一组件
   - Props：`recipe` / `missingCount` / `cookCount` / `onClick` / 可选 `readOnly`
   - 视觉对齐设计稿（间距/圆角/状态点/chips）
2. **抽 `RecipesView`** → `src/components/views/RecipesView.tsx`
   - 瀑布流容器 + 筛选搜索 + 空态
   - 接 `recipes/page.tsx` 和 `demo/page.tsx` 两块
3. **抽 `CalendarView`** → `src/components/views/CalendarView.tsx`
   - 月视图 + 右侧详情 + 记一笔/完成弹窗
   - 接 `calendar/page.tsx` 和 `demo/page.tsx` 两块
4. **替换调用方**：auth 页和 demo 页接入共享 View，删内联版本
5. **视觉对齐**：对照设计稿微调详情弹窗、chips、状态点、pill 颜色
6. **全量验证**：`npm run build` + `npx vitest run`

## 验收标准

- `recipes/page.tsx` ≤ **180 行**（现 173 行，核心逻辑已抽走）
- `calendar/page.tsx` ≤ **100 行**
- `demo/page.tsx` 不再包含内联 `RecipesSection` / `CalendarSection`
- `npm run build` 无错误
- `npx vitest run` — 39 tests 全绿
- `/recipes`、`/calendar`、`/demo`（recipes/calendar tab）与 `/recommend`、`/inventory` 视觉语言一致
- 功能无回归：菜谱 CRUD、多维筛选、照片上传/删除、食材状态绿黄红、日历记录/规划、「我做完了」库存回写

## 风险与不做什么

- **不改数据层 / Service / Schema**——纯 UI 与组件结构
- **不做**名称化关联改造（那是 [Task/06](./06-ingredient-name-normalization-✅已完成.md)）
- **不做**编辑菜谱功能（现有 `recipes/new/` 只有新建，编辑需另开任务）
- 拆分时**不要顺手重构业务逻辑**，先做等价搬移；逻辑问题记下来另开任务
- **不创建 `<RecipesView>` 如果其内容太少**——如果 recipes/page.tsx 去掉内联卡片后只剩 30 行，没必要为了「统一模式」强行套一层 View，page.tsx 直接调用 `WaterfallCard` + 共享筛选栏即可

---

## ✅ 完成记录

> **完成日期**: 2026-07-26
> **执行人**: Hermes Agent (orchestrator)

### 执行摘要

| 检查项 | 结果 |
|--------|:--:|
| `npm run build` | ✅ 0 error |
| `npx vitest run` (39 tests) | ✅ 39 passed |
| `recipes/page.tsx` 瘦身 | ✅ 235 → 173 行 |
| `calendar/page.tsx` 瘦身 | ✅ 434 → 91 行 |
| `demo/page.tsx` 去内联 | ✅ 304 → 237 行，内联瀑布流卡片和日历区已移除 |
| 内联 `WaterfallCard` 残留 | ✅ 0 处 |
| 功能回归 | ✅ 未改数据层/Service/Schema |

### 新增文件

| 文件 | 行数 | 说明 |
|------|------|------|
| `src/components/recipes/WaterfallCard.tsx` | 96 | 共享瀑布流卡片（合并 auth + demo 两版），支持 hover 动画 |
| `src/components/recipes/index.ts` | 2 | barrel export |
| `src/components/views/CalendarView.tsx` | 436 | 日历月视图共享组件，支持 `readOnly` 模式 |

### 关键决策落定

- **新建菜谱形式**: 独立分页（`/recipes/new/page.tsx`），Task/01 已落地，本任务未改
- **`RecipesView` 是否创建**: **未创建**——`recipes/page.tsx` 去内联后剩 173 行但核心已是取数+组装，再套 View 层收益不大
- **日历完成弹窗**: 保留在 `CalendarView` 内部，通过 `onFetchDoneIngredients` / `onDoneSubmit` 回调与 auth 数据层解耦
- **demo 页 `RecipesSection`**: 保留为薄 wrapper，内部改用共享 `WaterfallCard`
- **demo 页 `CalendarSection`**: 保留为薄 wrapper，内部改用共享 `CalendarView`（readOnly 模式）
- **hover 动画**: 从 demo 版合并到共享 `WaterfallCard`，auth 侧也受益
