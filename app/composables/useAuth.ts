// ════════════════════════════════════════════════════
// useAuth — 登录/登出（严格限制多端登录）
// - 首次登录检测活跃会话 → 返回 needConfirm
// - 用户点击"继续登录" → confirmLogin 递增 tokenVersion 踢掉原设备
// - 原设备下次 API 调用 → token 版本不匹配 → 401 被踢下线
// ════════════════════════════════════════════════════

/**
 * 原设备已登录的会话信息（用于弹窗展示）
 */
export interface ExistingSessionInfo {
  id: string
  deviceInfo: string
  ipAddress: string | null
  loggedInAt: string
  lastSeenAt?: string
}

/**
 * 新设备信息（当前尝试登录的设备）
 */
export interface NewDeviceInfo {
  deviceInfo: string
  ipAddress: string
}

/**
 * 登录返回的通用结构（无 needConfirm 时为正常登录成功）
 */
export interface LoginResponse {
  needConfirm: boolean
  token?: string
  sessionId?: string
  userId?: string
  existingSessions?: ExistingSessionInfo[]
  newDevice?: NewDeviceInfo
  tokenVersion?: number
  user: {
    id: string
    username: string
    role: string
    mode: string
    team: { id: string; name: string; mode: string } | null
  }
}

export function useAuth() {
  const store = useAuthStore()
  const router = useRouter()

  /**
   * 尝试登录 —— 返回值中 needConfirm=true 表示检测到其他设备已登录
   */
  async function login(username: string, password: string): Promise<LoginResponse> {
    const response = await $fetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    })

    // ── 无活跃会话：直接登录成功 ──
    if (!response.needConfirm && response.token) {
      store.setAuth(response.token, response.user)
      router.push('/')
    }

    // ── 有活跃会话：返回 needConfirm 让前端弹窗询问 ──
    return response
  }

  /**
   * 确认继续登录 —— 递增 tokenVersion 踢掉原设备，创建新会话
   * 调用成功后直接保存新 token 并跳转首页
   */
  async function confirmLogin(username: string, password: string): Promise<LoginResponse> {
    const response = await $fetch<LoginResponse>('/api/auth/confirm-login', {
      method: 'POST',
      body: { username, password },
    })

    if (response.token) {
      store.setAuth(response.token, response.user)
      router.push('/')
    }
    return response
  }

  /**
   * 登出 —— 清理本地认证状态，跳转到登录页
   */
  function logout() {
    store.clearAuth()
    router.push('/login')
  }

  /**
   * 拉取当前用户信息（刷新用）；若检测到 token 已失效则跳转到登录页并显示被踢下线警告
   */
  async function fetchUser() {
    try {
      const data = await $fetch<{
        id: string
        username: string
        role: string
        mode: string
        team: { id: string; name: string; mode: string } | null
      }>('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${store.token}`,
        },
      })
      store.setAuth(store.token!, data)
    } catch (e: any) {
      const msg = e?.data?.statusMessage || ''
      const isKicked = msg.includes('已在其他设备登录')
      store.clearAuth()
      if (isKicked) {
        router.push('/login?reason=kicked')
      } else {
        router.push('/login')
      }
    }
  }

  async function changePassword(oldPassword: string, newPassword: string) {
    await $fetch('/api/auth/password', {
      method: 'PUT',
      body: { oldPassword, newPassword },
      headers: {
        Authorization: `Bearer ${store.token}`,
      },
    })
  }

  return {
    login,
    confirmLogin,
    logout,
    fetchUser,
    changePassword,
  }
}
