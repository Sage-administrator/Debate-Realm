/**
 * 共享基础类型与通用 Schema
 * 供前后端共同引用，消除类型重复定义
 */
import { z } from 'zod'

// ── 枚举 ──

export const UserRole = z.enum(['system_admin', 'admin', 'subaccount', 'debater', 'individual'])
export type UserRole = z.infer<typeof UserRole>

export const TeamMode = z.enum(['qq_bot', 'individual'])
export type TeamMode = z.infer<typeof TeamMode>

export const TournamentFormat = z.enum([
  'single_elimination', 'double_elimination', 'round_robin',
  'page_playoff', 'swiss', 'group_knockout', 'manual',
])
export type TournamentFormat = z.infer<typeof TournamentFormat>

export const TournamentStatus = z.enum(['pending', 'in_progress', 'completed'])
export type TournamentStatus = z.infer<typeof TournamentStatus>

export const MatchStatus = z.enum(['pending', 'in_progress', 'completed'])
export type MatchStatus = z.infer<typeof MatchStatus>

export const RegistrationType = z.enum(['individual', 'team'])
export type RegistrationType = z.infer<typeof RegistrationType>

export const RegistrationStatus = z.enum(['pending', 'approved', 'rejected'])
export type RegistrationStatus = z.infer<typeof RegistrationStatus>

export const RegistrationAllowedType = z.enum(['individual', 'team', 'both'])
export type RegistrationAllowedType = z.infer<typeof RegistrationAllowedType>

export const VoteStatus = z.enum(['draft', 'open', 'closed'])
export type VoteStatus = z.infer<typeof VoteStatus>

export const QuestionnaireStatus = z.enum(['draft', 'open', 'closed'])
export type QuestionnaireStatus = z.infer<typeof QuestionnaireStatus>

export const ScheduleType = z.enum(['once', 'daily', 'weekly'])
export type ScheduleType = z.infer<typeof ScheduleType>

export const BestDebaterMode = z.enum(['both', 'winner_only'])
export type BestDebaterMode = z.infer<typeof BestDebaterMode>

// ── 通用响应 ──

export const ApiResponse = <T extends z.ZodTypeAny>(data: T) => z.object({
  code: z.number().optional(),
  success: z.boolean().optional(),
  message: z.string().optional(),
  data: data.optional(),
})
export type ApiResponse<T> = { code?: number; success?: boolean; message?: string; data?: T }

export const PaginatedResponse = <T extends z.ZodTypeAny>(item: T) => z.object({
  items: z.array(item),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
})
export type PaginatedResponse<T> = { items: T[]; total: number; page: number; pageSize: number }

// ── 计时器通用 ──

export const StageType = z.enum([
  'single_speech', 'single_question', 'summary',
  'bilateral_debate', 'free_debate',
  'single_timer', 'double_timer', 'no_timer', 'ppt_replace',
])
export type StageType = z.infer<typeof StageType>

// ── ID 类型 ──

export const ID = z.string().min(1)
