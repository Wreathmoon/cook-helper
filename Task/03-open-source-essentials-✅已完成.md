# 03 — 开源要件：LICENSE + README + 文档入库

> **状态**: ✅ 已完成（2026-07-26 执行并推送，提交 `fe68c0c`）
> **依赖**: 01
> **阶段**: 近期收尾

## 目标

让这个仓库**在法律上和体验上真的是一个开源项目**，而不只是「代码放在公开仓库里」。

## 为什么做

路径 A 的核心诉求之一是「**别人能在我的基础上加点新功能、提点建议**」（见 [DESIGN.md](../DESIGN.md) §1.4）。而现状核实发现，这个诉求目前**在法律层面是不成立的**。

## 现状（2026-07-26 核实）

仓库 <https://github.com/Wreathmoon/cook-helper> 的实际状态：

| 项 | 现状 | 问题 |
|---|------|------|
| 可见性 | **Public** | PRD v2 记的「private」已过期 |
| **LICENSE** | **不存在** | ⚠️ **无 license 的公开仓库默认「保留所有权利」**——别人不能合法 fork / 修改 / 分发 / 贡献。这直接卡住路径 A 的核心目标 |
| README | 仍是 `create-next-app` 默认模板 | 开源项目的门面是空的 |
| `DESIGN.md` / `SPEC.md` / `FUTURE.md` / `Task/` | **被 `.gitignore` 显式忽略**（注释写「not for public repo」） | 与本任务原步骤直接冲突 → 已由决策 2 裁定 |
| `.env.example` | 不存在 | PRD v2 §9.2 的唯一 P0 项 |
| `.gitignore` | `.hermes/`、`.worktrees/`、`supabase/.temp/` **已在其中** | 原步骤 5 大部分已完成，只剩 `claude design/` |
| `.gitignore` 的 `.env*` | 会**连 `.env.example` 一起忽略** | 需补 `!.env.example`，否则交付物加不进去 |
| 未推送提交 | `1468ab6`（Task 01 成果） | 本任务收尾时一并推送 |

### 密钥排查 ✅ 已完成，结论：干净

2026-07-26 执行，无需轮换 key、无需清理历史：

```
git log --all -- .env.local          → 无输出（.env.local 从未被提交）
git log --all -S"eyJ" --oneline      → 3 处命中，逐个核实均为占位符：
  73c2ff1 / ab23f76  → NEXT-STEPS.md、PRD.md 里的 `eyJh...` 示例文本
  d99aef1            → stash（不进远端），同样是占位符
```

## 关键决策（全部已定）

- [x] **许可证 → MIT**
      理由：路径 A 不圈市场、不需要护城河（[DESIGN.md](../DESIGN.md) §1.4、§13 第 6 条），AGPL 防的「别人拿去开闭源 SaaS」在此项目不构成风险。MIT 摩擦最小，贡献者心理负担最低。

- [x] ~~**文档入库 → 只入 `DESIGN.md` 和 `SPEC.md`；`FUTURE.md` 和 `Task/` 继续仅本地保留**~~ → **已推翻，见下**
      理由：DESIGN/SPEC 是纯粹的项目资产，公开无代价；FUTURE/Task 含坦率的战略自述与路线图，不对外。
      ⚠️ **连带后果**：`DESIGN.md` 中有 6 处链接指向 `./FUTURE.md`，入库后在 GitHub 上全是死链 → 见步骤 5。（`SPEC.md` 0 处引用，无需处理。）

