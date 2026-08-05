import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * 把 seed/ 强制打进 serverless 产物。
   *
   * 只读沙盒（READ_ONLY=1）在运行时直接读 `seed/` 当 vault，但读取路径是
   * `path.join(process.cwd(), 'seed')` 动态拼出来的——Next 的静态文件追踪看不见它，
   * 默认不会把这些文件打包，部署到 Vercel 后会 ENOENT。
   *
   * key 是**路由 glob**（picomatch 匹配路由路径），用 `/**` 覆盖全部嵌套路由；
   * value 是**相对项目根**的文件 glob。见
   * node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md
   */
  outputFileTracingIncludes: {
    "/**": ["./seed/**/*"],
  },

  /**
   * Docker 镜像用 `.next/standalone`（自带最小 server.js + 只挑出来的 node_modules），
   * 否则镜像里要塞整个 node_modules，体积差一个量级。
   *
   * **为什么是环境变量开关而不是常开**：Vercel 上的只读沙盒
   * (cook.wreathmoon.com) 已经验收通过（Task/15），它走的是平台自己的构建产物，
   * 不需要 standalone。常开等于在没法本地复现的环境里改一个已验收的部署路径——
   * 收益为零，风险不为零。只有 Dockerfile 会设这个变量。
   *
   * 见 node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md
   */
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
};

export default nextConfig;
