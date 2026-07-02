export function useRegistration() {
  const store = useAuthStore()

  // === 公开接口（无需鉴权，但鉴权可选） ===

  // 获取报名配置（公开）
  async function getRegistrationConfig(tournamentId: string) {
    return await $fetch<{
      id: string; name: string; description: string | null; format: string
      venue: string | null; scheduledAt: string | null
      registrationOpen: boolean; registrationDeadline: string | null
      isPublic: boolean; teamSize: number | null; registrationInfo: string | null
      fields: {
        id: string; fieldName: string; fieldKey: string; fieldType: string
        fieldOptions: string | null; required: boolean; sortOrder: number; appliesTo: string
      }[]
    }>(`/api/tournaments/${tournamentId}/registration-config`)
  }

  // 提交报名（公开/鉴权均可）
  async function submitRegistration(tournamentId: string, data: {
    type: 'individual' | 'team'
    teamName?: string
    submitterName: string
    contactPhone: string
    contactEmail?: string
    notes?: string
    customData?: Record<string, string>
    members: { name: string; preferredPosition?: string; experience?: string }[]
  }) {
    const headers: Record<string, string> = {}
    if (store.token) headers.Authorization = `Bearer ${store.token}`
    return await $fetch<{ code: number; message: string; data: { id: string } }>(
      `/api/tournaments/${tournamentId}/register`,
      { method: 'POST', body: data, headers }
    )
  }

  // 查询我的报名记录（需鉴权）
  async function getMyRegistration(tournamentId: string) {
    return await $fetch<any[]>(`/api/tournaments/${tournamentId}/my-registration`, {
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  // === 管理员接口（需鉴权） ===

  // 获取全部报名列表（管理员）
  // API 返回分页结构 { registrations: [...], pagination: {...} }，这里直接返回 registrations 数组
  async function getRegistrations(tournamentId: string, params?: { status?: string; type?: string }) {
    const query: Record<string, string> = {}
    if (params?.status) query.status = params.status
    if (params?.type) query.type = params.type
    const result = await $fetch<{ registrations: any[]; pagination: any }>(`/api/tournaments/${tournamentId}/registrations`, {
      params: query,
      headers: { Authorization: `Bearer ${store.token}` },
    })
    return result.registrations
  }

  // 审核报名（管理员）
  async function reviewRegistration(tournamentId: string, regId: string, action: 'approve' | 'reject', reviewNote?: string) {
    return await $fetch(`/api/tournaments/${tournamentId}/registrations/${regId}`, {
      method: 'PUT', body: { action, reviewNote },
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  // 更新报名设置（管理员）
  async function updateRegistrationSettings(tournamentId: string, data: {
    registrationOpen?: boolean
    registrationDeadline?: string | null
    isPublic?: boolean
    teamSize?: number | null
    registrationInfo?: string | null
  }) {
    return await $fetch(`/api/tournaments/${tournamentId}/registration-settings`, {
      method: 'PUT', body: data,
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  // 更新自定义字段（管理员）
  async function updateRegistrationFields(tournamentId: string, fields: any[]) {
    return await $fetch(`/api/tournaments/${tournamentId}/registration-fields`, {
      method: 'PUT', body: { fields },
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  // 个人报名者自动匹配成队（管理员）
  async function autoMatch(tournamentId: string, teamSize?: number) {
    return await $fetch<{
      teams: { suggestedName: string; members: any[] }[]
      unmatched: any[]
    }>(`/api/tournaments/${tournamentId}/registrations/auto-match`, {
      method: 'POST', body: { teamSize },
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  // 转换为正式队伍（管理员）
  async function convertToTeams(tournamentId: string, items: { name: string; registrationIds: string[] }[]) {
    return await $fetch(`/api/tournaments/${tournamentId}/registrations/convert-teams`, {
      method: 'POST', body: { items },
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  // 创建辩手账号（管理员）
  async function createDebaterAccounts(tournamentId: string, registrationIds?: string[]) {
    return await $fetch<{
      success: boolean; created: number
      accounts: { username: string; password: string; name: string; registrationId: string }[]
    }>(`/api/tournaments/${tournamentId}/registrations/create-accounts`, {
      method: 'POST', body: { registrationIds },
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  return {
    getRegistrationConfig, submitRegistration, getMyRegistration,
    getRegistrations, reviewRegistration, updateRegistrationSettings,
    updateRegistrationFields, autoMatch, convertToTeams, createDebaterAccounts,
  }
}
