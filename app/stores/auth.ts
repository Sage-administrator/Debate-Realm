/**
 * auth store —— 全局认证状态管理（Pinia）
 * 维护登录 token 与用户信息，采用 Cookie + localStorage 双存储策略，
 * 兼顾 SSR 读取与客户端兜底。
 */
import { defineStore } from 'pinia'

/** 当前登录用户信息（与登录接口返回的 user 对象保持一致） */
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

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const user = ref<UserInfo | null>(null)
  const isAuthenticated = computed(() => !!token.value && !!user.value)

  // 从存储恢复状态（Cookie 优先，localStorage 兜底）
  // - Cookie：SSR 和客户端都能读取，解决刷新后需要重新登录的问题
  // - localStorage：兜底方案，兼容旧逻辑
  function loadFromStorage() {
    // 优先从 Cookie 读取（SSR 和客户端都可用）
    try {
      const authData = getAuthFromCookies()
      if (authData) {
        token.value = authData.token
        user.value = authData.user
        return
      }
    } catch (_e) {
      // Cookie 读取失败，继续尝试 localStorage
    }

    // 兜底：从 localStorage 读取（仅客户端）
    if (import.meta.client) {
      const savedToken = localStorage.getItem('auth_token')
      const savedUser = localStorage.getItem('auth_user')
      if (savedToken && savedUser) {
        token.value = savedToken
        try {
          const parsedUser = JSON.parse(savedUser)
          user.value = parsedUser
          // 同步到 Cookie，确保下次刷新 SSR 能读到
          setAuthCookies(savedToken, parsedUser)
        } catch {
          clearAuth()
        }
      }
    }
  }

  function setAuth(newToken: string, newUser: UserInfo) {
    token.value = newToken
    user.value = newUser
    // 双存储：同时写入 Cookie 和 localStorage
    setAuthCookies(newToken, newUser)
    if (import.meta.client) {
      localStorage.setItem('auth_token', newToken)
      localStorage.setItem('auth_user', JSON.stringify(newUser))
    }
  }

  function clearAuth() {
    token.value = null
    user.value = null
    // 双清除：同时清除 Cookie 和 localStorage
    clearAuthCookies()
    if (import.meta.client) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
    }
  }

  return {
    token,
    user,
    isAuthenticated,
    loadFromStorage,
    setAuth,
    clearAuth,
  }
})
