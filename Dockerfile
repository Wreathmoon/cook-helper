# Cook Helper —— 自托管镜像
#
# 三阶段：装依赖 → 构建 standalone 产物 → 只带运行时文件的最终镜像。
# 构建：  docker compose up --build      （或 docker build -t cook-helper .）
#
# 两件容易踩的事，都在下面对应位置写了注释：
#   1. seed/ 必须进镜像，否则首次启动没有数据可复制
#   2. 数据卷的属主必须能被容器内的 nextjs 用户写

# Next 16.2.10 要求 node >= 20.9。锁小版本，避免「昨天还能构建」。
ARG NODE_VERSION=20.19-alpine

# ---------- 1. 依赖 ----------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
# 只 COPY 清单文件：改代码不会让这一层失效，装依赖的几十秒就省下来了
COPY package.json package-lock.json ./
RUN npm ci

# ---------- 2. 构建 ----------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 打开 next.config.ts 里那个开关，产出 .next/standalone
ENV BUILD_STANDALONE=1
# 构建期不该向外发遥测
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- 3. 运行 ----------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 不用 root 跑 web 服务。直接用 node 官方镜像自带的 `node` 用户（uid/gid 都是
# 1000）——别再 adduser 一个 uid 1000，会撞上 `gid '1000' in use` 构建失败。
# 1000 同时对齐了大多数 Linux 桌面用户的第一个账号，绑定挂载的 ./data 属主
# 通常就是它；属主对不上就是一屏 EACCES。需要别的 uid 时用 compose 的
# `user:` 覆盖，不要改这里。

# standalone 产物自带一个最小 server.js，以及被追踪到的那部分 node_modules
COPY --from=builder --chown=node:node /app/.next/standalone ./
# 静态资源与 public/ 不在 standalone 里，得手动搬（见 Next 的 output.md）
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

# seed/ 靠 next.config.ts 的 outputFileTracingIncludes 进的追踪结果，理论上
# standalone 里已经有了。仍然显式复制一遍：这份数据是「首次启动就有 54 道菜」
# 的全部来源，宁可镜像多 200KB，也不要因为追踪规则变动而线上空库。
COPY --from=builder --chown=node:node /app/seed ./seed

# 运行时 vault。先建好并给对属主，这样即使宿主机挂进来的是空目录，
# 首次启动也能把 seed/ 复制进来（见 src/lib/vault/init.ts 的 hasContent）。
RUN mkdir -p /app/data && chown node:node /app/data

USER node

# 7474 是这个项目的固定端口，不是 Next 默认的 3000
ENV PORT=7474
# 容器里必须绑 0.0.0.0，否则端口映射打不通（这不等于把服务暴露给局域网——
# 那由 compose 里的 ports 绑定地址决定，见 docker-compose.yml）
ENV HOSTNAME=0.0.0.0
EXPOSE 7474

CMD ["node", "server.js"]
