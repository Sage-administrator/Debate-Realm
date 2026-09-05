/**
 * 团队相关 Schema — 前后端共享
 */
import { z } from 'zod'
import { ID, TeamMode } from './common'

// ── 团队信息 ──

export const TeamInfo = z.object({
  id: ID,
  name: z.string(),
  mode: TeamMode,
  botAppId: z.string().nullable(),
  botChannelId: z.string().nullable(),
  botIsPrivate: z.boolean().nullable(),
  admin: z.object({
    id: ID,
    username: z.string(),
    nickname: z.string().nullable(),
  }),
  memberCount: z.number().optional(),
  tournamentCount: z.number().optional(),
  createdAt: z.string(),
})
export type TeamInfo = z.infer<typeof TeamInfo>

// ── 团队详情（GET /api/teams/:id，含嵌套 botConfig/members/tournaments） ──
// 注意与 TeamInfo（列表/通用扁平结构）不同：详情端点把 bot 配置包在 botConfig 下。
export const TeamDetail = z.object({
  id: ID,
  name: z.string(),
  mode: TeamMode,
  botConfig: z.object({
    botAppId: z.string().nullable(),
    botChannelId: z.string().nullable(),
  }),
  members: z.array(
    z.object({
      id: z.string(),
      userId: z.string(),
      username: z.string(),
      nickname: z.string().nullable(),
      email: z.string().nullable(),
      avatar: z.string().nullable(),
      role: z.string().nullable(),
    }),
  ),
  memberCount: z.number(),
  tournaments: z.array(z.any()).optional(),
  createdAt: z.string(),
})
export type TeamDetail = z.infer<typeof TeamDetail>

// ── 创建团队 ──

export const CreateTeamRequest = z.object({
  name: z.string().min(1),
  mode: TeamMode,
  adminUsername: z.string().min(1),
  adminPassword: z.string().min(6),
  botAppId: z.string().optional(),
  botAppSecret: z.string().optional(),
  botChannelId: z.string().optional(),
})
export type CreateTeamRequest = z.infer<typeof CreateTeamRequest>

// ── 更新团队 ──

export const UpdateTeamRequest = z
  .object({
    name: z.string().min(1).optional(),
    botAppId: z.string().nullable().optional(),
    botAppSecret: z.string().nullable().optional(),
    botChannelId: z.string().nullable().optional(),
  })
  .partial()
export type UpdateTeamRequest = z.infer<typeof UpdateTeamRequest>

// ── 团队成员 ──

export const TeamMember = z.object({
  id: ID,
  username: z.string(),
  nickname: z.string().nullable(),
  role: z.string(),
  email: z.string().nullable(),
  createdAt: z.string(),
})
export type TeamMember = z.infer<typeof TeamMember>

// ── 创建/更新成员 ──

export const CreateMemberRequest = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
})
export type CreateMemberRequest = z.infer<typeof CreateMemberRequest>

export const UpdateMemberRequest = z
  .object({
    username: z.string().min(1).optional(),
    nickname: z.string().optional(),
    email: z.string().email().optional(),
    avatar: z.string().optional(),
  })
  .partial()
export type UpdateMemberRequest = z.infer<typeof UpdateMemberRequest>

export const ResetMemberPasswordRequest = z.object({
  newPassword: z.string().min(6),
})
export type ResetMemberPasswordRequest = z.infer<typeof ResetMemberPasswordRequest>
