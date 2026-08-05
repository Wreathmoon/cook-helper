# Cook Helper

**一款本地运行的厨房管理 Web 应用，帮你回答三个问题：家里有什么 → 能做什么菜 → 该买什么。**

冰箱里剩下的东西，往往不是「今天吃什么」的答案，而是「今天吃什么」这个问题本身。Cook Helper 把你家里的库存、菜谱和厨具连起来，按「现在真的做得出来」的程度给你排菜，顺便告诉你差哪几样得去买。

**数据全部以纯文本文件存在你自己的磁盘上**——没有账号，没有云端，没有任何要填的 key。`git clone` 之后三行命令就能跑起来，而且开箱自带 54 道菜谱。

> 先看一眼：<https://cook.wreathmoon.com>（只读演示，改动不会被保存）

---

## 它能做什么

- **库存管理** — 食材分五大类记录，状态分「充足 / 少量 / 没有」三档，而不是简单的有 / 无
- **智能推荐** — 基于当前库存与厨具做分层推荐：**能直接做的**、**差一点就能做的**、**该清库存的**，并给出「为什么推荐它」的理由
- **菜谱管理** — 记录做法、用时、难度、口味标签、所需食材与厨具，可加成品照
- **购物清单** — 从「差一点就能做」的菜倒推出该买什么，可填参考价估算花销
- **烹饪日历** — 排菜、打卡、回顾吃过什么
- **厨具管理** — 没有蒸锅就不会给你推荐需要蒸锅的菜

## 你的数据是一堆你能读懂的文件

所有数据都在 `data/` 目录下，是普通的 YAML 和 Markdown：

```
data/kitchen/
  recipes/宫保鸡丁/recipe.md      # 一菜一目录，照片就放在旁边
  inventory/vegetable.yaml        # 库存按分类分文件，按名称排序
  utensils.yaml
  calendar/2026-07.yaml
  aliases.yaml                    # 「番茄 = 西红柿」，可自行增补
  config.yaml                     # 推荐算法的权重和阈值，改完重启生效
```

拿记事本打开就能看懂、能改，改完刷新页面即时生效；改坏了会告诉你**是哪个文件第几行**。想备份就 `git init`，想同步就把目录扔进 iCloud / Dropbox。格式规范见 [docs/vault-format.md](./docs/vault-format.md)。

> 应用只是这堆文件的一个**透镜**，不是**牢笼**——哪天你不用它了，数据还是你的，而且还能读。

## 技术栈

| | |
|---|---|
| 框架 | Next.js 16.2.10（App Router）+ React 19 |
| 语言 | TypeScript |
| UI | Ant Design 5 + Ant Design Pro Components + Tailwind CSS 4 |
| 状态 | Zustand |
| 存储 | **纯文本文件**（YAML + Markdown），无数据库、无后端服务 |
| 校验 | Zod —— 手改坏了文件时给出指向具体文件与行号的报错 |
| 测试 | Vitest + Testing Library |

推荐逻辑是**纯 TypeScript 规则引擎**，不依赖任何大模型——没有 API key 也完全可用。

## 本地运行

需要 Node.js 20+。**不需要数据库，不需要注册，不需要配置任何环境变量。**

```bash
git clone https://github.com/Wreathmoon/cook-helper.git
cd cook-helper
npm install
npm run dev
```

浏览器打开 <http://localhost:7474>（**注意端口是 7474，不是默认的 3000**）。

第一次启动时，仓库自带的种子数据（`seed/`）会被复制成你自己的 `data/` 目录——所以打开就能看到 54 道菜谱、49 种食材和一份三档都有内容的推荐，而不是一个空壳。想推倒重来：删掉 `data/` 再启动即可。

### 可选配置

| 环境变量 | 作用 |
|---|---|
| `VAULT_PATH` | 把数据放到别处（比如 iCloud / Dropbox 目录）。默认 `./data` |
| `READ_ONLY` | 设为 `1` 时所有写入被优雅拒绝，用于部署只读演示实例 |

### 用 Docker 跑（不想装 Node 的话）

```bash
docker compose up --build    # 首次
docker compose up -d         # 之后
docker compose down          # 停
```

同样是 <http://localhost:7474>，同样首次启动就有 54 道菜。

**数据还是你目录下的 `data/`**——容器挂的就是它，所以 `npm run dev` 和 Docker 两种跑法可以随时互换，不会各自存一份。想把数据放到 iCloud / Dropbox，改 [docker-compose.yml](./docker-compose.yml) 里 `volumes` 那行左半边即可。

> ⚠️ **端口默认只对本机开放**（`127.0.0.1:7474:7474`）。
> 想让手机连家里的机器，把那个 `127.0.0.1:` 前缀删掉就行——但**这个应用没有任何认证**，
> 删掉之后同一个网络里的任何设备都能读写你的全部数据。自己权衡，别默认开着。

Linux 上如果报权限错误：容器以 uid 1000 运行，你的 uid 不是 1000 时（`id -u` 看一眼），
按 [docker-compose.yml](./docker-compose.yml) 里的注释取消 `user:` 那行的注释。

### 其他命令

```bash
npm run build    # 生产构建
npm run lint     # 代码检查
npm run test     # 跑测试
```

## 文档

- [DESIGN.md](./DESIGN.md) — 项目是什么、为什么这样设计。架构、理念、关键决策，以及一份「明确不做什么」的反模式清单
- [SPEC.md](./SPEC.md) — 怎么实现的。数据格式、路由表、Service 签名、部署步骤
- [docs/vault-format.md](./docs/vault-format.md) — 数据文件的格式规范（想手改文件或写导入脚本时看这份）

## 贡献

欢迎。动手前请先读 [CONTRIBUTING.md](./CONTRIBUTING.md)——里面有几条这个项目特有的约定，不知道的话容易白写一轮。

## 许可证

[MIT](./LICENSE)
