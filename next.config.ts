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
};

export default nextConfig;
