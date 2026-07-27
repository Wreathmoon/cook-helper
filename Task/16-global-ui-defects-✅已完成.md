# 16 — 两个全局 UI 缺陷：toast 全哑 + 全站滚不动

> **状态**: ✅ 已完成（2026-07-27）
> **依赖**: 04 ✅
> **阶段**: 本地化收尾

## 目标

修掉两个**影响全站、但此前无人发现**的 UI 缺陷：

1. `message.*` 提示一个都不弹（68 处调用全部静默失效）
2. 所有页面都无法滚动，超出一屏的内容被永久裁掉

## 为什么做

两者的共同点是：**它们都不是「某个功能坏了」，而是一整层机制坏了**，
而项目已有的 94 个测试**结构上不可能发现它们**——那批测试全是 node 环境的纯函数测试，
碰不到 DOM，也碰不到浏览器渲染。

第 1 条还直接让 [Task/15](./15-readonly-sandbox-deploy.md) 的验收标准第 3 条不成立：
只读拦截的服务端完全正确，但用户点下去看不到任何反馈。

> **它们是怎么被发现的**：第 1 条是在验收 Task/15 时点「就做这道」发现的（页面毫无反应）；
> 第 2 条是作者自己用的时候发现的。**两条都不是测试发现的**——这本身是最该记住的一点。

## 缺陷一：antd 静态 message 在 React 19 下静默失效

### 现状核实（实测）

```
react / react-dom  19.2.4
antd               5.29.3
@ant-design/v5-patch-for-react-19   未安装
```

```js
// node -e
Object.keys(require('react-dom')).includes('createRoot')  // false
Object.keys(require('react-dom')).includes('render')      // false
```

antd 的 `message.*` 走 `unstableSetRender()` → `rc-util/lib/React/render`，
后者要从 **`react-dom` 顶层**取 `createRoot` 或 `render`。React 19 把两者都只留在
`react-dom/client` 了 → holder 挂不上 → **静默失败**。

浏览器实测：点击写操作后 `document.querySelector('.ant-message')` 为 `null`；
Server Action 返回 200 且 body 里就是正确的引导文案。

**为什么线上一点线索都没有**：antd 那句兼容警告被 `process.env.NODE_ENV !== 'production'`
包着，生产构建里被剥掉了。console 干净、network 200、UI 无反应。

### 影响面

`git grep -o "message\.\(error\|success\|warning\|info\)" -- 'src/**/*.tsx' | wc -l` → **68 处，10 个文件**。
不只是只读提示——本地可写模式下「已把『X』写进今天的日历」「库存已更新」「照片保存失败」同样一个都不弹。

### 修法

`@ant-design/v5-patch-for-react-19@1.0.3` + `src/instrumentation-client.ts`（该 Next 约定
**在 React 水合前执行**，早于任何 `message.*` 调用）。

⚠️ **不要**改成在某个 `'use client'` 组件的 `useEffect` 里引入——那样执行时机晚于水合，
且不保证早于第一次 `message.*`。

## 缺陷二：全站无法滚动

### 现状核实（1280×500，`/recommend`，修复前实测）

| 元素 | display | overflow-y | clientH | scrollH | |
|------|---------|-----------|---------|---------|---|
| 内容槽（`app-layout.tsx:161`） | **block** | hidden | 469 | 631 | 162px 被裁且滚不到 |
| `.page-body` | block | auto | 554 | 554 | 高度=内容高度，永不滚动 |

`.page-body.scrollTop = 300` → 读回仍是 `0`。`document` 也不可滚。
即**整棵树没有任何可滚元素**，所以鼠标滚轮无处可滚。

### 根因

`.page-body` 靠 `flex:1; overflow:auto` 当滚动容器，这要求**父级是高度受限的 flex column**。
而内容槽写的是 `flex:1; overflow:hidden`，**缺 `display:flex`**：
`.page-body` 的 `flex:1` 失效 → 高度退化成内容高度 → `overflow:auto` 永不触发 →
溢出部分被内容槽的 `overflow:hidden` 裁掉。

**第二处**：`/recipes/new` 的根是个裸 `<div>`，完全没进 `.page-body` 契约。
所以第一处修完它**仍然**滚不动（852px 内容塞进 469px，提交按钮在被裁的 383px 里），
且内容紧贴侧边栏无留白（`h1` left 214 = 侧边栏宽度，其余页面均有 24px 内边距）。

### 修法

- `app-layout.tsx:161` 内容槽补 `display:flex; flexDirection:column; minHeight:0`
- `recipes/new/page.tsx` 根元素补 `className="page-body"`（同时修好滚动与内边距）

> `minHeight:0` 是必需的：flex item 默认 `min-height:auto`，不解除的话它会被内容撑破，
> 而不是把溢出交给子级滚动。

## 关键决策落定

- [x] **toast 用官方兼容包，而不是把 68 处改成 `App.useApp()`** —— 后者是 antd 推荐的「正统」写法，
      但要动 10 个文件、且每处都得拿到 hook 上下文；补丁包一行 import 解决全部，
      且升级 antd v6 时连依赖一起删就能退场。**改动面 1 行 vs 68 处，且前者可逆。**
- [x] **补丁放 `instrumentation-client.ts` 而不是根布局组件** —— 必须早于第一次 `message.*`，
      而根布局是组件、执行时机在水合期间；`instrumentation-client` 是 Next 明确保证「水合前」的钩子。
- [x] **滚动修在布局层，不给每个页面单独加 `overflow:auto`** —— 后者是 6 处重复且下一个新页面还会再犯。
      根因只有一处，就修那一处，并把契约写进 [SPEC.md](../SPEC.md) §3.2.1。
