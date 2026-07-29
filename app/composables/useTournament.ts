/**
 * useTournament — 赛事管理（CRUD + 赛程生成 + 抽签）
 */
export function useTournament() {
  const api = useApi()

  return {
    // CRUD
    getTournaments: (teamId: string) => api.teams.tournaments.list(teamId),
    getTournament:  (id: string) => api.tournaments.get(id),
    createTournament: (teamId: string, data: {
      name: string; description?: string; format?: string
      scheduledAt?: string; venue?: string; teams?: string[]; judges?: string[]
    }) => api.teams.tournaments.create(teamId, data),
    updateTournament: (id: string, data: any) => api.tournaments.update(id, data),
    deleteTournament: (id: string) => api.tournaments.delete(id),

    // 比赛列表（赛事子路由）
    getMatches:  (tournamentId: string) => api.tournaments.matches.list(tournamentId),
    createMatch: (tournamentId: string, data: {
      round: string; orderNum: number; teamA?: string; teamB?: string; scheduledAt?: string
    }) => api.tournaments.matches.create(tournamentId, data),

    // 赛程生成 + 抽签
    generateMatches: (tournamentId: string, data: any) =>
      api.tournaments.matches.generate(tournamentId, data),
    drawLots: (tournamentId: string, data: any) =>
      api.tournaments.matches.drawLots(tournamentId, data),
  }
}
