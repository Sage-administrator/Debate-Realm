/**
 * 类型安全 API 客户端
 *
 * 替代各 composable 中分散的 $fetch 调用，提供：
 * 1. 自动注入 Auth header
 * 2. 类型安全的请求/响应
 * 3. 统一的 URL 构建
 *
 * 使用方式：
 *   const api = useApi()
 *   const data = await api.tournaments.list(teamId)
 */
import type {
  UserInfo, LoginRequest, LoginResponse, ConfirmLoginRequest,
  ChangePasswordRequest, UpdateProfileRequest, LoginSession,
} from '#shared/schemas/auth'
import type {
  TeamInfo, CreateTeamRequest, UpdateTeamRequest,
  TeamMember, CreateMemberRequest, UpdateMemberRequest, ResetMemberPasswordRequest,
} from '#shared/schemas/team'
import type {
  TournamentInfo, TournamentListItem, CreateTournamentRequest, UpdateTournamentRequest,
  PublicTournamentInfo, PublicTournamentListQuery, RegistrationSettings,
  DrawLotsRequest, GenerateMatchesRequest,
} from '#shared/schemas/tournament'
import type {
  MatchInfo, CreateMatchRequest, UpdateMatchRequest,
  DeleteMatchRequest, SubmitResultRequest, SubmitScoreRequest,
} from '#shared/schemas/match'
import type {
  RegistrationConfig, RegistrationRecord,
  SubmitRegistrationRequest, ReviewRegistrationRequest, AutoMatchRequest,
} from '#shared/schemas/registration'
import type {
  TimerConfig, TimerProjectInfo, TimerTemplate,
  CreateTimerProjectRequest, UpdateTimerProjectRequest,
} from '#shared/schemas/timer'
import type {
  BotStatus, BotConfigRequest, ChannelInfo, ArenaInfo,
  CreateArenaRequest, GrantSpeakRequest, RevokeSpeakRequest, BotScheduleRequest,
} from '#shared/schemas/bot'
import type { DebateTopicListResult, DebateTopicImportResult } from '#shared/schemas/debate-topics'
import type { TopicVoteListResult, TopicVoteDetail, MyVoteRecordResult, VoteStatsResult } from '#shared/schemas/topic-votes'

// ── 内部请求工具 ──

type FetchOptions = Omit<RequestInit, 'body'> & {
  params?: Record<string, string | number | undefined | null>
  body?: unknown
}

