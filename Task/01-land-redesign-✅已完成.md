# 01 — 落地并提交当前重设计

> **状态**: ✅ 已完成 (2026-07-26)
> **依赖**: 无
> **阶段**: 近期收尾

## 目标

把工作树里已经改完但未提交的重设计**验证通过并提交**，让仓库回到干净状态——后面所有任务都以此为起点。

## 为什么做

工作树目前有 **-2583 行 / +322 行**的未提交改动，业务逻辑已从页面抽到了 `src/components/views/` 和 `src/components/recommend/`。这坨改动不落地，任何后续任务都在脏工作树上操作，出问题时无法二分定位。

同时这次抽取**验证出了一套可复用的组件拆分模式**，[Task/02](./02-recipes-calendar-redesign-✅已完成.md) 要照抄它来拆 `recipes/page.tsx`。

## 现状（已核实）

已修改（`git diff --stat`）：

```
src/app/(auth)/calendar/page.tsx     |    4 +-
src/app/(auth)/inventory/page.tsx    |  269 +------
src/app/(auth)/recipes/page.tsx      |   52 +-
src/app/(auth)/recommend/page.tsx    |  933 ++----------------------
src/app/(auth)/utensils/page.tsx     |  224 +-----
src/app/demo/page.tsx                | 1291 +++-------------------------------
src/app/globals.css                  |   98 ++-
src/components/layout/app-layout.tsx |   34 +-
8 files changed, 322 insertions(+), 2583 deletions(-)
```

未跟踪（新增的抽取产物）：

```
src/components/views/       index.ts, InventoryView.tsx, RecommendView.tsx, UtensilsView.tsx
src/components/recommend/   index.ts, HeroCard.tsx, AltCard.tsx, NoPhotoCard.tsx,
                            FilterPopover.tsx, ShoppingPanel.tsx, EmptyState.tsx
```

**覆盖范围**：recommend / inventory / utensils / demo 已重设计；**recipes 与 calendar 未跟进**（交给 Task/02）。

## 关键决策

- [ ] 这坨改动是否就这样提交，还是需要先人工过一遍界面？
- [ ] 拆一个 commit 还是按模块拆多个 commit？
- [ ] `claude design/`（设计稿，含 `.dc.html` + `support.js`）是否进版本控制？→ 归 [Task/03](./03-open-source-essentials-✅已完成.md) 一并处理

## 交付物

- 一个（或一组）通过构建与测试的 commit
- 干净的 `git status`（除刻意保留的未跟踪目录）

## 操作步骤

1. **验证构建**
   ```bash
   npm run build
   ```
2. **验证测试**（应为 39 tests 全绿）
   ```bash
   npx vitest run
   ```
3. **人工过一遍受影响页面**（本地 `npm run dev`，注意端口是 **7474** 不是 3000）
   - `/recommend`：主推卡 / 备选卡 / 筛选 chips / 购物清单勾选回填
   - `/inventory`：分类卡 + segmented 三档点击即存
   - `/utensils`：行卡列表
   - `/demo`：5 个视图 + 写操作 toast
   - 顺带确认 light / dark 主题切换无破图
4. **提交**（`src/components/views/`、`src/components/recommend/` 需 `git add`）
5. 若第 1、2 步失败 → 先修，不要带着失败提交

## 验收标准

- `npm run build` 无错误
- `npx vitest run` 39 tests 全绿
- 上述 4 个页面在 light / dark 下均可正常交互
- `git status` 中 `src/` 下无残留未提交改动

## 风险与不做什么

- **不做** recipes / calendar 的重设计——那是 Task/02，别把范围混进来
- **不做** 功能增强，本任务只是「落地已有改动」
- 若发现重设计破坏了某个既有功能，**先修再提交**，不要留「稍后再说」

---

## ✅ 完成记录

> **完成日期**: 2026-07-26
> **执行人**: Hermes Agent (orchestrator)
> **Commit**: `1468ab6` — `feat: Recommend/Inventory/Utensils/Demo 重设计落地，组件抽离到 views/ 和 recommend/`

### 执行摘要

| 检查项 | 结果 |
|--------|:--:|
| `npm run build` | ✅ 0 error |
| `npx vitest run` | ✅ 39 passed |
| 代码提交 | ✅ 20 files, +1776 / -2583 |
| `.worktrees/t_4339efd1` 清理 | ✅ 已 remove |
| `git status` 干净 (`src/` 下) | ✅ 仅 `claude design/` 未跟踪（归 Task 03） |

### 关键决策落定

- **提交粒度**: 单 commit（用户决策）
- **`claude design/`**: 不进版本控制，归 Task 03（用户确认）
- **`.gitignore`**: 新增 DESIGN/SPEC/FUTURE/Task/.hermes/.worktrees/supabase/.temp
