// ESLint 扁平配置（ESLint v9+ / Nuxt 4 推荐格式）
// @nuxt/eslint 自动配置 TypeScript、Vue、Nuxt 专属规则
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // 全局忽略规则
  {
    ignores: [
      'node_modules',
      '.output',
      '.nuxt',
      '.nitro',
      '.cache',
      'dist',
      '.data',
      'server/lib/generated',
      'public/uploads',
    ],
  },

  // 全局规则覆盖
  {
    rules: {
      // 关闭可能冲突的规则（根据项目实际情况调整）
      'vue/multi-word-component-names': 'off', // 单字组件名在辩论赛场景中很常见
      'vue/no-v-html': 'warn', // v-html 使用需谨慎
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    },
  },
)