function buildHeaders(token: string | null, extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = extra ? { ...extra } : {}
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

// Nuxt 4 的 `$fetch<T>` 在能被静态匹配到的 Nitro 内部路由上，会把返回推断成
// `TypedInternalResponse<...>` 而非 `T`（泛型 T 被当成请求体类型），导致 `Promise<T>`
// 与返回不兼容。保留 `$fetch<T>`（去掉泛型会触发对字面量 URL 的路由匹配递归，报
// TS2321 excessive stack depth），仅在唯一汇聚点对最终结果做一次窄化展开，
// 避免把 `as any` 散落到 25+ 个调用方。运行时会按 JSON 解析返回 `T`，行为不变。
async function get<T>(url: string, token: string | null, params?: Record<string, unknown>): Promise<T> {
  const query = params
    ? '?' + new URLSearchParams(
        Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
      ).toString()
    : ''
  return (await $fetch<T>(url + query, { headers: buildHeaders(token) })) as T
}

async function post<T>(url: string, token: string | null, body?: unknown): Promise<T> {
  return (await $fetch<T>(url, { method: 'POST', body: body as BodyInit | undefined, headers: buildHeaders(token) })) as T
}

async function put<T>(url: string, token: string | null, body?: unknown): Promise<T> {
  return (await $fetch<T>(url, { method: 'PUT', body: body as BodyInit | undefined, headers: buildHeaders(token) })) as T
}

async function del<T>(url: string, token: string | null, body?: unknown): Promise<T> {
  return (await $fetch<T>(url, { method: 'DELETE', body: body as BodyInit | undefined, headers: buildHeaders(token) })) as T
}

// ── API 客户端 ──

export function useApi() {
  const auth = useAuthStore()
  const t = () => auth.token

  // ============================================================
  // Auth
  // ============================================================
  const auth_api = {
    login:            (body: LoginRequest)            => post<LoginResponse>('/api/auth/login', null, body),
    confirmLogin:     (body: ConfirmLoginRequest)       => post<LoginResponse>('/api/auth/confirm-login', null, body),
    loginStatus:      ()                               => get<LoginSession[]>('/api/auth/login-status', t()),
    me:               ()                               => get<UserInfo>('/api/auth/me', t()),
    changePassword:   (body: ChangePasswordRequest)     => put('/api/auth/password', t(), body),
    updateProfile:    (body: UpdateProfileRequest)       => put('/api/auth/profile', t(), body),
    terminateOthers:  ()                               => post('/api/auth/terminate-others', t()),
  }

  // ============================================================
  // Teams
  // ============================================================
  const teams = {
    list:           () => get<TeamInfo[]>('/api/teams', t()),
    create:         (body: CreateTeamRequest)   => post<TeamInfo>('/api/teams', t(), body),
    get:            (id: string)                => get<TeamInfo>(`/api/teams/${id}`, t()),
    update:         (id: string, body: UpdateTeamRequest) => put(`/api/teams/${id}`, t(), body),
    delete:         (id: string)                => del(`/api/teams/${id}`, t()),
    members: {
      list:   (teamId: string) => get<TeamMember[]>(`/api/teams/${teamId}/members`, t()),
      create: (teamId: string, body: CreateMemberRequest) => post(`/api/teams/${teamId}/members`, t(), body),
      delete: (teamId: string, userId: string) => del(`/api/teams/${teamId}/members/${userId}`, t()),
      update: (teamId: string, userId: string, body: UpdateMemberRequest) =>
        put(`/api/teams/${teamId}/members/${userId}`, t(), body),
      resetPassword: (teamId: string, userId: string, body: ResetMemberPasswordRequest) =>
        put(`/api/teams/${teamId}/members/${userId}/reset-password`, t(), body),
      cleanup: (teamId: string) => del(`/api/teams/${teamId}/members/cleanup`, t()),
    },
    tournaments: {
      list:   (teamId: string) => get<TournamentListItem[]>(`/api/teams/${teamId}/tournaments`, t()),
      create: (teamId: string, body: CreateTournamentRequest) =>
        post<unknown>(`/api/teams/${teamId}/tournaments`, t(), body),
    },
  }

  // ============================================================
  // Tournaments
  // ============================================================
  const tournaments = {
    get:          (id: string) => get<TournamentInfo>(`/api/tournaments/${id}`, t()),
    update:       (id: string, body: UpdateTournamentRequest) => put(`/api/tournaments/${id}`, t(), body),
    delete:       (id: string) => del(`/api/tournaments/${id}`, t()),
    public:       (id: string) => get<PublicTournamentInfo>(`/api/tournaments/${id}/public`, null),
    publicList:   (query: PublicTournamentListQuery) => get<PublicTournamentInfo[]>('/api/tournaments/public.list', null, query as Record<string, unknown>),

    // Registration
    registration: {
      config:   (tournamentId: string) => get<RegistrationConfig>(`/api/tournaments/${tournamentId}/registration-config`, t()),
      settings: (tournamentId: string, body: RegistrationSettings) => put(`/api/tournaments/${tournamentId}/registration-settings`, t(), body),
      fields:   (tournamentId: string, fields: Record<string, unknown>[]) => put(`/api/tournaments/${tournamentId}/registration-fields`, t(), { fields }),
      list:     (tournamentId: string, params?: { status?: string; type?: string }) =>
        get<{ registrations: RegistrationRecord[]; pagination: { total: number; page: number; pageSize: number } }>(`/api/tournaments/${tournamentId}/registrations`, t(), params as Record<string, unknown>),
      my:       (tournamentId: string) => get<RegistrationRecord[]>(`/api/tournaments/${tournamentId}/my-registration`, t()),
      submit:   (tournamentId: string, body: SubmitRegistrationRequest) =>
        post<{ code: number; message: string; data: RegistrationRecord }>(`/api/tournaments/${tournamentId}/register`, t(), body),
      review:   (tournamentId: string, regId: string, body: ReviewRegistrationRequest) =>
        put(`/api/tournaments/${tournamentId}/registrations/${regId}`, t(), body),
      autoMatch: (tournamentId: string, body: AutoMatchRequest) =>
        post(`/api/tournaments/${tournamentId}/registrations/auto-match`, t(), body),
      convertToTeams: (tournamentId: string, items: { name: string; registrationIds: string[] }[]) =>
        post(`/api/tournaments/${tournamentId}/registrations/convert-teams`, t(), { items }),
      createDebaterAccounts: (tournamentId: string, registrationIds?: string[]) =>
        post(`/api/tournaments/${tournamentId}/registrations/create-accounts`, t(), { registrationIds }),
    },

    // Matches
    matches: {
      list:     (tournamentId: string) => get<MatchInfo[]>(`/api/tournaments/${tournamentId}/matches`, t()),
      create:   (tournamentId: string, body: CreateMatchRequest) => post(`/api/tournaments/${tournamentId}/matches`, t(), body),
      generate: (tournamentId: string, body: GenerateMatchesRequest) => post(`/api/tournaments/${tournamentId}/matches/generate`, t(), body),
      drawLots: (tournamentId: string, body: DrawLotsRequest) => post(`/api/tournaments/${tournamentId}/draw-lots`, t(), body),
    },

    // Scores
    scores: {
      get:    (id: string, params?: { matchId?: string; type?: string }) =>
        get<Record<string, unknown>[]>(`/api/tournaments/${id}/scores`, t(), params as Record<string, unknown>),
      submit: (id: string, body: SubmitScoreRequest) => post(`/api/tournaments/${id}/scores`, t(), body),
    },

    // Timer
    timer: {
      config:   (id: string) => get<TimerConfig>(`/api/tournaments/${id}/timer-config`, t()),
      saveConfig: (id: string, body: TimerConfig) => put(`/api/tournaments/${id}/timer-config`, t(), body),
      template: (id: string) => get<TimerTemplate>(`/api/tournaments/${id}/timer-template`, t()),
      saveTemplate: (id: string, body: TimerTemplate) => put(`/api/tournaments/${id}/timer-template`, t(), body),
    },

    // Topics (debate)
    topics: {
      list:   (id: string, params?: { search?: string; category?: string }) =>
        get<DebateTopicListResult>(`/api/tournaments/${id}/debate-topics`, t(), params as Record<string, unknown>),
      create: (id: string, body: Record<string, unknown>) => post(`/api/tournaments/${id}/debate-topics`, t(), body),
      update: (id: string, topicId: string, body: Record<string, unknown>) => put(`/api/tournaments/${id}/debate-topics/${topicId}`, t(), body),
      delete: (id: string, topicId: string) => del(`/api/tournaments/${id}/debate-topics/${topicId}`, t()),
      import: (id: string, body: Record<string, unknown>) =>
        post<DebateTopicImportResult>(`/api/tournaments/${id}/debate-topics/import`, t(), body),
    },

    // Votes (topic-votes)
    votes: {
      list:     (id: string, params?: { status?: string; matchId?: string }) =>
        get<TopicVoteListResult>(`/api/tournaments/${id}/topic-votes`, t(), params as Record<string, unknown>),
      get:      (id: string, voteId: string) => get<TopicVoteDetail>(`/api/tournaments/${id}/topic-votes/${voteId}`, t()),
      create:   (id: string, body: Record<string, unknown>) => post(`/api/tournaments/${id}/topic-votes`, t(), body),
      update:   (id: string, voteId: string, body: Record<string, unknown>) => put(`/api/tournaments/${id}/topic-votes/${voteId}`, t(), body),
      delete:   (id: string, voteId: string) => del(`/api/tournaments/${id}/topic-votes/${voteId}`, t()),
      cast:     (id: string, voteId: string, body: Record<string, unknown>) => post(`/api/tournaments/${id}/topic-votes/${voteId}/cast`, t(), body),
      myRecord: (id: string, voteId: string) => get<MyVoteRecordResult>(`/api/tournaments/${id}/topic-votes/${voteId}/my-record`, t()),
      stats:    (id: string, voteId: string) => get<VoteStatsResult>(`/api/tournaments/${id}/topic-votes/${voteId}/stats`, t()),
    },

    // Judge
    judgeMatches: (id: string, judgeName: string) =>
      get(`/api/tournaments/${id}/judge/matches`, t(), { judgeName }),
  }

  // ============================================================
  // Matches (direct, not under tournament)
  // ============================================================
  const matches = {
    get:       (id: string) => get<MatchInfo>(`/api/matches/${id}`, t()),
    update:    (id: string, body: UpdateMatchRequest) => put(`/api/matches/${id}`, t(), body),
    delete:    (id: string, body?: DeleteMatchRequest) => del(`/api/matches/${id}`, t(), body),
    restore:   (id: string, currentVersion: number) => post(`/api/matches/${id}/restore`, t(), { currentVersion }),
    submitResult: (id: string, body: SubmitResultRequest) => post(`/api/matches/${id}/result`, t(), body),
    start:     (id: string) => post(`/api/matches/${id}/start`, t()),
  }

  // ============================================================
  // Standalone Matches
  // ============================================================
  const standalone = {
    list:     () => get<Record<string, unknown>[]>('/api/standalone-matches', t()),
    create:   (body: Record<string, unknown>) => post('/api/standalone-matches', t(), body),
    get:      (id: string) => get<Record<string, unknown>>(`/api/standalone-matches/${id}`, t()),
    update:   (id: string, body: Record<string, unknown>) => put(`/api/standalone-matches/${id}`, t(), body),
    delete:   (id: string) => del(`/api/standalone-matches/${id}`, t()),
    createMatch: (id: string, body: CreateMatchRequest) => post(`/api/standalone-matches/${id}/matches`, t(), body),
    timer: {
      config:   (id: string) => get<TimerConfig>(`/api/standalone-matches/${id}/timer-config`, t()),
      saveConfig: (id: string, body: TimerConfig) => put(`/api/standalone-matches/${id}/timer-config`, t(), body),
      template: (id: string) => get<TimerTemplate>(`/api/standalone-matches/${id}/timer-template`, t()),
      saveTemplate: (id: string, body: TimerTemplate) => put(`/api/standalone-matches/${id}/timer-template`, t(), body),
    },
  }

  // ============================================================
  // Timer Projects
  // ============================================================
  const timerProjects = {
    list:   () => get<TimerProjectInfo[]>('/api/timer/projects', t()),
    create: (body: CreateTimerProjectRequest) => post('/api/timer/projects', t(), body),
    get:    (id: string) => get<TimerProjectInfo>(`/api/timer/projects/${id}`, t()),
    update: (id: string, body: UpdateTimerProjectRequest) => put(`/api/timer/projects/${id}`, t(), body),
    delete: (id: string) => del(`/api/timer/projects/${id}`, t()),
  }

  // ============================================================
  // Bot
  // ============================================================
  const bot = {
    status:     () => get<BotStatus>('/api/bot/status', t()),
    updateConfig: (body: BotConfigRequest) => put('/api/bot/config', t(), body),
    unbind:     () => post('/api/bot/unbind', t()),
    channels:   () => get<ChannelInfo[]>('/api/bot/channels', t()),
    subchannels: (guildId: string) => get<ChannelInfo[]>(`/api/bot/channels/${guildId}/subchannels`, t()),
    schedule:   (body: BotScheduleRequest) => post('/api/bot/schedule', t(), body),
    arena: {
      list:     () => get<ArenaInfo[]>('/api/bot/arena/list', t()),
      create:   (body: CreateArenaRequest) => post('/api/bot/arena/create', t(), body),
      status:   (channelId?: string) => get('/api/bot/arena/status', t(), channelId ? { channelId } : undefined),
      close:    (channelId: string, guildId?: string) => post('/api/bot/arena/close', t(), { channelId, guildId }),
      claim:    (body: Record<string, unknown>) => post('/api/bot/arena/claim', t(), body),
      unclaim:  (body: Record<string, unknown>) => post('/api/bot/arena/unclaim', t(), body),
    },
    permissions: {
      grantSpeak:  (body: GrantSpeakRequest) => post('/api/bot/permissions/grant-speak', t(), body),
      revokeSpeak: (body: RevokeSpeakRequest) => post('/api/bot/permissions/revoke-speak', t(), body),
      reset:       (channelId: string) => post('/api/bot/permissions/reset', t(), { channelId }),
      switchRound: (targetSide: string, channelId: string) => post('/api/bot/permissions/switch-round', t(), { targetSide, channelId }),
    },
  }

  // ============================================================
  // Scheduled Posts
  // ============================================================
  const scheduledPosts = {
    list:    () => get<Record<string, unknown>[]>('/api/scheduled-posts', t()),
    create:  (body: Record<string, unknown>) => post('/api/scheduled-posts', t(), body),
    update:  (id: string, body: Record<string, unknown>) => put(`/api/scheduled-posts/${id}`, t(), body),
    delete:  (id: string) => del(`/api/scheduled-posts/${id}`, t()),
    toggle:  (id: string, paused: boolean) => post(`/api/scheduled-posts/${id}/toggle`, t(), { paused }),
    runs:    (id: string) => get<Record<string, unknown>[]>(`/api/scheduled-posts/${id}/runs`, t()),
  }

  // ============================================================
  // Upload
  // ============================================================
  const upload = (formData: FormData) =>
    $fetch('/api/upload', { method: 'POST', body: formData, headers: buildHeaders(t()) })

  // ============================================================
  // Admin
  // ============================================================
  const admin = {
    individualUsers: () => get<Record<string, unknown>[]>('/api/admin/individual-users', t()),
    teams:     () => get<Record<string, unknown>[]>('/api/admin/teams', t()),
    users:     (params?: { page?: number; pageSize?: number }) => get<Record<string, unknown>>('/api/admin/users', t(), params as Record<string, unknown>),
    createUser: (body: Record<string, unknown>) => post('/api/admin/users', t(), body),
    deleteUser: (id: string) => del(`/api/admin/users/${id}`, t()),
    resetUserPassword: (id: string, newPassword: string) => put(`/api/admin/users/${id}/reset`, t(), { newPassword }),
  }

  return {
    auth: auth_api,
    teams,
    tournaments,
    matches,
    standalone,
    timerProjects,
    bot,
    scheduledPosts,
    upload,
    admin,
  }
}