- [x] **`/recipes/new` 用 `.page-body` 而不是自己写一套样式** —— 它本来就该在契约里，
      之前是漏了；顺带补齐了它缺失的内边距。

## 交付物

- `src/instrumentation-client.ts`
- `src/lib/utils/__tests__/antd-message.test.ts`（3 个用例，项目首个 jsdom 测试）
- `src/components/layout/app-layout.tsx` 内容槽修正 + 说明注释
- `src/app/recipes/new/page.tsx` 接入 `.page-body`
- [SPEC.md](../SPEC.md) §3.2.1 页面滚动契约、§8.1 客户端启动补丁

## 验收标准

```bash
npm run build     # 0 error
npx vitest run    # 97 passed
npm run lint      # 0 error
```

滚动（浏览器 console，逐页跑）：

```js
const b = document.querySelector('.page-body');
getComputedStyle(b.parentElement).display === 'flex';   // 必须 true
b.scrollTop = 99999; b.scrollTop > 0 || b.scrollHeight <= b.clientHeight;  // 必须 true
```

## 风险与不做什么

- ⚠️ **不要**把 `antd-message.test.ts` 当成「可以删的多余测试」。它守的东西**没有任何其它测试覆盖**，
  且这个 bug 的特征就是「静默」——删了它，下次 antd 或 React 升级把补丁弄失效时不会有任何人知道。
  这个测试实测过「去掉补丁就变红」。
- ⚠️ **不要**为了「统一」把全局测试环境从 `node` 改成 `jsdom`。只有这一个文件需要 DOM，
  靠文件头 `// @vitest-environment jsdom` 单独声明；全局改会让另外 94 个纯函数测试凭空变慢。
- **不做**把 68 处 `message.*` 重构成 `App.useApp()`（见上方决策）。
- **不做**给 `main` 或 `body` 加 `overflow:auto` 让整页滚动——那会让侧边栏跟着滚上去，
  与 `100vh` 固定侧边栏的设计冲突。滚动必须留在 `.page-body` 内部。

---

## ✅ 完成记录

> **完成日期**: 2026-07-27
> **执行人**: Claude Code

### 执行摘要

| 检查项 | 修复前 | 修复后 |
|--------|:--:|:--:|
| `npm run build` | 通过 | ✅ 通过 |
| `npx vitest run` | 94 passed | ✅ **97 passed**（10 个文件） |
| `npm run lint` | 0 error / 17 warn | ✅ 0 error / 17 warn（未变） |
| `.ant-message` 挂载 | ❌ `null` | ✅ 挂载且含引导文案 |
| 可滚动路由 | **0 / 6** | ✅ **6 / 6** |
| `seed/` 进部署产物 | 64 文件 | ✅ 64 文件（11 条路由，改动后复查） |

### 新增文件

| 文件 | 行数 | 说明 |
|------|:--:|------|
| `src/instrumentation-client.ts` | 12 | 水合前引入 antd × React 19 补丁 |
| `src/lib/utils/__tests__/antd-message.test.ts` | 62 | 3 用例；项目首个 jsdom 测试 |

### 逐路由滚动实测（本地生产构建，1280×500）

| 路由 | 内容槽 display | scrollH / clientH | 结果 |
|------|:--:|:--:|:--:|
| `/recommend` | flex | 557 / 423 | ✅ 滚到 134 |
| `/recipes` | flex | 3579 / 500 | ✅ 滚到 3079 |
| `/inventory` | flex | 2085 / 438 | ✅ 滚到 1647 |
| `/utensils` | flex | 438 / 438 | ✅ 内容不足一屏，无需滚动 |
| `/calendar` | flex | 578 / 500 | ✅ 滚到 78 |
| `/recipes/new` | flex | 843 / 500 | ✅ 滚到 343；`h1` left 214 → 238（补回内边距） |

线上复测 `/recipes/new`：`scrollH 852 / clientH 469`，滚到 383。

### 一个诚实的缺口

**没能驱动真正的原生鼠标滚轮。** 浏览器面板未显示，截图超时；JS 合成的 `WheelEvent`
浏览器不认（只响应可信输入），实测 `afterWheelEvent: 0`。

所以严格说：已验证的是「容器确实可滚动」（`overflow:auto` + 内容超出 + `scrollTop` 赋值生效），
「原生滚轮可用」是由此推断的——修复前**整棵树没有任何可滚元素**（滚轮自然无处可滚），
修复后有了。因果链成立，但这一环是推断而非实测，作者已自行确认。

### 顺带修正的文档错误

| 位置 | 问题 |
|------|------|
| `DESIGN.md` ×4 处 | 声称「路线图保存在作者本地，未随仓库发布」——FUTURE.md 入库后**变成错误陈述**，已改回真实链接 |
| [Task/03](./03-open-source-essentials-✅已完成.md) 决策 | 「FUTURE/Task 仅本地保留」已被推翻，按规范补了带日期的决策纠正块，未静默删除 |
| [Task/15](./15-readonly-sandbox-deploy.md) Step 0 | 「4 个提交待 push」已过时 |

### 教训

**服务端返回正确 ≠ 用户看得见。** 只读拦截有 5 个自动化测试全绿，
因为它们断言的是**服务端拒绝写入**，没有一个断言**用户收到了提示**——断言链断在最后一米。

**同类风险仍在**：本项目至今没有任何组件级 / 端到端测试。
`antd-message.test.ts` 是第一个碰 DOM 的测试，但它只覆盖 toast 这一条。
渲染层的其它约束（比如刚写进 SPEC §3.2.1 的滚动契约）**目前仍然只靠人肉发现**。
