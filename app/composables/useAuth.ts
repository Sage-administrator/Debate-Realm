export function useAuth() {
  const store = useAuthStore()
  const router = useRouter()

  async function login(username: string, password: string) {
    const response = await $fetch<{
      token: string
      user: {
        id: string
        username: string
        role: string
        mode: string
        team: { id: string; name: string; mode: string } | null
      }
    }>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    })

    store.setAuth(response.token, response.user)
    return response.user
  }

  function logout() {
    store.clearAuth()
    router.push('/login')
  }

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
      // 更新 user 信息但保留 token
      store.setAuth(store.token!, data)
    } catch {
      store.clearAuth()
      router.push('/login')
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
    logout,
    fetchUser,
    changePassword,
  }
}
