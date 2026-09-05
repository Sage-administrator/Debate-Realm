import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      // #shared 别名：与 nuxt.config.ts 保持一致，确保测试代码可引用共享模块
      '#shared': resolve(__dirname, 'shared'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    // 桥接 Nuxt 自动导入到 node 测试环境（见 tests/setup/auto-imports.ts）
    setupFiles: ['./tests/setup/auto-imports.ts'],
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', '.output', '.nuxt'],
    // 测试超时时间（某些集成测试可能需要更长时间）
    testTimeout: 10000,
    // 覆盖率配置（需先安装 npm i -D @vitest/coverage-v8，然后运行 npm run test:coverage）
    // coverage: {
    //   provider: 'v8',
    //   reporter: ['text', 'text-summary', 'lcov'],
    //   include: ['server/utils/**', 'app/utils/**', 'shared/schemas/**', 'app/stores/**'],
    // },
  },
})
