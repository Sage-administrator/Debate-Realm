/**
 * useTeam — 团队管理
 */
export function useTeam() {
  const api = useApi()

  return {
    // 团队 CRUD
    getTeams: () => api.teams.list(),
    getTeam: (id: string) => api.teams.get(id),
    createTeam: (data: Parameters<typeof api.teams.create>[0]) => api.teams.create(data),
    updateTeam: (id: string, data: Parameters<typeof api.teams.update>[1]) =>
      api.teams.update(id, data),
    deleteTeam: (id: string) => api.teams.delete(id),

    // 成员管理
    getMembers: (teamId: string) => api.teams.members.list(teamId),
    createMember: (teamId: string, data: { username: string; password: string }) =>
      api.teams.members.create(teamId, data),
    deleteMember: (teamId: string, userId: string) => api.teams.members.delete(teamId, userId),
    updateMember: (teamId: string, userId: string, data: any) =>
      api.teams.members.update(teamId, userId, data),
    resetMemberPassword: (teamId: string, userId: string, newPassword: string) =>
      api.teams.members.resetPassword(teamId, userId, { newPassword }),
    cleanupMembers: (teamId: string) => api.teams.members.cleanup(teamId),

    // Admin
    getIndividualUsers: () => api.admin.individualUsers(),
    getAdminTeams: () => api.admin.teams(),
    getUsers: (params?: { page: number; pageSize: number }) => api.admin.users(params),
    createUser: (data: any) => api.admin.createUser(data),
    deleteUser: (id: string) => api.admin.deleteUser(id),
    resetUserPassword: (id: string, newPassword: string) =>
      api.admin.resetUserPassword(id, newPassword),
  }
}
