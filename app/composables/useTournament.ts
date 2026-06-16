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
      matches: { id: string; round: string; orderNum: number; teamA: string | null; teamB: string | null; winner: string | null; scoreA: number; scoreB: number; status: string; scheduledAt: string | null }[]
      createdAt: string
    }>(`/api/tournaments/${id}`, {
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  async function createTournament(teamId: string, data: {
    name: string; description?: string; format: string
    scheduledAt?: string; venue?: string; teams?: string[]; judges?: string[]
  }) {
    return await $fetch(`/api/teams/${teamId}/tournaments`, {
      method: 'POST', body: data,
      headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  async function updateTournament(id: string, data: { name?: string; description?: string; format?: string; status?: string; scheduledAt?: string; venue?: string }) {
    return await $fetch(`/api/tournaments/${id}`, {
      method: 'PUT', body: data,
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

  async function deleteMatch(id: string) {
    await $fetch(`/api/matches/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${store.token}` },
    })
  }

  async function submitResult(matchId: string, winner: string, scoreA: number, scoreB: number) {
    return await $fetch(`/api/matches/${matchId}/result`, {
      method: 'POST', body: { winner, scoreA, scoreB },
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
    getTournaments, getTournament, createTournament, updateTournament, deleteTournament,
    getMatches, createMatch, getMatch, updateMatch, deleteMatch, submitResult,
    getStandaloneMatches, getStandaloneMatch, createStandaloneMatch, updateStandaloneMatch, deleteStandaloneMatch,
    createStandaloneMatchMatch,
  }
}
