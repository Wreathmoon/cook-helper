# Cook Helper

**一款本地运行的厨房管理 Web 应用，帮你回答三个问题：家里有什么 → 能做什么菜 → 该买什么。**

冰箱里剩下的东西，往往不是「今天吃什么」的答案，而是「今天吃什么」这个问题本身。Cook Helper 把你家里的库存、菜谱和厨具连起来，按「现在真的做得出来」的程度给你排菜，顺便告诉你差哪几样得去买。

**数据全部以纯文本文件存在你自己的磁盘上**——没有账号，没有云端，不用填 key。`git clone` 之后三行命令就能跑起来，而且开箱自带 54 道菜谱。

> 先看一眼：<https://cook.wreathmoon.com>（只读演示，改动不会被保存）

---

## 它能做什么

- **库存管理** — 食材分五大类记录，状态分「充足 / 少量 / 没有」三档，而不是简单的有 / 无
- **智能推荐** — 基于当前库存与厨具做分层推荐：**能直接做的**、**差一点就能做的**、**该清库存的**，并给出「为什么推荐它」的理由
- **菜谱管理** — 记录做法、用时、难度、口味标签、所需食材与厨具，可加成品照
- **购物清单** — 从「差一点就能做」的菜倒推出该买什么，可填参考价估算花销
- **烹饪日历** — 排菜、打卡、回顾吃过什么
- **厨具管理** — 没有蒸锅就不会给你推荐需要蒸锅的菜
- **记忆** — 「我不吃辣」「花生过敏」这类偏好写成 `memory/` 下的 markdown，你随时能打开改删。配好模型后它会真的影响推荐：命中的菜标出理由、冲突的下沉到末尾（**只下沉不删除**）。没配时会明确标成「未生效」（见[可选配置](#可选配置)）
- **命令栏（⌘K）** — 「帮我排三天的菜，避开最近吃过的」这类筛选器写不出来的请求。需要配模型

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
data/memory/
  no-spicy.md                     # 一条记忆一个文件，放进去就算数
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

推荐逻辑是**纯 TypeScript 规则引擎**，不依赖任何大模型——没有 API key 也完全可用。规则引擎不会被 AI 取代，只会被它增强。

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
| `AI_BASE_URL` | OpenAI 兼容端点，例：`https://api.openai.com/v1` |
| `AI_API_KEY` | **你自己的** key。只存在服务端，永远不会进浏览器 |
| `AI_MODEL` | 默认模型，例：`gpt-4o` |
| `AI_VISION_MODEL` | 看图用的模型。不填就用 `AI_MODEL` |
| `AI_VISION_BASE_URL` | 看图的模型**在另一个端点上**时填，例：`http://localhost:11434/v1`。不填就用 `AI_BASE_URL` |
| `AI_VISION_API_KEY` | 那个端点的 key。不填就用 `AI_API_KEY` |

**上面这些都不配也能用。** 库存、菜谱、日历、推荐（分档 / 清库存 / 不重样）全都不需要 key。

需要 key 的是三个功能：

- **AI 录入**（拍照 / 小票 / 一句话 → 自动更新库存和日历）
- **命令栏（⌘K）**：「帮我排三天的菜，避开最近吃过的」这类筛选器表达不出来的请求。它调的是同一个规则引擎，**任何改动都会先给你看一眼再落库，且可撤销**。
- **记忆**：「我不吃辣」「花生过敏」这类偏好的判断全部交给模型（这样才能理解自然语言，而不是硬套字段）。配好之后，推荐页会按记忆给菜标注理由、把冲突的下沉到末尾（**只下沉不删除**，这样模型判错了你一眼能看出来）。没配时记忆能写能看但**不会影响推荐**——页面上会明确标成「未生效」，不会让你以为它在保护你。

#### 关于 key：给什么用什么

这个项目**不绑定任何一家厂商**，也不代管你的 key。接的是 OpenAI 兼容协议，所以官方 API、中转站、本机的 Ollama / vLLM 都能用——把 `AI_BASE_URL` 指过去就行。

`AI_VISION_MODEL` 单独存在，是因为**你的默认模型可能不是多模态的**（DeepSeek 这类）。那种情况下把它指向一个能看图的模型，拍照录入就能用，其余功能照旧走默认模型。

而那个能看图的模型**常常不在同一个端点上**——最典型的组合就是「云端的文本模型 + 本机跑的视觉模型」。所以视觉角色的端点和 key 也能单独指：

```
# 文本走 DeepSeek 官方 API
AI_BASE_URL=https://api.deepseek.com/v1
AI_API_KEY=sk-你的key
AI_MODEL=deepseek-chat

# 看图走本机 Ollama 上的 Qwen VL
AI_VISION_BASE_URL=http://localhost:11434/v1
AI_VISION_API_KEY=ollama
AI_VISION_MODEL=qwen2.5vl:7b
```

三个 `AI_VISION_*` **各自独立回落**：只填模型名就只换模型（同一端点上的另一个模型），填了端点就整体挪过去。一个都不填的话，看图就用默认模型——**单端点用户什么都不用改**。

> 本机端点的两个坑：模型名要和 `ollama list` 里的 tag 逐字一致（`qwen2.5vl:7b` 而不是 `qwen2.5-vl`）；`AI_VISION_API_KEY` 随便填个非空值即可，Ollama 不校验，但配置读取要求非空。**用 Docker 跑本应用时** `localhost` 指的是容器自己，要改成 `host.docker.internal`。

配好之后可以先验一下通不通，再去点界面：

```bash
npx tsx --env-file=.env.local scripts/verify-ai.ts
```

想连视觉一起验，把图片路径跟在后面：`npx tsx --env-file=.env.local scripts/verify-ai.ts 冰箱.jpg`。这个脚本会真的发请求（两次很小的请求）。

> ⚠️ `--env-file` 不能省。`npm run dev` 会自动读 `.env.local`，**但 `tsx` 不会**——漏掉它会得到一句「三个变量全缺」，那是假阴性，不是你的配置有问题。（需要 Node 20.6+）

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
