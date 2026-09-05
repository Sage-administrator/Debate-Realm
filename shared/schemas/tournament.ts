/**
 * 赛事相关 Schema — 前后端共享
 */
import { z } from 'zod'
import {
  ID,
  TournamentFormat,
  TournamentStatus,
  RegistrationAllowedType,
  BestDebaterMode,
} from './common'

// ── 赛事基础信息 ──

export const TournamentInfo = z.object({
  id: ID,
  name: z.string(),
  description: z.string().nullable(),
  format: TournamentFormat,
  status: TournamentStatus,
  scheduledAt: z.string().nullable(),
  venue: z.string().nullable(),
  team: z.object({ id: ID, name: z.string() }),
  teams: z.array(z.string()),
  judges: z.array(z.string()),
  bestDebaterMode: BestDebaterMode.nullable().optional(),
  groupCount: z.number().int().nullable().optional(),
  topicPool: z.string().nullable().optional(),
  assignments: z.any().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
})
export type TournamentInfo = z.infer<typeof TournamentInfo>

// ── 赛事创建/更新 ──

export const CreateTournamentRequest = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  format: TournamentFormat.optional(),
  scheduledAt: z.string().optional(),
  venue: z.string().optional(),
  teams: z.array(z.string()).optional(),
  judges: z.array(z.string()).optional(),
})
export type CreateTournamentRequest = z.infer<typeof CreateTournamentRequest>

export const UpdateTournamentRequest = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    format: TournamentFormat.optional(),
    status: TournamentStatus.optional(),
    scheduledAt: z.string().nullable().optional(),
    venue: z.string().nullable().optional(),
    teams: z.array(z.string()).optional(),
    judges: z.array(z.string()).optional(),
  })
  .partial()
export type UpdateTournamentRequest = z.infer<typeof UpdateTournamentRequest>

// ── 公开赛事 ──

export const PublicTournamentInfo = z.object({
  id: ID,
  name: z.string(),
  description: z.string().nullable(),
  format: TournamentFormat,
  status: TournamentStatus,
  scheduledAt: z.string().nullable(),
  venue: z.string().nullable(),
  isPublic: z.boolean(),
  registrationOpen: z.boolean(),
  registrationDeadline: z.string().nullable(),
  team: z.object({ id: ID, name: z.string() }),
  matchCount: z.number(),
  createdAt: z.string(),
})
export type PublicTournamentInfo = z.infer<typeof PublicTournamentInfo>

// ── 公开赛事列表 ──

export const PublicTournamentListQuery = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  keyword: z.string().optional(),
  status: z.string().optional(),
})
export type PublicTournamentListQuery = z.infer<typeof PublicTournamentListQuery>

// ── 赛事列表项 ──

export const TournamentListItem = z.object({
  id: ID,
  name: z.string(),
  description: z.string().nullable(),
  format: z.string(),
  status: z.string(),
  scheduledAt: z.string().nullable(),
  venue: z.string().nullable(),
  teams: z.array(z.string()),
  judges: z.array(z.string()),
  matchCount: z.number(),
  createdAt: z.string(),
})
export type TournamentListItem = z.infer<typeof TournamentListItem>

// ── 报名设置 ──

export const RegistrationSettings = z.object({
  registrationOpen: z.boolean().optional(),
  registrationDeadline: z.string().nullable().optional(),
  isPublic: z.boolean().optional(),
  registrationType: RegistrationAllowedType.optional(),
  teamSize: z.number().int().positive().nullable().optional(),
  registrationInfo: z.string().nullable().optional(),
})
export type RegistrationSettings = z.infer<typeof RegistrationSettings>

// ── 抽签 ──

export const DrawLotsRequest = z.object({
  drawType: z.enum(['groups', 'topics_sides', 'all']),
  groupCount: z.number().int().min(1).optional(),
  topicPool: z.array(z.object({ pro: z.string(), con: z.string() })).optional(),
  bestDebaterMode: BestDebaterMode.optional(),
})
export type DrawLotsRequest = z.infer<typeof DrawLotsRequest>

// ── 响应类型别名 ──

/** 抽签响应：POST /api/tournaments/:id/draw-lots → { success, info } */
export type DrawLotsResult = { success: boolean; info: string; [key: string]: any }

// ── 赛程生成 ──

export const GenerateMatchesRequest = z.object({
  format: z.enum([
    'single_elimination',
    'double_elimination',
    'round_robin',
    'page_playoff',
    'swiss',
    'group_knockout',
  ]),
  teams: z.array(z.object({ name: z.string(), seed: z.number().int() })),
  seedMethod: z.enum(['random', 'rating', 'name']).optional(),
  roundRobinMode: z.enum(['single', 'double']).optional(),
  enableRevivalFinal: z.boolean().optional(),
  rounds: z.number().int().optional(),
  pairingAlgo: z.enum(['standard', 'simplified']).optional(),
  groupSize: z.number().int().optional(),
  promotePerGroup: z.number().int().optional(),
  knockoutFormat: z.string().optional(),
  clearExisting: z.boolean().optional(),
})
export type GenerateMatchesRequest = z.infer<typeof GenerateMatchesRequest>
