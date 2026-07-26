# 贡献指南

欢迎来加功能、报 bug、提建议。

---

## 本地跑起来

```bash
git clone https://github.com/Wreathmoon/cook-helper.git
cd cook-helper
npm install
```

复制 `.env.example` 为 `.env.local`，填入你自己的 Supabase 项目信息：

```bash
cp .env.example .env.local
```

然后：

```bash
npm run dev
```

开发服务器跑在 **7474** 端口（不是默认的 3000），浏览器打开 <http://localhost:7474>。

## 提 PR 之前

```bash
npm run test
```

39 个测试必须全绿。

```bash
npm run lint
```

⚠️ **lint 目前跑不干净**——仓库有一批历史遗留问题（约 36 个 error，主要是 `no-unused-vars` 和 `no-explicit-any`），清理工作尚未排期。所以这里的要求不是「零 error」，而是**别引入新的**：改动前后各跑一次，数字不增加即可。

## 提 Issue

报 bug 请附上复现步骤、期望行为、实际行为。提功能建议请先看下面第 3 条。

---

## 动手前必读

这三条是这个项目特有的约定，不知道的话很容易白写一轮。

### 1. 写 Next 代码前先查本地文档，别凭记忆

本项目锁定 Next 16.2.10（`package.json` 里是精确版本，不是 `^`），`npm ci` 装到的一定是它。

但 Next 16 比大多数人的经验、以及大多数 AI 助手的训练数据都要新——很多 API、约定和文件结构都变了。**凭印象写出来的 Next 代码可能能跑，但用的是已废弃的写法。**

这个版本的完整文档就在你本地：`node_modules/next/dist/docs/`。动手前读对应那篇，留意 deprecation 提示。

### 2. 三档库存是刻意的设计

库存分「充足 / 少量 / 没有」三档，不要「优化」成布尔值的有 / 无——整个推荐分层逻辑建立在它之上。

### 3. 有些方向是刻意不做的

提大功能 PR 之前，请先看 [DESIGN.md](./DESIGN.md) §13「反模式清单」。那里列的不是「还没做」，是**认真评估过、决定不做**的方向，每条都附了理由——比如「用对话界面取代 GUI」「记忆检索上向量库」「做一个一屏看尽所有生活域的大盘」。

如果你看完仍然认为其中某条该做，**很欢迎——但请先开 Issue 讨论，别先写代码**。省得你白写，也省得我为难。

---

## 想了解项目全貌

- [DESIGN.md](./DESIGN.md) — 项目是什么、为什么这样设计（架构、理念、关键决策、反模式清单）
- [SPEC.md](./SPEC.md) — 怎么实现的（数据库 Schema、路由、Service 签名、部署步骤）
