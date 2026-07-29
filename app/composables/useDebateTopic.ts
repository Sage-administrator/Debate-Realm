/**
 * useDebateTopic — 辩题库相关接口
 * 使用类型安全 API 客户端
 */
export function useDebateTopic() {
  const api = useApi()

  return {
    listTopics: (tournamentId: string, params?: { search?: string; category?: string }) =>
      api.tournaments.topics.list(tournamentId, params),

    createTopic: (tournamentId: string, data: {
      affirmative: string; negative: string; category?: string; note?: string
    }) => api.tournaments.topics.create(tournamentId, data),

    updateTopic: (tournamentId: string, topicId: string, data: {
      affirmative?: string; negative?: string; category?: string; note?: string
    }) => api.tournaments.topics.update(tournamentId, topicId, data),

    deleteTopic: (tournamentId: string, topicId: string) =>
      api.tournaments.topics.delete(tournamentId, topicId),

    importTopics: (tournamentId: string, topics: Array<{
      affirmative: string; negative: string; category?: string; note?: string
    }>) => api.tournaments.topics.import(tournamentId, { topics }),
  }
}
