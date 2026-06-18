/**
 * Auth 客户端初始化插件 — 从 localStorage 恢复认证状态，并校验 session 有效性
 * 仅在客户端运行，避免 SSR 水合不匹配
 */
export default defineNuxtPlugin(async () => {
  const store = useAuthStore()
  store.loadFromStorage()

  // 如果有 token，验证 session 是否仍然有效（检查是否被其他设备踢下线）
  if (store.isAuthenticated) {
    try {
      await $fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${store.token}` },
      })
    } catch (_e: unknown) {
      // session 验证失败（可能被踢下线），清除认证状态
      store.clearAuth()
      // 重定向到登录页并携带踢下线标记
      const router = useRouter()
      router.push('/login?reason=kicked')
    }
  }
})
