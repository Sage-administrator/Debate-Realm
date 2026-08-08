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
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', '.output', '.nuxt'],
    // 测试超时时间（某些集成测试可能需要更长时间）
    testTimeout: 10000,
  },
})
