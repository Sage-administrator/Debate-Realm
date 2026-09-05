/**
 * useMatchDetail — 比赛详情操作（查看、编辑、删除、赛果、恢复）
 */
export function useMatchDetail() {
  const api = useApi()

  return {
    get: (id: string) => api.matches.get(id),
    update: (id: string, data: any) => api.matches.update(id, data),
    delete: (id: string, currentVersion?: number) =>
      api.matches.delete(id, currentVersion ? { currentVersion } : undefined),
    restore: (id: string, currentVersion: number) => api.matches.restore(id, currentVersion),
    submitResult: (
      matchId: string,
      winner: string,
      scoreA: number,
      scoreB: number,
      bestDebaterA?: string | null,
      bestDebaterB?: string | null,
      judge?: string | null,
    ) =>
      api.matches.submitResult(matchId, {
        winner,
        scoreA,
        scoreB,
        bestDebaterA,
        bestDebaterB,
        judge,
      }),
  }
}
