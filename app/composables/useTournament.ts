export function useTournament() {
  const store = useAuthStore()

  async function getTournaments(teamId: string) {
    return await $fetch<{
      id: string; name: string; description: string | null
      format: string; status: string; scheduledAt: string | null; venue: string | null
      teams: string[]; judges: string[]; matchCount: number; createdAt: string
    }[]>(`/api/teams/${teamId}/tournaments`, {
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  async function getTournament(id: string) {
    return await $fetch<{
      id: string; name: string; description: string | null
      format: string; status: string; scheduledAt: string | null; venue: string | null
      team: { id: string; name: string }
      teams: string[]; judges: string[]
      // 赛程页面所需的扩展配置字段
      bestDebaterMode?: 'both' | 'winner_only' | null
      groupCount?: number | null
      topicPool?: string | null // 以 JSON 字符串存储的辩题池
      assignments?: any // 正反方分配
      matches: {
        id: string; round: string; orderNum: number
        teamA: string | null; teamB: string | null
        winner: string | null
        scoreA: number; scoreB: number
        status: string; scheduledAt: string | null
        // 赛果相关扩展字段
        topic?: string | null
        affirmativeSide?: string | null
        bestDebaterA?: string | null
        bestDebaterB?: string | null
        judge?: string | null
      }[]
      createdAt: string
    }>(`/api/tournaments/${id}`, {
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  async function createTournament(teamId: string, data: {
    name: string; description?: string; format?: string  // 可选：赛程页选择
    scheduledAt?: string; venue?: string; teams?: string[]; judges?: string[]
  }) {
    return await $fetch(`/api/teams/${teamId}/tournaments`, {
      method: 'POST', body: data,
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  async function updateTournament(id: string, data: { name?: string; description?: string; format?: string; status?: string; scheduledAt?: string; venue?: string; teams?: string[]; judges?: string[] }) {
    return await $fetch(`/api/tournaments/${id}`, {
      method: 'PUT', body: data,
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  // 单独更新赛事的队伍列表（在线编辑使用）
  async function updateTournamentTeams(id: string, teams: string[]) {
    return await $fetch(`/api/tournaments/${id}`, {
      method: 'PUT', body: { teams },
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  // 单独更新赛事的评委列表（在线编辑使用）
  async function updateTournamentJudges(id: string, judges: string[]) {
    return await $fetch(`/api/tournaments/${id}`, {
      method: 'PUT', body: { judges },
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  async function deleteTournament(id: string) {
    await $fetch(`/api/tournaments/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  async function getMatches(tournamentId: string) {
    return await $fetch<any[]>(`/api/tournaments/${tournamentId}/matches`, {
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  async function createMatch(tournamentId: string, data: { round: string; orderNum: number; teamA?: string; teamB?: string; scheduledAt?: string }) {
    return await $fetch(`/api/tournaments/${tournamentId}/matches`, {
      method: 'POST', body: data,
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  async function getMatch(id: string) {
    return await $fetch<any>(`/api/matches/${id}`, {
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  async function updateMatch(id: string, data: any) {
    return await $fetch(`/api/matches/${id}`, {
      method: 'PUT', body: data,
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  async function deleteMatch(id: string, currentVersion?: number) {
    await $fetch(`/api/matches/${id}`, {
      method: 'DELETE',
      body: currentVersion ? { currentVersion } : undefined,
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  // ⭐ 恢复已软删除的比赛
  async function restoreMatch(matchId: string, currentVersion: number) {
    return await $fetch(`/api/matches/${matchId}/restore`, {
      method: 'POST',
      body: { currentVersion },
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  // 扩展版：支持最佳辩手录入 + 评委姓名
  async function submitResult(
    matchId: string,
    winner: string,
    scoreA: number,
    scoreB: number,
    bestDebaterA?: string | null,
    bestDebaterB?: string | null,
    judge?: string | null
  ) {
    return await $fetch(`/api/matches/${matchId}/result`, {
      method: 'POST',
      body: { winner, scoreA, scoreB, bestDebaterA, bestDebaterB, judge },
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  // ⭐ 抽签 API（分组抽签 + 辩题抽签 + 正反方抽签）
  async function drawLots(tournamentId: string, data: {
    drawType: 'groups' | 'topics_sides' | 'all'
    groupCount?: number
    topicPool?: { pro: string, con: string }[]
    bestDebaterMode?: 'both' | 'winner_only'
  }) {
    return await $fetch<{
      success: boolean
      info: string
      groupCount: number
      topicCount: number
      result: any
    }>(`/api/tournaments/${tournamentId}/draw-lots`, {
      method: 'POST', body: data,
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  // ⭐ 自动生成赛程（支持全部 6 种赛制：单败/双败/循环赛/佩寄/瑞士/小组+淘汰赛）
  async function generateMatches(tournamentId: string, data: {
    format: 'single_elimination' | 'double_elimination' | 'round_robin' | 'page_playoff' | 'swiss' | 'group_knockout';
    teams: { name: string; seed: number }[];
    // 通用
    seedMethod?: 'random' | 'rating' | 'name';
    // 循环赛
    roundRobinMode?: 'single' | 'double';
    // 双败淘汰
    enableRevivalFinal?: boolean;
    // 瑞士制
    rounds?: number;
    pairingAlgo?: 'standard' | 'simplified';
    // 小组+淘汰赛
    groupSize?: number;
    promotePerGroup?: number;
    // 操作参数
    clearExisting?: boolean;
  }) {
    return await $fetch(`/api/tournaments/${tournamentId}/matches/generate`, {
      method: 'POST', body: data,
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  // 独立赛事
  async function getStandaloneMatches() {
    return await $fetch<{
      id: string; name: string; description: string | null
      status: string; scheduledAt: string | null; matchCount: number; createdAt: string
    }[]>('/api/standalone-matches', {
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  async function getStandaloneMatch(id: string) {
    return await $fetch<any>(`/api/standalone-matches/${id}`, {
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  async function createStandaloneMatch(data: { name: string; description?: string; scheduledAt?: string }) {
    return await $fetch('/api/standalone-matches', {
      method: 'POST', body: data,
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  async function updateStandaloneMatch(id: string, data: any) {
    return await $fetch(`/api/standalone-matches/${id}`, {
      method: 'PUT', body: data,
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  async function deleteStandaloneMatch(id: string) {
    await $fetch(`/api/standalone-matches/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  async function createStandaloneMatchMatch(id: string, data: { round: string; orderNum: number; teamA?: string; teamB?: string; scheduledAt?: string }) {
    return await $fetch(`/api/standalone-matches/${id}/matches`, {
      method: 'POST', body: data,
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  return {
    getTournaments, getTournament, createTournament, updateTournament, updateTournamentTeams, updateTournamentJudges, deleteTournament,
    getMatches, createMatch, getMatch, updateMatch, deleteMatch, restoreMatch, submitResult,
    generateMatches, drawLots,
    getStandaloneMatches, getStandaloneMatch, createStandaloneMatch, updateStandaloneMatch, deleteStandaloneMatch,
    createStandaloneMatchMatch,
  }
}
