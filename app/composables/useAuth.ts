/**
 * useAuth — 认证
 */
export interface ExistingSessionInfo {
  deviceInfo: string
  ipAddress: string | null
  loggedInAt: string
  isActive?: boolean
  lastSeenAt?: string
}

export function useAuth() {
  const api = useApi()
  const store = useAuthStore()

  function logout() {
    store.clearAuth()
    if (import.meta.client) navigateTo('/login')
  }

  return {
    login:            (body: { username: string; password: string }) => api.auth.login(body),
    confirmLogin:     (body: { username: string; password: string }) => api.auth.confirmLogin(body),
    loginStatus:      () => api.auth.loginStatus(),
    fetchUser:        () => api.auth.me(),
    changePassword:   (oldPassword: string, newPassword: string) =>
      api.auth.changePassword({ oldPassword, newPassword }),
    updateProfile:    (body: { username?: string; nickname?: string; email?: string; avatar?: string }) =>
      api.auth.updateProfile(body),
    terminateOthers:  () => api.auth.terminateOthers(),
    logout,
  }
}
