# 09 — 本地 Web 服务形态（自托管增强：Docker）

> **状态**: ✅ 已完成（2026-08-04）
> **依赖**: 04（原为 08）
> **阶段**: 本地化增强

> ⚠️ **范围变更（2026-07-26）—— 读下面正文之前先读这一段**
>
> [Task/04](./04-single-user-local-✅已完成.md) 已把「单用户免登录 + 本地 vault + 首次启动自带种子数据」整块做掉了。下面正文的决策清单里，**四条已经有答案**：
>
> | 原开放问题 | 已定答案（见 [Task/04](./04-single-user-local-✅已完成.md)） |
> |-----------|--------------------------------------------------|
> | 认证怎么处理？加「本地模式」开关还是编译期分叉？ | **都不用**——Supabase Auth / RLS / middleware **彻底删除**，不存在需要旁路的东西，也不存在第二种模式 |
> | 首次启动没有 vault 时怎么引导？ | **从仓库自带的 `seed/` 复制**一份人工调好档位的默认 vault（54 菜 + 48 食材），无引导步骤，开箱即有内容 |
> | vault 目录路径怎么配？ | 环境变量 `VAULT_PATH`，默认落在 `data/`（进 `.gitignore`） |
> | 端口沿用 7474 吗？ | 是，`package.json` 的 `dev` 脚本已是 `next dev -p 7474`，无需改动 |
>
> **本任务剩下的是纯增值项**，做不做都不影响「能跑起来」：
>
> - **Docker / docker-compose** —— 对自托管人群最友好，是 Home Assistant 那群人的习惯
> - **局域网访问**（绑 `0.0.0.0` 而非 `localhost`）—— 廉价地部分解决移动端。⚠️ 若做，**必须**明确告知它没有认证
> - **`npx` 一行启动命令** —— 降低启动门槛
> - **README 的本地部署章节** —— 但基础版本已在 Task/04 的交付物里
>
> **因此本任务从「本地化的必要一环」降级为「自托管体验增强」，可以延后。** 依赖关系随之从 08 改为 04。

> ✅ **范围再次收窄（2026-08-04，执行时定）**
>
> 上面四个增值项，**这一轮只做 Docker**（作者选定）。另外三项的处置见下面「关键决策」的 ⑤ ⑥ ⑦——
> **不是忘了，是明确不做**，各有理由。

## 目标

让 Cook Helper 能作为**本地 Web 服务**跑起来：起在本机，浏览器访问，读写本地 vault，**免登录**。

Docker 这一轮补的是最后一段：**一条 `docker compose up --build` 就有一个在跑的实例**，不需要装 Node、不需要 `npm install`、不需要知道端口是 7474。

## 为什么做

这是已定的短期形态（[FUTURE.md](../FUTURE.md) §1.5）：**本地 vault + 本地 Web 服务，先不做桌面 App。**

选这条路的原因：Next.js 已经是服务端框架，本地跑起来读文件是**最短路径**；而桌面端打包（Tauri / Electron）是另一个量级的工程，收益主要在「双击启动」的体验，可以后置。

Docker 的理由不同于「更方便」——它是**自托管人群的默认交付形态**（[DESIGN.md](../DESIGN.md) §12 里 Home Assistant / Firefly III 那一挂全是这么发的）。对他们而言「有没有 compose 文件」几乎等于「这个项目认不认真」。

## 当前状态（执行前核实）

| 事实 | 核实方式 |
|------|---------|
| 没有任何 Docker 文件 | `ls` 仓库根目录 —— 无 `Dockerfile` / `docker-compose.yml` / `.dockerignore` |
| `next.config.ts` 只有 `outputFileTracingIncludes` | 读文件，**没有** `output: 'standalone'` |
| 端口 7474 已固化在 `dev` 脚本 | `package.json:7` |
| `VAULT_PATH` / `READ_ONLY` 已实现 | `src/lib/vault/paths.ts:17,29` |
| 测试 97 个全绿 | `npx vitest run` |
| 仓库里当时没有 `data/` 目录 | `ls -d data` → 不存在（所以 compose 的首次启动路径能被真实跑到） |

## 关键决策

- [x] **① 镜像怎么构建？** → **`output: 'standalone'` + 三阶段 Dockerfile**。
  standalone 只带被追踪到的那部分 `node_modules`（18MB，对比完整 `node_modules` 差一个量级），Next 官方 Docker 模板走的也是这条。
  最终镜像 **279MB**。

- [x] **② `output: 'standalone'` 常开还是门控？** → **门控，`BUILD_STANDALONE=1`，只有 Dockerfile 会设。**
  常开等于在没法本地复现的环境里，改一条**已经验收通过**的部署路径（[Task/15](./15-readonly-sandbox-deploy-✅已完成.md) 的 Vercel 沙盒）。收益为零，风险不为零。
  已验证：`npm run build` 不带这个变量时不产出 `.next/standalone`，`seed` 仍在 `.nft.json` 追踪结果里。

