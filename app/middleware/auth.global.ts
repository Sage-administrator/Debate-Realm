export default defineNuxtRouteMiddleware((to) => {
  const store = useAuthStore()

  // 登录页：已登录则跳转首页
  if (to.path === '/login') {
    if (store.isAuthenticated) {
      return navigateTo('/')
    }
    return
  }

  // 其他页面需要认证
  if (!store.isAuthenticated) {
    // 仅在客户端重定向，避免 SSR 阶段先渲染登录页再跳回的闪烁
    if (import.meta.client) {
      return navigateTo('/login')
    }
    // SSR 阶段先放行，客户端 hydrate 后 store 恢复，若仍未认证则重定向
    return
  }
})
