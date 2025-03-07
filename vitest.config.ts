import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      "@vue/shared": path.resolve(__dirname, "packages/shared/src")
    }
  },
  test: {
    globals: true, // 启用全局变量
    pool: "threads", // 使用线程池
    environment: "node", // 使用 node 环境
    coverage: {
      provider: "v8", // 使用 v8 覆盖率
      reporter: ["text", "json", "html"], // 使用 text、json、html 报告
      include: ["packages/**/__test__/**/*.spec.ts"], // 包含测试文件
    },
  },
})