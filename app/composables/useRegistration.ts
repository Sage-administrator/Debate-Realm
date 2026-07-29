/**
 * useRegistration — 赛事报名
 */
export function useRegistration() {
  const api = useApi()

  return {
    getRegistrationConfig:    (tournamentId: string) => api.tournaments.registration.config(tournamentId),
    submitRegistration:       (tournamentId: string, data: any) => api.tournaments.registration.submit(tournamentId, data),
    getMyRegistration:        (tournamentId: string) => api.tournaments.registration.my(tournamentId),
    getRegistrations:         (tournamentId: string, params?: { status?: string; type?: string }) =>
      api.tournaments.registration.list(tournamentId, params).then(res => (res as any).registrations || []),
    reviewRegistration:       (tournamentId: string, regId: string, action: 'approve' | 'reject', reviewNote?: string) =>
      api.tournaments.registration.review(tournamentId, regId, { action, reviewNote }),
    updateRegistrationSettings: (tournamentId: string, data: any) =>
      api.tournaments.registration.settings(tournamentId, data),
    updateRegistrationFields: (tournamentId: string, fields: any[]) =>
      api.tournaments.registration.fields(tournamentId, fields),
    autoMatch:                (tournamentId: string, teamSize?: number) =>
      api.tournaments.registration.autoMatch(tournamentId, { teamSize }),
    convertToTeams:           (tournamentId: string, items: { name: string; registrationIds: string[] }[]) =>
      api.tournaments.registration.convertToTeams(tournamentId, items),
    createDebaterAccounts:    (tournamentId: string, registrationIds?: string[]) =>
      api.tournaments.registration.createDebaterAccounts(tournamentId, registrationIds),
  }
}
