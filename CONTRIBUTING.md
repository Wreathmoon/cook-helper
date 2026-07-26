# 贡献指南

欢迎来加功能、报 bug、提建议。

---

## 本地跑起来

```bash
git clone https://github.com/Wreathmoon/cook-helper.git
cd cook-helper
npm install
npm run dev
```

**不需要数据库，不需要注册，不需要配 environment variables。** 首次启动会把仓库里的
`seed/` 复制成你自己的 `data/` 目录，打开就有 54 道菜谱可玩。想重置：删掉 `data/` 再启动。

开发服务器跑在 **7474** 端口（不是默认的 3000），浏览器打开 <http://localhost:7474>。

## 提 PR 之前

```bash
npm run test
```

94 个测试必须全绿。其中 **18 个推荐引擎测试**（`tiering` 10 + `scoring` 8）请格外当心：
它们是这个项目核心价值的回归基准，独立于数据层。**如果你发现「得改这些测试才能过」，
那说明你正在改变推荐行为——停下来先想清楚，或者开个 Issue 说说为什么。**

```bash
npm run lint
```

0 error。有 17 个 warning 是历史遗留的 `no-unused-vars`，不阻断，但**别新增**。

## 提 Issue

报 bug 请附上复现步骤、期望行为、实际行为。提功能建议请先看下面第 3 条。

---

## 动手前必读

这四条是这个项目特有的约定，不知道的话很容易白写一轮。

### 1. 写 Next 代码前先查本地文档，别凭记忆

本项目锁定 Next 16.2.10（`package.json` 里是精确版本，不是 `^`），`npm ci` 装到的一定是它。

但 Next 16 比大多数人的经验、以及大多数 AI 助手的训练数据都要新——很多 API、约定和文件结构都变了。**凭印象写出来的 Next 代码可能能跑，但用的是已废弃的写法。**

这个版本的完整文档就在你本地：`node_modules/next/dist/docs/`。动手前读对应那篇，留意 deprecation 提示。

### 2. 数据是纯文本文件，不是数据库

没有 Supabase，没有 Postgres，没有 ORM。所有数据都是 `data/` 下的 YAML / Markdown，
由 `src/lib/vault/` 读写，格式规范见 [docs/vault-format.md](./docs/vault-format.md)。

判断一个设计好不好的标准始终是：**用户能不能拿记事本打开、看懂、改对。** 任何需要
专用工具才能读写的格式都是错的。加字段之前先想想它在文件里长什么样。

### 3. 三档库存是刻意的设计

库存分「充足 / 少量 / 没有」三档，不要「优化」成布尔值的有 / 无——整个推荐分层逻辑建立在它之上。

### 4. 有些方向是刻意不做的

提大功能 PR 之前，请先看 [DESIGN.md](./DESIGN.md) §13「反模式清单」。那里列的不是「还没做」，是**认真评估过、决定不做**的方向，每条都附了理由——比如「用对话界面取代 GUI」「记忆检索上向量库」「做一个一屏看尽所有生活域的大盘」。

如果你看完仍然认为其中某条该做，**很欢迎——但请先开 Issue 讨论，别先写代码**。省得你白写，也省得我为难。

---

## 想了解项目全貌

- [DESIGN.md](./DESIGN.md) — 项目是什么、为什么这样设计（架构、理念、关键决策、反模式清单）
- [SPEC.md](./SPEC.md) — 怎么实现的（数据格式、路由、Service 签名、部署步骤）
- [docs/vault-format.md](./docs/vault-format.md) — 数据文件的格式规范
