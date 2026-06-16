/**
 * Auth 客户端初始化插件 — 从 localStorage 恢复认证状态
 * 仅在客户端运行，避免 SSR 水合不匹配
 */
export default defineNuxtPlugin(() => {
  const store = useAuthStore()
  store.loadFromStorage()
})
