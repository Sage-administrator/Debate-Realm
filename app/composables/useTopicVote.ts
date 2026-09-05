/**
 * useTopicVote — 辩题投票相关接口
 * 使用类型安全 API 客户端
 */
export function useTopicVote() {
  const api = useApi()

  return {
    getTopicVotes: (tournamentId: string, params?: { status?: string; matchId?: string }) =>
      api.tournaments.votes.list(tournamentId, params),

    getTopicVote: (tournamentId: string, voteId: string) =>
      api.tournaments.votes.get(tournamentId, voteId),

    castVote: (
      tournamentId: string,
      voteId: string,
      data: {
        topicIndices: number[]
        voterName?: string
        voterType?: string
      },
    ) => api.tournaments.votes.cast(tournamentId, voteId, data),

    getMyVoteRecord: (tournamentId: string, voteId: string) =>
      api.tournaments.votes.myRecord(tournamentId, voteId),

    getVoteStats: (tournamentId: string, voteId: string) =>
      api.tournaments.votes.stats(tournamentId, voteId),

    createTopicVote: (tournamentId: string, data: any) =>
      api.tournaments.votes.create(tournamentId, data),

    updateTopicVote: (tournamentId: string, voteId: string, data: any) =>
      api.tournaments.votes.update(tournamentId, voteId, data),

    deleteTopicVote: (tournamentId: string, voteId: string) =>
      api.tournaments.votes.delete(tournamentId, voteId),
  }
}