> ⚠️ **决策纠正（2026-07-27）**
>
> 本任务上面那条决策写着：「**`FUTURE.md` 和 `Task/` 继续仅本地保留**，理由：FUTURE/Task 含坦率的战略自述与路线图，不对外。」**该决策已被作者推翻。**
>
> **理由**：把它们排除在版本库外并没有换来「不对外」的实质好处，却付出了三项实打实的代价——
> ① 15 份任务文件 + FUTURE.md **只存在于作者一台机器上，没有任何备份**；
> ② `DESIGN.md` 里 6 处指向路线图的链接被降级成「保存在作者本地，未随仓库发布」这句**说明文字**，
>    读者（含 AI agent）从此无从得知下一步要做什么；
> ③ 实测扫过一遍，这批文档里**既无密钥也无个人信息**，所谓「坦率的战略自述」公开的代价近乎为零，
>    而它对协作者与 AI agent 的价值恰恰最高——这套四文档体系的意义就是让接手的人能自己读懂并接上。
>
> **因此**：`FUTURE.md` 与 `Task/` **已纳入版本库**（`.gitignore` 中对应两行已删除，提交 `b33581f`）。
> `claude design/` **仍然保持忽略**——那条决策（含已过期的 PRD 与来源不明的第三方产物）依然成立。
>
> **连带处置**：步骤 5 那 6 处被改写成说明文字的地方，其中 4 处在 `DESIGN.md` 中仍然存在且
> **已经变成错误陈述**（声称「未随仓库发布」），已于同日改回真实链接。步骤 5 的原则
> 「不要在 DESIGN.md 里另起一份公开路线图」**依然有效且已保留**——路线图仍然只有 FUTURE.md 一个家。

- [x] **`claude design/` → 不进仓库，仅本地保留**
      理由：其中 `00_PRD_v2.md` 内容已过期（仍记「仓库 private」），会误导贡献者与未来的 AI agent；两份 `support.js`（各 68K）是设计工具生成的第三方产物，来源与许可未知，不适合放进一个刚挂 MIT 的仓库。同理，其余中间过程文件也一律留本地。

- [x] **README 语言 → 先只写中文**
      英文版等作者的网站有双语能力后再补。理由：避免双语两份漂移（通常是英文那份先烂）。

- [x] **README 内容 → 本轮只写文字描述**
      截图与线上 Demo 实例链接**留到以后再补**。理由：挂公开 Demo 意味着一个对外开放的 Supabase 实例（涂鸦风险 + 配额成本），本轮不承担。

- [x] **`CONTRIBUTING.md` → 建，且用「厚版」（流程 + 项目约定）**
      理由：来提 PR 的人多半带着 AI 助手一起写，而 AI 会按训练数据里的旧 Next.js 产出「能编译但用了废弃写法」的代码，review 成本全落在作者身上。`AGENTS.md` 只有 AI 会自动读，人不会；`CONTRIBUTING.md` 是 GitHub 会主动推到人眼前的那个——同一条规矩放两处，是为两类读者。三条约定的最终措辞见步骤 4。

- [x] **`.gitignore` 的 `.env*` → 补 `!.env.example`**

## 交付物

- `LICENSE`（MIT）
- 重写的 `README.md`（中文，纯文字，无截图 / 无 Demo 链接）
- `CONTRIBUTING.md`（厚版）
- `.env.example`
- `DESIGN.md`、`SPEC.md` 纳入版本控制（`FUTURE.md`、`Task/` 保持忽略）
- 更新的 `.gitignore`
- `DESIGN.md` 6 处 FUTURE 死链改写

## 操作步骤

1. **添加 `LICENSE`**（MIT，版权行写 `Copyright (c) 2026 Wreathmoon`）；在 `package.json` 补 `"license": "MIT"`。
   > `package.json` 现有的 `"private": true` 是 npm 发布开关，与仓库可见性无关，**保持不动**。

2. **更新 `.gitignore`**——三处改动：

   ```diff
    # env files (can opt-in for committing if needed)
    .env*
   +!.env.example

   -# project blueprint docs (local AI agent reference, not for public repo)
   -DESIGN.md
   -SPEC.md
   -FUTURE.md
   +# project blueprint docs — DESIGN/SPEC 已入库，路线图与任务仅本地保留
   +FUTURE.md
    Task/
   +
   +# 设计过程文件（含已过期的 PRD 与第三方生成产物），仅本地保留
   +claude design/
   ```

