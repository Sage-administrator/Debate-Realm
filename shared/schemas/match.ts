/**
 * 比赛/对局相关 Schema — 前后端共享
 */
import { z } from 'zod'
import { ID, MatchStatus } from './common'

// ─��� 比赛信息 ──

export const MatchInfo = z.object({
  id: ID,
  tournamentId: ID.nullable(),
  round: z.string(),
  orderNum: z.number().int(),
  teamA: z.string().nullable(),
  teamB: z.string().nullable(),
  winner: z.string().nullable(),
  scoreA: z.number().int(),
  scoreB: z.number().int(),
  status: MatchStatus,
  scheduledAt: z.string().nullable(),
  topic: z.string().nullable(),
  affirmativeSide: z.string().nullable(),
  bestDebaterA: z.string().nullable(),
  bestDebaterB: z.string().nullable(),
  judge: z.string().nullable(),
  version: z.number().int(),
  deletedAt: z.string().nullable(),
  promotedFromA: z.string().nullable(),
  promotedFromB: z.string().nullable(),
  isBye: z.boolean(),
})
export type MatchInfo = z.infer<typeof MatchInfo>

// ── 创建比赛 ──

export const CreateMatchRequest = z.object({
  round: z.string().min(1),
  orderNum: z.number().int().min(1),
  teamA: z.string().optional(),
  teamB: z.string().optional(),
  scheduledAt: z.string().optional(),
})
export type CreateMatchRequest = z.infer<typeof CreateMatchRequest>

// ── 更新比赛 ──

export const UpdateMatchRequest = z
  .object({
    round: z.string().optional(),
    orderNum: z.number().int().optional(),
    teamA: z.string().nullable().optional(),
    teamB: z.string().nullable().optional(),
    scheduledAt: z.string().nullable().optional(),
    status: MatchStatus.optional(),
    currentVersion: z.number().int().optional(),
  })
  .partial()
export type UpdateMatchRequest = z.infer<typeof UpdateMatchRequest>

// ── 删除比赛 ──

export const DeleteMatchRequest = z
  .object({
    currentVersion: z.number().int().optional(),
    deleteReason: z.string().optional(),
  })
  .partial()
export type DeleteMatchRequest = z.infer<typeof DeleteMatchRequest>

// ── 提交赛果 ──

export const SubmitResultRequest = z.object({
  winner: z.string().min(1),
  scoreA: z.number().int(),
  scoreB: z.number().int(),
  bestDebaterA: z.string().nullable().optional(),
  bestDebaterB: z.string().nullable().optional(),
  judge: z.string().nullable().optional(),
  currentVersion: z.number().int().optional(),
})
export type SubmitResultRequest = z.infer<typeof SubmitResultRequest>

// ── 响应类型别名（比赛操作端点真实返回） ──

/** 录比分响应：POST /api/matches/:id/result → { code, message, data: {...} } */
export type MatchResultSubmitResult = {
  code: number
  message: string
  data: {
    id: string
    winner: string | null
    scoreA: number
    scoreB: number
    status: string
    version: number
    advanced: {
      advanced: boolean
      targetMatchId?: string
      error?: string
      info?: string
      [key: string]: any
    }
    format?: string
  }
}

// ── 评委评分 ──

export const SubmitScoreRequest = z.object({
  matchId: ID,
  judgeName: z.string().min(1),
  dimensions: z.array(
    z.object({
      name: z.string(),
      score: z.number().int().min(0),
    }),
  ),
  reason: z.string().optional(),
  scoreTeamA: z.number().int(),
  scoreTeamB: z.number().int(),
  winner: z.string(),
  bestDebaterA: z.string().optional(),
  bestDebaterB: z.string().optional(),
})
export type SubmitScoreRequest = z.infer<typeof SubmitScoreRequest>
