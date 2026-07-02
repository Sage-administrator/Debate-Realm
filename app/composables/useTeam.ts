export function useTeam() {
  const store = useAuthStore()

  async function getTeams() {
    return await $fetch<{
      id: string; name: string; mode: string; memberCount: number
      tournamentCount: number; createdAt: string
    }[]>('/api/admin/teams', {
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  async function getUsers() {
    const res = await $fetch<{
      users: {
        id: string; username: string; role: string; mode: string
        team: { id: string; name: string } | null; createdAt: string
      }[]
      pagination: { page: number; pageSize: number; total: number; totalPages: number }
    }>('/api/admin/users', {
      headers: { Authorization: `Bearer ${store.token}` },
    })
    // 修复：API 返回分页对象，需要提取 users 数组
    return res.users
  }

  // 获取所有个人用户及其独立赛事（系统管理员专用）
  async function getIndividualUsers() {
    return await $fetch<{
      id: string; username: string; createdAt: string
      standaloneMatchCount: number
      standaloneMatches: {
        id: string; name: string; description: string
        status: string; scheduledAt: string; matchCount: number; createdAt: string
      }[]
    }[]>('/api/admin/individual-users', {
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  async function getTeam(id: string) {
    return await $fetch<{
      id: string; name: string; mode: string
      botConfig: { botAppId: string | null; botChannelId: string | null }
      members: { id: string; userId: string; username: string; role: string }[]
      tournaments: { id: string; name: string; status: string }[]
      createdAt: string
    }>(`/api/teams/${id}`, {
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  async function createTeam(data: {
    name: string; mode: string; adminUsername: string; adminPassword: string
    botAppId?: string; botAppSecret?: string; botChannelId?: string
  }) {
    return await $fetch('/api/teams', {
      method: 'POST',
      body: data,
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  async function updateTeam(id: string, data: {
    name?: string; botAppId?: string | null
    botAppSecret?: string | null; botChannelId?: string | null
  }) {
    return await $fetch(`/api/teams/${id}`, {
      method: 'PUT',
      body: data,
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  async function deleteTeam(id: string) {
    await $fetch(`/api/teams/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  async function getTeamMembers(teamId: string) {
    return await $fetch<{
      id: string; userId: string; username: string; role: string
      assignedMatches: { matchId: string; matchRound: string }[]
      createdAt: string
    }[]>(`/api/teams/${teamId}/members`, {
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  async function addTeamMember(teamId: string, username: string, password: string) {
    return await $fetch(`/api/teams/${teamId}/members`, {
      method: 'POST',
      body: { username, password },
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  async function deleteTeamMember(teamId: string, userId: string) {
    await $fetch(`/api/teams/${teamId}/members/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  // 清理团队所有子账号
  async function cleanupTeamMembers(teamId: string) {
    return await $fetch<{ deleted: number; message: string }>(`/api/teams/${teamId}/members/cleanup`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  async function createUser(data: {
    username: string; password: string; role: string; mode: string; teamId?: string
  }) {
    return await $fetch('/api/admin/users', {
      method: 'POST',
      body: data,
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  async function deleteUser(id: string) {
    await $fetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  async function resetUserPassword(id: string, newPassword: string) {
    await $fetch(`/api/admin/users/${id}/reset`, {
      method: 'PUT',
      body: { newPassword },
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  return {
    getTeams,
    getUsers,
    getIndividualUsers,
    getTeam,
    createTeam,
    updateTeam,
    deleteTeam,
    getTeamMembers,
    addTeamMember,
    deleteTeamMember,
    cleanupTeamMembers,
    createUser,
    deleteUser,
    resetUserPassword,
  }
}
