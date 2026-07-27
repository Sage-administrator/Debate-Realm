/**
 * useDebateTopic — 辩题库相关接口集合
 * 辩题库为赛事级（挂在 Tournament 下），供辩题投票问卷拉取候选辩题。
 * 每个辩题包含正方立场(affirmative)与反方立场(negative)。
 */
export function useDebateTopic() {
  const store = useAuthStore()

  function authHeaders(): Record<string, string> {
    // 统一返回 Record<string, string>，避免 TS 联合类型错误
    return store.token ? { Authorization: `Bearer ${store.token}` } : {}
  }

  // 获取辩题库列表（支持 search / category 过滤）
  async function listTopics(tournamentId: string, params?: { search?: string; category?: string }) {
    const query: Record<string, string> = {}
    if (params?.search) query.search = params.search
    if (params?.category) query.category = params.category
    return await $fetch<{ topics: any[] }>(`/api/tournaments/${tournamentId}/debate-topics`, {
      params: query,
      headers: authHeaders(),
    })
  }

  // 新增辩题库条目
  async function createTopic(tournamentId: string, data: {
    affirmative: string
    negative: string
    category?: string
    note?: string
  }) {
    return await $fetch<{ topic: any }>(`/api/tournaments/${tournamentId}/debate-topics`, {
      method: 'POST',
      body: data,
      headers: authHeaders(),
    })
  }

  // 更新辩题库条目
  async function updateTopic(tournamentId: string, topicId: string, data: {
    affirmative?: string
    negative?: string
    category?: string
    note?: string
  }) {
    return await $fetch<{ topic: any }>(`/api/tournaments/${tournamentId}/debate-topics/${topicId}`, {
      method: 'PUT',
      body: data,
      headers: authHeaders(),
    })
  }

  // 删除辩题库条目
  async function deleteTopic(tournamentId: string, topicId: string) {
    return await $fetch(`/api/tournaments/${tournamentId}/debate-topics/${topicId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
  }

  // 批量导入辩题库条目（CSV 导入）：topics 为 [{affirmative, negative, category?, note?}]
  async function importTopics(tournamentId: string, topics: Array<{
    affirmative: string
    negative: string
    category?: string
    note?: string
  }>) {
    return await $fetch<{ created: number; skipped: number; total: number }>(
      `/api/tournaments/${tournamentId}/debate-topics/import`,
      {
        method: 'POST',
        body: { topics },
        headers: authHeaders(),
      },
    )
  }

  return {
    listTopics,
    createTopic,
    updateTopic,
    deleteTopic,
    importTopics,
  }
}
