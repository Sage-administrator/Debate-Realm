/**
 * Auth 初始化插件 — 从存储恢复认证状态，并校验 session 有效性
 *
 * 为什么是 .client.ts 后缀？
 * - 我们用 Cookie 存 token，SSR 阶段也能从 Cookie 读取
 * - 但 /api/auth/me 的 session 校验只需要在客户端做（防止 SSR 请求被防火墙拦截）
 * - SSR 阶段的状态恢复放在 auth.global.ts 中间件里做（更早执行）
 */
export default defineNuxtPlugin(() => {
  const store = useAuthStore()

  // 从存储恢复状态（Cookie 优先，localStorage 兜底）
  // 注意：SSR 阶段在中间件里已经调用过 loadFromStorage 了
  // 这里再调一次确保客户端状态正确（比如 Cookie 在客户端被修改的情况）
  store.loadFromStorage()

  // 如果有 token，验证 session 是否仍然有效（检查是否被其他设备踢下线）
  // 性能优化：改为「非阻塞」——踢下线检测在后台进行，不再 await，
  // 避免每次首屏加载都因这一次 API 往返而延迟客户端水合（hydration），让首屏更快可交互。
  // 即使本次检测稍晚返回，后续任意 API 调用也会经 auth-fetch 拦截器兜底处理 401。
  if (store.isAuthenticated) {
    const router = useRouter()
    $fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${store.token}` },
    }).catch((e: unknown) => {
      // 只有明确的 401 认证错误才清除登录状态
      // 网络错误、500 等不应该清除，避免误踢用户下线
      const status = (e as any)?.response?.status || (e as any)?.statusCode
      const isAuthError = status === 401
      if (isAuthError) {
        store.clearAuth()
        if (!window.location.pathname.startsWith('/login')) {
          router.push('/login?reason=kicked')
        }
      }
    })
  }
})
