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

    // 在线编辑参赛队伍 / 评委（赛程页）
    // UpdateTournamentRequest 已含 teams/judges 数组，走后端标准赛事更新端点
    updateTournamentTeams:  (id: string, teams: string[])  => api.tournaments.update(id, { teams }),
    updateTournamentJudges: (id: string, judges: string[]) => api.tournaments.update(id, { judges }),

    // 单场比赛的编辑 / 删除 / 恢复 / 录比分（赛程页）— 与 useMatchDetail 同构，走 /api/matches/*
    updateMatch:   (id: string, data: any) => api.matches.update(id, data),
    deleteMatch:   (id: string, currentVersion?: number) =>
      api.matches.delete(id, currentVersion ? { currentVersion } : undefined),
    restoreMatch:  (id: string, currentVersion: number) => api.matches.restore(id, currentVersion),
    submitResult:  (
      matchId: string, winner: string, scoreA: number, scoreB: number,
      bestDebaterA?: string | null, bestDebaterB?: string | null, judge?: string | null,
    ) => api.matches.submitResult(matchId, { winner, scoreA, scoreB, bestDebaterA, bestDebaterB, judge }),
  }
}
