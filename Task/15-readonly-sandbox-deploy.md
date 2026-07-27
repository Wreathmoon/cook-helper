# 15 — 只读沙盒上线：cook.wreathmoon.com

> **状态**: 已上线待确认（2026-07-27）—— 站点活着，6 条验收全过；Step 3 回写 README 未做
> **依赖**: 04 ✅
> **阶段**: 本地化收尾

## 目标

把 `cook.wreathmoon.com` 变成一个**可公开访问的只读演示实例**：陌生人点进去能看到一个有 54 道菜谱、三档推荐都有内容的完整应用，任何写操作被优雅拒绝并引导去本地部署。

## 为什么做

[Task/04](./04-single-user-local-✅已完成.md) 删掉了 `/demo` 页，理由是「不再维护第二套假数据」——但那条「先看一眼」的入口是有价值的：**自托管项目最大的流失点是 onboarding**，让人先看到成品再决定要不要 clone，比让他们凭 README 想象强得多。

只读沙盒是这个入口的替代品，而且几乎是白拿的：同一份代码 + 一个环境变量。Vercel 的文件系统本来就是只读的，所以「不可写」不是要额外实现的限制，是环境本身的性质——我们只需要让它**优雅地**不可写。

> 定位见 [DESIGN.md](../DESIGN.md) §9：本地部署是主形态，沙盒只是橱窗。**它不是产品的一种部署方式，是 README 的一张截图的可交互版本。**

## 现状核实（2026-07-26 实测）

代码侧**全部就绪**，本地已验证：

| 项 | 证据 |
|----|------|
| 服务端拦截 | 15 个写函数首行都是 `assertWritable()`；5 个自动化测试守着（`src/lib/vault/__tests__/read-only.test.ts`） |
| 只读状态传到客户端 | `ReadOnlyProvider`（根布局注入）+ `useReadOnly()`，四个 View 已接上 |
| 顶部横幅 | `READ_ONLY=1` 起服务后实测出现「只读演示实例 —— 改动不会被保存」 |
| vault 根指向 `seed/` | `ensureVaultInitialized()` 在只读模式下直接返回 `SEED_DIR`，不尝试复制 |
| 写入真的被拒 | 浏览器点击写操作后 `seed/` 的 md5 校验和不变、无 `.tmp` 残留 |
| `seed/` 进部署产物 | `next.config.ts` 的 `outputFileTracingIncludes`；构建后每条路由的 `.nft.json` 含 64 个 seed 文件 |

**唯一没做的是「真的部署上去」**——那需要作者的 Vercel 账号与 DNS 控制权。

## 关键决策（已定）

- [x] **沙盒读什么数据** → 仓库里的 `seed/`，不是 `data/`。重启自动重置，无状态
- [x] **写入怎么拒绝** → 服务端 `assertWritable()` 抛 `VaultError('read_only')`，文案是**引导**（「clone 到本地跑一份」）而不是报错。客户端那层拦截只是省得用户白填表单，**不是安全边界**
- [x] **要不要做访客数据隔离 / 临时会话** → **不做**。沙盒是橱窗不是产品，谁进来看到的都是同一份种子数据
- [x] **`READ_ONLY` 是不是可选** → **必填**。不设的话应用会尝试写 `data/`，Vercel 只读文件系统直接 `EROFS`，整站起不来

## 交付物

- Vercel 项目（连 `Wreathmoon/cook-helper`，`READ_ONLY=1`）
- `cook.wreathmoon.com` 解析到该项目
- README 顶部一行演示链接（上线后再加，别提前写一个 404 的链接）

## 操作步骤

### Step 0 — 先 push ✅（2026-07-27 完成）

Vercel 从仓库拉代码，本地提交必须先上去：

```bash
git push origin master
```

> 原文写的是「本地的 4 个提交必须先上去」。那 4 个（`75ae15f` / `040413d` / `748a6a0` / `0ebc263`）
> 已于 2026-07-26 推送完毕，Vercel 拉的就是它们。2026-07-27 又推了 `0ae48e6`（文档）
> 与 `163d02d`（antd toast 修复）。**当前 `master == origin/master`。**

### Step 1 — 建 Vercel 项目

| # | 操作 |
|---|------|
| 1 | vercel.com → **Add New → Project** → Import `Wreathmoon/cook-helper` |
| 2 | Framework Preset 自动识别 Next.js；Root Directory 保持 `./`；Build Command 用默认 |
| 3 | **Environment Variables 加 `READ_ONLY` = `1`**，Production / Preview / Development 三个都勾 |
| 4 | Deploy |

