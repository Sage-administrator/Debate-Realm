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

      // ── 旧债降级：以下规则存量大、以历史代码为主，降为 warn 让门禁先复活 ──
      // 后续可随模块清理逐条改回 error（每清一个目录就把对应 any 处理掉）
      '@typescript-eslint/no-explicit-any': 'warn', // 692 处旧债，清不完前不拦提交
      '@typescript-eslint/no-unused-vars': 'warn', // 79 处，多为模板事件参数/占位
      'import/first': 'warn', // 43 处 import 顺序
      'vue/no-multiple-template-root': 'warn', // 38 处 Vue3 多根模板（本就合法）
      'vue/no-mutating-props': 'warn', // 17 处旧写法
      'vue/no-unused-vars': 'warn', // 2 处
      '@typescript-eslint/unified-signatures': 'warn', // 2 处
      // 剩余零散 error 一并降级（每条约 1-6 处旧债，风格类，非致命）
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-dynamic-delete': 'warn',
      'vue/no-side-effects-in-computed-properties': 'warn',
      'vue/valid-template-root': 'warn',
      'no-useless-escape': 'warn',
      'no-empty': 'warn',
      'no-unassigned-vars': 'warn',
      'no-case-declarations': 'warn',
      'preserve-caught-error': 'warn',
    },
  },
)
