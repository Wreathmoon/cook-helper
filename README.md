# Cook Helper

**一款厨房管理 Web 应用，帮你回答三个问题：家里有什么 → 能做什么菜 → 该买什么。**

冰箱里剩下的东西，往往不是「今天吃什么」的答案，而是「今天吃什么」这个问题本身。Cook Helper 把你家里的库存、菜谱和厨具连起来，按「现在真的做得出来」的程度给你排菜，顺便告诉你差哪几样得去买。

---

## 它能做什么

- **库存管理** — 食材分五大类记录，状态分「充足 / 少量 / 没有」三档，而不是简单的有 / 无
- **菜谱管理** — 记录做法、用时、难度、口味标签、所需食材与厨具，支持配图
- **智能推荐** — 基于当前库存与厨具做分层推荐：**能直接做的**、**差一点就能做的**，并给出「为什么推荐它」的理由
- **购物清单** — 从「差一点就能做」的菜倒推出该买什么
- **烹饪日历** — 排菜、打卡、回顾吃过什么
- **厨具管理** — 没有烤箱就不会给你推荐需要烤箱的菜
- **Demo 模式** — 免登录体验，用的是内置示例数据

## 技术栈

| | |
|---|---|
| 框架 | Next.js 16.2.10（App Router）+ React 19 |
| 语言 | TypeScript |
| UI | Ant Design 5 + Ant Design Pro Components + Tailwind CSS 4 |
| 状态 | Zustand |
| 后端 | Supabase（Postgres + Auth + RLS + Storage）|
| 测试 | Vitest + Testing Library |

推荐逻辑是**纯 TypeScript 规则引擎**，不依赖任何大模型——没有 API key 也完全可用。

## 本地运行

需要 Node.js 20+ 和一个 Supabase 项目。

```bash
git clone https://github.com/Wreathmoon/cook-helper.git
cd cook-helper
npm install
```

复制环境变量模板并填入你自己的 Supabase 项目信息：

```bash
cp .env.example .env.local
```

需要填三个变量，都能在 Supabase 控制台的 Project Settings → API 找到：

| 变量 | 说明 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key，会暴露给浏览器，正常 |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key，**仅服务端使用，切勿泄露** |

数据库结构和初始化脚本见 [SPEC.md](./SPEC.md)。

然后启动：

```bash
npm run dev
```

浏览器打开 <http://localhost:7474>（**注意端口是 7474，不是默认的 3000**）。

想先看看长什么样，可以直接访问 `/demo`，不需要注册。

### 其他命令

```bash
npm run build    # 生产构建
npm run lint     # 代码检查
npm run test     # 跑测试
```

## 文档

- [DESIGN.md](./DESIGN.md) — 项目是什么、为什么这样设计。架构、理念、关键决策，以及一份「明确不做什么」的反模式清单
- [SPEC.md](./SPEC.md) — 怎么实现的。数据库 Schema、路由表、Service 函数签名、部署步骤

## 贡献

欢迎。动手前请先读 [CONTRIBUTING.md](./CONTRIBUTING.md)——里面有三条这个项目特有的约定，不知道的话容易白写一轮。

## 许可证

[MIT](./LICENSE)
