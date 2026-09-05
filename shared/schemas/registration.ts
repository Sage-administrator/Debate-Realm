/**
 * 报名相关 Schema — 前后端共享
 */
import { z } from 'zod'
import { ID, RegistrationType, RegistrationStatus } from './common'

// ── 报名配置 ──

export const RegistrationConfig = z.object({
  id: ID,
  name: z.string(),
  description: z.string().nullable(),
  format: z.string(),
  venue: z.string().nullable(),
  scheduledAt: z.string().nullable(),
  registrationOpen: z.boolean(),
  registrationDeadline: z.string().nullable(),
  isPublic: z.boolean(),
  teamSize: z.number().int().nullable(),
  registrationInfo: z.string().nullable(),
  fields: z.array(
    z.object({
      id: ID,
      fieldName: z.string(),
      fieldKey: z.string(),
      fieldType: z.string(),
      fieldOptions: z.string().nullable(),
      required: z.boolean(),
      sortOrder: z.number().int(),
      appliesTo: z.string(),
    }),
  ),
})
export type RegistrationConfig = z.infer<typeof RegistrationConfig>

// ── 提交报名 ──

export const SubmitRegistrationRequest = z.object({
  type: RegistrationType,
  teamName: z.string().optional(),
  submitterName: z.string().min(1),
  contactPhone: z.string().min(1),
  contactEmail: z.string().email().optional(),
  notes: z.string().optional(),
  customData: z.record(z.string(), z.string()).optional(),
  members: z
    .array(
      z.object({
        name: z.string().min(1),
        preferredPosition: z.string().optional(),
        experience: z.string().optional(),
      }),
    )
    .min(1),
})
export type SubmitRegistrationRequest = z.infer<typeof SubmitRegistrationRequest>

// ── 报名记录 ──

export const RegistrationRecord = z.object({
  id: ID,
  tournamentId: ID,
  type: RegistrationType,
  status: RegistrationStatus,
  userId: ID.nullable(),
  teamName: z.string().nullable(),
  submitterName: z.string(),
  contactPhone: z.string(),
  contactEmail: z.string().nullable(),
  notes: z.string().nullable(),
  customData: z.string().nullable(),
  createdAt: z.string(),
  reviewedAt: z.string().nullable(),
  reviewNote: z.string().nullable(),
  members: z
    .array(
      z.object({
        id: ID,
        name: z.string(),
        preferredPosition: z.string().nullable(),
        experience: z.string().nullable(),
      }),
    )
    .optional(),
})
export type RegistrationRecord = z.infer<typeof RegistrationRecord>

// ── 审核报名 ──

export const ReviewRegistrationRequest = z.object({
  action: z.enum(['approve', 'reject']),
  reviewNote: z.string().optional(),
})
export type ReviewRegistrationRequest = z.infer<typeof ReviewRegistrationRequest>

// ── 自动匹配 ──

export const AutoMatchRequest = z.object({
  teamSize: z.number().int().min(2).optional(),
})
export type AutoMatchRequest = z.infer<typeof AutoMatchRequest>

// ── 响应类型别名（registration-fields / auto-match 端点真实返回） ──

/** 注册字段元素（registration-fields 端点返回，含 designer 用字段） */
export type RegistrationFieldItem = {
  id: string
  fieldName: string
  fieldKey: string
  fieldType: string
  fieldOptions: string | null
  required: boolean
  sortOrder: number
  appliesTo: string
  placeholder?: string | null
  description?: string | null
  width?: string | null
  systemField?: boolean
}
/** 保存注册字段响应 */
export type SaveRegistrationFieldsResult = { success: boolean; fields: RegistrationFieldItem[] }
/** 自动组队响应（建议分组，不写库） */
export type AutoMatchResult = {
  teams: Array<{ [key: string]: any }>
  unmatched: Array<{ [key: string]: any }>
}
