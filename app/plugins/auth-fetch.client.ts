/**
 * Auth Fetch 客户端拦截插件
 * 全局拦截 401 响应，自动清除认证状态并跳转登录页
 * 解决被强制退出登录后无法回到登录页的问题
 *
 * 注意：不覆盖 globalThis.$fetch / nuxtApp.$fetch 的全局引用，
 * 而是通过 nuxtApp.hook 拦截每个组件的 fetch 调用，
 * 避免破坏 Nuxt 内部 manifest 加载等核心功能。
 */
export default defineNuxtPlugin((nuxtApp) => {
  const store = useAuthStore()
  const router = useRouter()

  // 只在客户端运行
  if (!import.meta.client) return

  // 保存原始 $fetch 引用（从 globalThis 获取，比 nuxtApp.$fetch 更早可用）
  const _originalFetch: typeof $fetch = (globalThis as any).$fetch

  // 如果原始 fetch 不可用（极小概率），放弃拦截避免造成更大问题
  if (!_originalFetch || typeof _originalFetch !== 'function') {
    console.warn('[auth-fetch] 无法获取原始 $fetch，本次会话将不拦截 401')
    return
  }

  /**
   * 包装后的 fetch：截获 401/403 响应，自动清除认证并跳转登录
   */
  async function wrappedFetch(request: any, options?: any): Promise<any> {
    try {
      return await _originalFetch(request, options)
    } catch (error: any) {
      // 检测 401 / 403 未认证响应
      const status = error?.response?.status || error?.statusCode
      const isAuthError = status === 401 || status === 403

      if (isAuthError && store.isAuthenticated) {
        // 清除本地认证状态
        store.clearAuth()
        // 跳转到登录页（仅当不在登录页时）
        if (!window.location.pathname.startsWith('/login')) {
          router.push('/login?reason=kicked')
        }
      }

      throw error
    }
  }

  // 保留原始 fetch 的方法属性（如 raw、native、create 等 ofetch 扩展）
  Object.assign(wrappedFetch, _originalFetch)

  // 替换 globalThis 上的 $fetch，使组件的 auto-import $fetch 能使用包装版本
  ;(globalThis as any).$fetch = wrappedFetch
  // 同步 nuxtApp 上的引用
  nuxtApp.provide('$fetch', wrappedFetch)
})
