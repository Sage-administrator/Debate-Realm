/**
 * useStandaloneMatches — 独立赛事
 */
export function useStandaloneMatches() {
  const api = useApi()

  return {
    list:       () => api.standalone.list(),
    get:        (id: string) => api.standalone.get(id),
    create:     (data: any) => api.standalone.create(data),
    update:     (id: string, data: any) => api.standalone.update(id, data),
    delete:     (id: string) => api.standalone.delete(id),
    createMatch: (id: string, data: any) => api.standalone.createMatch(id, data),
  }
}
