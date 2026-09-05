/**
 * Auth Cookie 管理 — 使用 Cookie 存储 token，让 SSR 阶段也能读取登录状态
 *
 * 为什么需要 Cookie？
 * - localStorage 只有客户端能读取，SSR 阶段服务端读不到
 * - Cookie 会随请求自动发送到服务端，SSR 阶段可以读取
 * - 双存储策略：同时存 Cookie 和 localStorage，兼顾 SSR 和客户端使用
 */

// Cookie 名称常量
const TOKEN_COOKIE = 'auth_token'
const USER_COOKIE = 'auth_user'

// Cookie 有效期（7天）
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7

/**
 * 用户信息结构（与登录接口返回的 user 对象保持一致）
 * ponytail: 与 stores/auth.ts 的 UserInfo 保持同步，字段完全一致
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

/**
 * 设置认证 Cookie（登录成功后调用）
 * 同时设置 token 和 user 两个 Cookie
 */
export function setAuthCookies(token: string, user: UserInfo) {
  const cookieOptions = {
    maxAge: COOKIE_MAX_AGE,
    path: '/',
    // 生产环境建议开启 secure（HTTPS-only）
    secure: process.env.NODE_ENV === 'production',
    // 防止 XSS 攻击，JS 无法读取（但我们这里需要 JS 读取用于 API 调用 header，所以设为 false）
    httpOnly: false,
    // 防止 CSRF 攻击
    sameSite: 'lax' as const,
  }

  const tokenCookie = useCookie(TOKEN_COOKIE, cookieOptions)
  const userCookie = useCookie(USER_COOKIE, cookieOptions)

  tokenCookie.value = token
  userCookie.value = JSON.stringify(user)
}

/**
 * 清除认证 Cookie（退出登录时调用）
 */
export function clearAuthCookies() {
  const tokenCookie = useCookie(TOKEN_COOKIE)
  const userCookie = useCookie(USER_COOKIE)

  tokenCookie.value = null
  userCookie.value = null
}

/**
 * 从 Cookie 读取认证信息（SSR 和客户端都可用）
 * 返回 null 表示未登录
 *
 * 注意：useCookie 会自动解析 JSON 值，所以 userCookie.value 可能已经是对象，
 * 也可能是字符串（取决于设置方式和环境），需要兼容两种情况
 */
export function getAuthFromCookies(): { token: string; user: UserInfo } | null {
  const tokenCookie = useCookie(TOKEN_COOKIE)
  const userCookie = useCookie(USER_COOKIE)

  const token = tokenCookie.value
  const userValue = userCookie.value

  if (!token || !userValue) {
    return null
  }

  try {
    // useCookie 会自动解析 JSON，所以 userValue 可能已经是对象
    // 如果是字符串，再手动解析；如果已经是对象，直接使用
    const user =
      typeof userValue === 'string' ? (JSON.parse(userValue) as UserInfo) : (userValue as UserInfo)
    return { token, user }
  } catch {
    // 解析失败，清除无效 Cookie
    clearAuthCookies()
    return null
  }
}
