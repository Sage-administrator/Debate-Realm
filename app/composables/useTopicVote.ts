export function useTopicVote() {
  const store = useAuthStore()

  // === 通用接口（鉴权可选） ===

  // 获取赛事下辩题投票列表（管理员查看；含统计摘要）
  async function getTopicVotes(tournamentId: string, params?: { status?: string; matchId?: string }) {
    const query: Record<string, string> = {}
    if (params?.status) query.status = params.status
    if (params?.matchId) query.matchId = params.matchId
    return await $fetch<any[]>(`/api/tournaments/${tournamentId}/topic-votes`, {
      params: query,
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  // 获取投票详情（管理员与投票者均可；公开投票任何人可查）
  async function getTopicVote(tournamentId: string, voteId: string) {
    const headers: Record<string, string> = {}
    if (store.token) headers.Authorization = `Bearer ${store.token}`
    return await $fetch<any>(`/api/tournaments/${tournamentId}/topic-votes/${voteId}`, { headers })
  }

  // 提交投票（登录/公开均可）
  async function castVote(tournamentId: string, voteId: string, data: {
    topicIndices: number[]
    voterName?: string
    voterType?: string // 未登录用户自报身份：judge / debater
  }) {
    const headers: Record<string, string> = {}
    if (store.token) headers.Authorization = `Bearer ${store.token}`
    return await $fetch<{ success: boolean; message: string; recordId: string; topicIndices: number[] }>(
      `/api/tournaments/${tournamentId}/topic-votes/${voteId}/cast`,
      { method: 'POST', body: data, headers },
    )
  }

  // 查询我的投票记录（未登录返回 null）
  async function getMyVoteRecord(tournamentId: string, voteId: string) {
    const headers: Record<string, string> = {}
    if (store.token) headers.Authorization = `Bearer ${store.token}`
    return await $fetch<{ record: any }>(`/api/tournaments/${tournamentId}/topic-votes/${voteId}/my-record`, { headers })
  }

  // === 管理员接口（需鉴权） ===

  // 获取投票详细统计（含投票者列表）
  async function getVoteStats(tournamentId: string, voteId: string) {
    return await $fetch<any>(`/api/tournaments/${tournamentId}/topic-votes/${voteId}/stats`, {
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  // 创建投票
  async function createTopicVote(tournamentId: string, data: {
    title: string
    description?: string
    topics: string[]
    matchId?: string | null
    allowedVoters?: string[]
    multipleChoice?: boolean
    deadline?: string | null
    showResults?: boolean
    status?: string
  }) {
    return await $fetch<any>(`/api/tournaments/${tournamentId}/topic-votes`, {
      method: 'POST', body: data,
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  // 更新投票
  async function updateTopicVote(tournamentId: string, voteId: string, data: {
    title?: string
    description?: string | null
    topics?: string[]
    matchId?: string | null
    allowedVoters?: string[] | null
    multipleChoice?: boolean
    deadline?: string | null
    showResults?: boolean
    status?: string
  }) {
    return await $fetch(`/api/tournaments/${tournamentId}/topic-votes/${voteId}`, {
      method: 'PUT', body: data,
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  // 删除投票
  async function deleteTopicVote(tournamentId: string, voteId: string) {
    return await $fetch(`/api/tournaments/${tournamentId}/topic-votes/${voteId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  return {
    getTopicVotes, getTopicVote, castVote, getMyVoteRecord,
    getVoteStats, createTopicVote, updateTopicVote, deleteTopicVote,
  }
}