⚠️ **不要设 `VAULT_PATH`**，让它保持默认。

### Step 2 — 绑域名

Settings → Domains → 加 `cook.wreathmoon.com`，然后在 DNS 加一条 CNAME 指向 `cname.vercel-dns.com`。

### Step 3 — 上线后回写 README

README 的「它能做什么」上面加一行：

```markdown
> 先看一眼：<https://cook.wreathmoon.com>（只读演示，改动不会被保存）
```

**等域名真的生效再加**——README 里放一个 404 链接比不放更糟。

## 验收标准

1. `https://cook.wreathmoon.com` 打开就是推荐页，**三档都有菜**（不是空壳、不是报错页）
2. 顶部有「只读演示实例 —— 改动不会被保存」横幅
3. 点任意写操作（改库存档位 / 添加食材 / 新建菜谱）→ 提示是**引导文案**，不是堆栈
4. 刷新页面，数据回到初始状态（沙盒无状态）
5. 菜谱详情里的照片位显示「还没有成品照」而不是加载失败（种子不带照片，属预期）
6. Vercel 的 Functions 日志里**没有 ENOENT / EROFS**

> 第 6 条是这次最容易翻车的地方，见下。

### 验收实测（2026-07-27，线上 https://cook.wreathmoon.com）

| # | 验收项 | 结果 |
|---|--------|:--:|
| 1 | 三档都有菜 | ✅ 49 食材 / 4 厨具；今日推荐 2 + 备选 10，`clear_stock` / `can_make_now` / `need_shopping` 三档均有条目 |
| 2 | 只读横幅 | ✅ |
| 3 | 写操作提示是引导文案 | ✅ **修复后通过**，见下 |
| 4 | 刷新回到初始状态 | ✅ 无状态 |
| 5 | 照片位不报错 | ✅ |
| 6 | 无 ENOENT / EROFS | ✅ 间接确认：全部路由 200 且正常渲染种子数据（Functions 日志需作者账号才能直接看） |

> ⚠️ **第 3 条一开始是不过的，而且根因不在只读逻辑。**
>
> 服务端完全正常——Server Action 返回 200，body 里就是设计好的引导文案。但**用户什么都看不到**：
> `message.error(res.error)` 静默失效，`.ant-message` 容器根本没被创建。
>
> 根因：antd v5 的静态 `message.*` 要从 `react-dom` 顶层取 `createRoot`/`render`，
> React 19 把两者都只留在 `react-dom/client` 了。**全项目 68 处 `message.*` 一起变哑**，
> 不只是只读提示——本地可写模式下「已把『X』写进今天的日历」同样不弹。
>
> 已修（`163d02d`）：`@ant-design/v5-patch-for-react-19` + `src/instrumentation-client.ts`，
> 详见 [SPEC.md](../SPEC.md) §8.1。线上复测：横幅在、点「就做这道」弹出引导文案、`seed/` 不变。
>
> **教训（与本任务 §风险 里那条「本地跑得通不构成部署可行的证据」同源）**：
> 服务端返回正确 ≠ 用户看得见。只读拦截的 5 个自动化测试全绿，因为它们断言的是
> **服务端拒绝写入**，没有一个断言**用户收到了提示**。断言链断在了最后一米。

## 风险与不做什么

- ⚠️ **忘了设 `READ_ONLY=1` → 整站起不来。** `ensureVaultInitialized()` 会尝试把 `seed/` 复制成 `data/`，Vercel 文件系统只读，直接 `EROFS`。**这是必填项，不是优化项。**
- ⚠️ **`seed/` 不进部署产物 → 每个页面 ENOENT。** 已由 `next.config.ts` 的 `outputFileTracingIncludes` 解决（[Task/04](./04-single-user-local-✅已完成.md) 补记 ②）。**动 `next.config.ts` 或改 vault 读取路径时，务必重新确认这条还成立**——本地 dev 永远发现不了这个问题，因为本地就在项目目录里跑。
- **不做**访客登录 / 临时 vault / 沙盒内数据隔离。想改数据的人应该去本地跑，这正是沙盒要引导的方向。
- **不做**把 `data/` 写到 `/tmp` 让沙盒"可写一会儿"。看着聪明，实际是给用户一个会凭空消失的假象——比明确的只读更伤。
- **不做**为沙盒单独维护一份「更好看的」种子数据。第二套数据 = 第二个会腐烂的真相源（这正是 `/demo` 页被删掉的原因）。
- **别把沙盒当可用性测试环境**。它是只读的，跑不了完整闭环；真要验证功能请在本地。