3. **建 `.env.example`**，只列变量名不含值：
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   ```

4. **写 `CONTRIBUTING.md`**（厚版 = 流程段 + 项目约定段）

   **流程段**：clone → `npm i` → 复制 `.env.example` 为 `.env.local` 填值 → `npm run dev`（端口 **7474**）；提 PR 前跑 `npm run lint` 和 `npm run test`；提 Issue 请附复现步骤。

   **项目约定段**（措辞已定稿，照抄）：

   > **1. 写 Next 代码前先查本地文档，别凭记忆**
   >
   > 本项目锁定 Next 16.2.10（`package.json` 里是精确版本，不是 `^`），`npm ci` 装到的一定是它。
   >
   > 但 Next 16 比大多数人的经验、以及大多数 AI 助手的训练数据都要新——很多 API、约定和文件结构都变了。**凭印象写出来的 Next 代码可能能跑，但用的是已废弃的写法。**
   >
   > 这个版本的完整文档就在你本地：`node_modules/next/dist/docs/`。动手前读对应那篇，留意 deprecation 提示。

   > **2. 三档库存是刻意的设计**
   >
   > 库存分「充足 / 少量 / 没有」三档，不要「优化」成布尔值的有 / 无——整个推荐分层逻辑建立在它之上。

   > **3. 有些方向是刻意不做的**
   >
   > 提大功能 PR 之前，请先看 `DESIGN.md` §13「反模式清单」。那里列的不是「还没做」，是**认真评估过、决定不做**的方向，每条都附了理由——比如「用对话界面取代 GUI」「记忆检索上向量库」「做一个一屏看尽所有生活域的大盘」。
   >
   > 如果你看完仍然认为其中某条该做，**很欢迎——但请先开 Issue 讨论，别先写代码**。省得你白写，也省得我为难。

5. **改写 `DESIGN.md` 里的 6 处 FUTURE 死链**（`:4`、`:149`、`:317`、`:319`、`:389`、`:393`）
   把 `[FUTURE.md](../FUTURE.md)` 链接替换为说明文字，统一口径为：

   > 路线图与任务拆分保存在作者本地，未随仓库发布。

   ⚠️ **不要**为了补链接而在 `DESIGN.md` 里另起一份公开路线图——那会造成两处路线图漂移，违反「路线图只有一个家」。`:319` 那条「单一信源」提示需相应改写，但**结论不变**：DESIGN 不承载路线图。

6. **重写 `README.md`**（中文），至少包含：
   - 一句话定位 + 「家里有什么 → 能做什么菜 → 该买什么」
   - 技术栈（Next 16.2.10 / React 19 / Supabase / antd 5 / zustand）
   - **本地起步步骤**（含 `npm run dev` 端口是 **7474**）
   - 环境变量说明 → 指向 `.env.example`
   - 文档导航：**只指向 DESIGN.md 和 SPEC.md**（不要写 FUTURE / Task）
   - 贡献指引 → 指向 `CONTRIBUTING.md`
   - 许可证声明：MIT
   - 🚫 本轮不放截图、不放 Demo 链接

7. **文档入库并推送**
   ```bash
   git add DESIGN.md SPEC.md LICENSE README.md CONTRIBUTING.md .env.example .gitignore
   ```
   > 顺序要点：**必须先完成步骤 2 把 DESIGN/SPEC 从 `.gitignore` 里摘掉**，否则 `git add` 会被忽略规则挡下。
   >
   > 完成后连同未推送的 `1468ab6` 一起 `git push`。

## 验收标准

- 仓库根有 `LICENSE`（MIT），`package.json` 的 `"license": "MIT"` 与之一致
- README 不再包含 `create-next-app` 模板文字，且一个陌生人照着它能把项目跑起来
- `.env.example` 在仓库中可见（验证：`git ls-files | grep env` 有输出），且不含任何真实值
- `DESIGN.md` / `SPEC.md` 在 GitHub 上可见；`FUTURE.md` / `Task/` / `claude design/` **不可见**
- `DESIGN.md` 在 GitHub 上**没有指向 FUTURE.md 的死链**（验证：`grep -c "FUTURE.md" DESIGN.md` 结果为 0）
- `CONTRIBUTING.md` 存在，含三条项目约定
- `git status` 干净
- 本地提交已全部推送（`git log origin/master..HEAD` 无输出）

## 风险与不做什么

- **不做**代码改动
- **不清理 git 历史**（`filter-repo` / force push）——密钥排查已确认无泄露，且重写公开仓库历史会破坏别人的 fork 和 clone
- **不把 `FUTURE.md` / `Task/` / `claude design/` 推上去**，包括「就先传一份看看」
- **不在 `DESIGN.md` 里另开一份公开路线图**来填死链（见步骤 5）
- **不写英文 README**（等网站双语能力就绪再说），**不放 Demo 链接 / 截图**