- [x] **③ 数据卷怎么挂？** → **绑定挂载 `./data:/app/data`**，不用 named volume。
  理由是**两种跑法共用同一份数据**：`npm run dev` 和 `docker compose up` 读写的是同一个 `./data`，可以随时互换，不会出现「Docker 里的我和本地的我数据不一样」。named volume 藏在 Docker 内部，直接违背「你的数据是你能打开的一堆文件」这条 ethos。

- [x] **④ 端口绑哪儿？** → **`127.0.0.1:7474:7474`，只绑回环。**
  容器内必须 `HOSTNAME=0.0.0.0`（否则端口映射打不通），但**对外只绑回环**——这两件事常被混为一谈。
  已实测：从本机的非回环地址（172.21.240.1）访问 7474 **连不上**。
  compose 里那行 `127.0.0.1:` 前缀带了三行注释说明它是安全边界，去掉的后果是「同网段任何人可读写你的全部数据」。

- [x] **⑤ 局域网访问做不做？** → **不做**（本轮）。
  ④ 已经把开关和风险都摆在 compose 文件里了，想开的人删七个字符即可，还能就地读到警告。再加一对 `dev:lan` / `start:lan` 脚本属于把同一件事说第二遍，而且**脚本比注释更容易被不读文档的人用上**——一个没有认证的应用，默认路径不该更容易通向暴露。

- [x] **⑥ `npx` 一行启动做不做？** → **不做。**
  它不是「顺手加个脚本」，是**把项目发布成 npm 包**：bin 入口、把 `seed/` 打进 tarball、版本管理、`npm publish`。对一个明确不商业化、首要用户是作者自己的项目（[FUTURE.md](../FUTURE.md) §0 第 1 条），维护一条对外发布通道的性价比是负的。Docker 已经覆盖了「不想装 Node 的人」这个真实人群。

- [x] **⑦ 镜像推 registry 吗？** → **不推**（作者选定）。仓库里给 Dockerfile，用户自己 `docker compose up --build`。零对外发布动作。

- [x] **⑧ README 加自托管章节吗？** → **加**（作者最初选择不加，执行后追加）。
  理由很直接：README 是自托管用户的第一落点，Dockerfile 不在那里露出就等于不存在。
  落点是「本地运行」下的 `### 用 Docker 跑（不想装 Node 的话）`，三条命令 + 数据目录与 `npm run dev` 共用的说明 + 端口绑定的安全警告 + Linux uid 不匹配的处置。
  **完整规格仍在 [SPEC.md](../SPEC.md) §10.3**，README 只讲「怎么用」，不讲「怎么构建的」。

## 交付物

| 文件 | 说明 |
|------|------|
| `Dockerfile` | 三阶段：`npm ci` → `BUILD_STANDALONE=1 npm run build` → alpine 运行时，以 `node` 用户（uid 1000）跑 |
| `docker-compose.yml` | 端口 / 卷 / 环境变量，注释里写清端口绑定的安全含义与 uid 不匹配时怎么办 |
| `.dockerignore` | `data/` 绝不进镜像；`node_modules` / 文档 / 本地状态挡在上下文外 |
| `next.config.ts` | 加 `BUILD_STANDALONE` 门控的 `output` |
| `src/lib/vault/init.ts` | 初始化判据「目录存在」→「目录非空」 |
| `src/lib/vault/__tests__/init.test.ts` | 5 个用例，守住上面那条 |
| `SPEC.md` §10.3 + §10.4 | Docker 部署规格 + 4 条验证清单 |
| `README.md` | 「用 Docker 跑」一节：三条命令 + 数据目录共用 + 端口安全警告 + uid 处置 |

## 操作步骤

1. `next.config.ts` 加 `output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined`
2. `src/lib/vault/init.ts`：`existsSync(root)` → `hasContent(root)`（非空判断）
3. 补 `src/lib/vault/__tests__/init.test.ts`
4. 写 `Dockerfile` / `.dockerignore` / `docker-compose.yml`
5. `docker build` → `docker run` 挂空目录 → 确认种子被复制、写权限正常、重启不丢数据
6. `docker compose up -d` 跑一遍文档里那条命令本身
7. 回写 [SPEC.md](../SPEC.md) §9 / §10 / §11
8. [README.md](../README.md) 加「用 Docker 跑」一节

## 验收标准

- 一台干净机器上，照着 README 能在 **5 分钟内**跑起来并看到自己的数据
- 无需注册、无需任何云服务 key，全部功能可用（AI 功能除外，那需要 BYOK）
- 关掉网络后依然完全可用
- vault 目录可任意指定，切换目录即切换数据集

Docker 追加的四条（对应 [SPEC.md](../SPEC.md) §10.4 第 11–14 条）：

```bash
rm -rf data && docker compose up --build   # ./data 出现 54 个菜谱目录
docker port cook-helper                    # 只有 127.0.0.1:7474
# 改一条库存 → docker compose restart → 改动还在
npm run build                              # 不产出 .next/standalone
```

