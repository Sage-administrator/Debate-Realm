export default defineNuxtRouteMiddleware((to) => {
  const store = useAuthStore()

  // 登录页处理
  if (to.path === '/login') {
    // 如果是被踢下线跳转过来的，始终允许访问登录页（即使 localStorage 中有残留的旧认证数据）
    if (to.query.reason === 'kicked') {
      // 清除残留的旧认证数据，确保登录页不会误判为已登录
      if (import.meta.client) {
        store.clearAuth()
      }
      return
    }

    // 已认证用户访问登录页 → 直接跳转首页
    if (store.isAuthenticated) {
      return navigateTo('/')
    }
    return
  }

  // 公开报名页：允许免登录访问（/tournaments/[id]/register）
  if (/^\/tournaments\/[^/]+\/register$/.test(to.path)) {
    return
  }

  // 公开辩题投票页：允许免登录访问（/tournaments/[id]/topic-vote）
  // 仅投票页本身放行，管理页 topic-votes 仍需登录
  if (/^\/tournaments\/[^/]+\/topic-vote$/.test(to.path)) {
    return
  }

  // 其他页面需要认证
  if (!store.isAuthenticated) {
    if (import.meta.client) {
      // 检查 localStorage 中是否有旧的 token（说明可能是被踢下线）
      const savedToken = localStorage.getItem('auth_token')
      if (savedToken) {
        return navigateTo('/login?reason=kicked')
      }
      return navigateTo('/login')
    }
    return
  }
})
