/**
 * Auth 初始化插件 — 从存储恢复认证状态，并校验 session 有效性
 *
 * 为什么是 .client.ts 后缀？
 * - 我们用 Cookie 存 token，SSR 阶段也能从 Cookie 读取
 * - 但 /api/auth/me 的 session 校验只需要在客户端做（防止 SSR 请求被防火墙拦截）
 * - SSR 阶段的状态恢复放在 auth.global.ts 中间件里做（更早执行）
 */
export default defineNuxtPlugin(async () => {
  const store = useAuthStore()

  // 从存储恢复状态（Cookie 优先，localStorage 兜底）
  // 注意：SSR 阶段在中间件里已经调用过 loadFromStorage 了
  // 这里再调一次确保客户端状态正确（比如 Cookie 在客户端被修改的情况）
  store.loadFromStorage()

  // 如果有 token，验证 session 是否仍然有效（检查是否被其他设备踢下线）
  if (store.isAuthenticated) {
    try {
      await $fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${store.token}` },
      })
    } catch (e: unknown) {
      // 只有明确的 401 认证错误才清除登录状态
      // 网络错误、500 等不应该清除，避免误踢用户下线
      const status = (e as any)?.response?.status || (e as any)?.statusCode
      const isAuthError = status === 401

      if (isAuthError) {
        // session 验证失败（被踢下线），清除认证状态
        store.clearAuth()
        // 重定向到登录页并携带踢下线标记
        const router = useRouter()
        router.push('/login?reason=kicked')
      }
      // 其他错误（如网络错误、500）：保留登录状态，不做处理
      // 用户仍然可以正常使用，只是这次 session 校验失败了
    }
  }
})