## 风险与不做什么

- **不做**桌面端打包（明确短期不做）
- **不做**自建同步服务
- **不做**手机原生 App；若开放局域网访问，手机浏览器访问算附带收获，不是承诺
- ⚠️ 若决定开放局域网访问，**必须**明确说明它没有认证——不能让用户在不知情下把自己的数据暴露在局域网里
- ⚠️ **不要**把 `output: 'standalone'` 改成常开——那会动到已验收的 Vercel 沙盒构建路径，且本地复现不了
- ⚠️ **不要**在 Dockerfile 里 `adduser --uid 1000`——官方 node 镜像已经有 uid 1000 的 `node` 用户，会 `gid '1000' in use` 构建失败
- ⚠️ **不要**用 named volume 替掉绑定挂载——数据藏进 Docker 内部就不再是「你能打开的一堆文件」

---

## ✅ 完成记录

> **完成日期**: 2026-08-04
> **执行**: Claude Code

### 执行摘要

| 检查项 | 结果 |
|-------|:--|
| `npx vitest run` | ✅ **102 passed**（97 → 102，新增 5） |
| `npm run lint` | ✅ 0 error（17 warning，均为改动前既有） |
| `npm run build`（默认） | ✅ 编译通过，**不产出** `.next/standalone`，`seed` 仍在 `.nft.json` 里 |
| `BUILD_STANDALONE=1 npm run build` | ✅ 产出 `.next/standalone`（32MB，其中 node_modules 18MB），`seed/kitchen/recipes` 54 个 |
| `docker build` | ✅ 镜像 **279MB** |
| 空目录绑定挂载 → 种子复制 | ✅ 宿主机空 `data/` → 容器启动后 54 个菜谱目录、5 个库存分类，`seed/README.md` 未泄漏 |
| 非 root 写入挂载卷 | ✅ 容器内 `whoami` = `node`，写入成功 |
| 重启后数据保留 | ✅ 手改一条库存 → `docker restart` → 改动仍在，菜谱仍是 54（没被 seed 盖回） |
| `docker compose up -d` | ✅ 起来，`/recommend` 200，vault 解析成功 |
| 端口只绑回环 | ✅ `docker port` → `127.0.0.1:7474`；从 172.21.240.1:7474 访问**连不上** |

### 新增文件

| 文件 | 行数 | 说明 |
|------|:--:|------|
| `Dockerfile` | 71 | 三阶段构建 → standalone 运行时 |
| `docker-compose.yml` | 41 | 端口 / 卷 / 环境变量，含安全注释 |
| `.dockerignore` | 34 | `data/` 绝不进镜像 |
| `src/lib/vault/__tests__/init.test.ts` | 79 | 5 个用例守首次初始化 |

### 改动文件

| 文件 | 改动 |
|------|------|
| `next.config.ts` | 加 `BUILD_STANDALONE` 门控的 `output: 'standalone'` |
| `src/lib/vault/init.ts` | 初始化判据改为「目录非空」，新增 `hasContent()` |
| `SPEC.md` | v2.4 → v2.5；§9 文件树、§10.3 Docker、§10.4 验证清单 11–14、§11 测试 97 → 102 |

### 过程中改掉的两个真 bug

1. **空目录 = 已初始化** —— 原 `ensureVaultInitialized()` 判断 `existsSync(root)`。`docker compose up` 先把宿主机 `./data` 建成空目录再挂进容器，于是种子复制被跳过，用户拿到空 vault 加一句「找不到 kitchen/」，而且**删了重来也没用**——挂载点每次都会被重建。改成非空判断。这个坑对手动 `mkdir data` 的人同样成立，不是 Docker 独有。
2. **`adduser --uid 1000` 构建失败** —— 官方 node 镜像自带 uid/gid 1000 的 `node` 用户，第一次构建直接 `addgroup: gid '1000' in use`。改用自带用户。

### 一个值得记下来的验证陷阱

页面全是 **static shell + Server Actions 取数**（[SPEC.md](../SPEC.md) §3.3）。所以「容器起来了、页面返回 200」**完全不能证明 vault 读到了**——静态 HTML 是构建期产物，vault 根本没被碰。
真正的探针是 `GET /api/photo?path=...`：它是唯一的动态路由，且在做扩展名检查**之前**先调 `getVault()`，返回 415 就说明整个 vault 已解析成功。下次验证部署时别再被 200 骗了。

### 明确未做（不是遗漏）

| 项 | 决策 |
|---|---|
| 局域网访问脚本 | ⑤ 不做——开关与警告已在 compose 里，加脚本会让「暴露」比「不暴露」更顺手 |
| `npx` 一行启动 | ⑥ 不做——需要发布 npm 包，性价比为负 |
| 镜像推 registry | ⑦ 不做——作者选定，零对外发布动作 |

> README 自托管章节（⑧）**最初定为不做，执行后作者追加**，已完成。本任务无遗留缺口。
