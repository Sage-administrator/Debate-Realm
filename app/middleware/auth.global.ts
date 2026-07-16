/**
 * auth.global.ts —— 全局路由守卫中间件
 * 在每次路由跳转前执行，负责：
 * 1. 从 Cookie / localStorage 恢复认证状态（解决刷新后 SSR 误跳转登录页的问题）
 * 2. 处理登录页、公开页面（报名/投票/首页）的免鉴权放行
 * 3. 未认证用户访问受保护页面时跳转登录页，并识别"被踢下线"场景
 *
 * 性能优化：
 * - 使用模块级缓存标记，避免在客户端每次路由跳转都同步访问 localStorage（阻塞主线程）
 * - localStorage 仅在首次进入或被踢下线后读取一次
 * - 后续路由跳转直接使用 Pinia store 中已恢复的认证状态
 */

// Cookie 名称（与服务端和 useAuthCookie.ts 保持一致）
const TOKEN_COOKIE = 'auth_token'
const USER_COOKIE = 'auth_user'

/** 当前登录用户信息（与登录接口返回的 user 对象保持一致）
 *  ponytail: 与 stores/auth.ts 的 UserInfo 保持同步，字段完全一致
 */
interface UserInfo {
  id: string
  username: string
  nickname: string | null
  email: string | null
  avatar: string | null
  role: string
  mode: string
  team: { id: string; name: string; mode: string } | null
}

// 客户端缓存：标记 localStorage 是否已检查过（避免每次路由跳转都同步读 localStorage）
let clientStorageChecked = false

export default defineNuxtRouteMiddleware((to) => {
  const store = useAuthStore()

  // 关键：先从 Cookie 恢复认证状态（直接在中间件中使用 useCookie，确保上下文正确）
  // - SSR 阶段：服务端从请求头 Cookie 读取
  // - 客户端：从 document.cookie 读取
  // 这样刷新页面时，SSR 就能知道用户是否已登录，不会误跳转登录页
  if (!store.isAuthenticated) {
    const tokenCookie = useCookie<string | null>(TOKEN_COOKIE)
    const userCookie = useCookie<string | null>(USER_COOKIE)

    if (tokenCookie.value && userCookie.value) {
      try {
        // useCookie 会自动解析 JSON，所以 userCookie.value 可能已经是对象
        // 如果是字符串，再手动解析；如果已经是对象，直接使用
        const user = typeof userCookie.value === 'string'
          ? JSON.parse(userCookie.value) as UserInfo
          : userCookie.value as UserInfo
        store.token = tokenCookie.value
        store.user = user
      } catch {
        // Cookie 解析失败，清除无效 Cookie
        tokenCookie.value = null
        userCookie.value = null
      }
    }
  }

  // 如果上面的 Cookie 读取没成功，再尝试 store 的 loadFromStorage（兜底 localStorage）
  // 性能优化：用 clientStorageChecked 缓存标记，仅首次或被踢下线后访问 localStorage
  if (!store.isAuthenticated && import.meta.client && !clientStorageChecked) {
    store.loadFromStorage()
    clientStorageChecked = true
  }

  // 登录页处理
  if (to.path === '/login') {
    // 如果是被踢下线跳转过来的，始终允许访问登录页（即使 localStorage 中有残留的旧认证数据）
    if (to.query.reason === 'kicked') {
      // 清除残留的旧认证数据，确保登录页不会误判为已登录
      store.clearAuth()
      // 重置缓存标记，下次需要重新检查 localStorage
      clientStorageChecked = false
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

  // 首页：允许免登录访问（未登录显示简介页，已登录显示仪表盘）
  if (to.path === '/') {
    return
  }

  // 其他页面需要认证
  if (!store.isAuthenticated) {
    if (import.meta.client) {
      // 性能优化：仅在缓存标记未设置时读取 localStorage
      // 后续路由跳转若 store 仍未认证，说明确实没登录，无需重复读 localStorage
      if (!clientStorageChecked) {
        const savedToken = localStorage.getItem('auth_token')
        clientStorageChecked = true
        if (savedToken) {
          return navigateTo('/login?reason=kicked')
        }
      }
    }
    // 跳转登录页
    return navigateTo('/login')
  }
})
