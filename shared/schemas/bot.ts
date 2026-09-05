/**
 * Bot/QQ频道相关 Schema — 前后端共享
 */
import { z } from 'zod'
import { ID } from './common'

// ── Bot 状态 ──

export const BotStatus = z.object({
  connected: z.boolean(),
  teamId: ID.nullable(),
  lastHeartbeat: z.string().nullable(),
  guildCount: z.number().optional(),
  uptime: z.number().optional(),
})
export type BotStatus = z.infer<typeof BotStatus>

// ── Bot 配置 ──

export const BotConfigRequest = z
  .object({
    botAppId: z.string().optional(),
    botAppSecret: z.string().optional(),
    botChannelId: z.string().optional(),
    botIsPrivate: z.boolean().optional(),
  })
  .partial()
export type BotConfigRequest = z.infer<typeof BotConfigRequest>

// ── 频道 ──

export const ChannelInfo = z.object({
  id: ID,
  name: z.string(),
  type: z.number(),
  guildId: ID,
  parentId: z.string().nullable(),
})
export type ChannelInfo = z.infer<typeof ChannelInfo>

// ── 赛场 ──

export const ArenaInfo = z.object({
  id: ID,
  name: z.string(),
  matchFormat: z.string(),
  status: z.string(),
  channelId: z.string().nullable(),
  guildId: z.string().nullable(),
  createdAt: z.string(),
})
export type ArenaInfo = z.infer<typeof ArenaInfo>

// ── 赛场创建 ──

export const CreateArenaRequest = z.object({
  channelId: z.string().min(1),
  name: z.string().min(1).max(8),
  matchFormat: z.string().optional().default('4v4'),
})
export type CreateArenaRequest = z.infer<typeof CreateArenaRequest>

// ── 权限 ──

export const GrantSpeakRequest = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  channelId: z.string().min(1),
  durationMs: z.number().int().optional(),
})
export type GrantSpeakRequest = z.infer<typeof GrantSpeakRequest>

export const RevokeSpeakRequest = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  channelId: z.string().min(1),
})
export type RevokeSpeakRequest = z.infer<typeof RevokeSpeakRequest>

// ── Bot 调度 ──

export const BotScheduleRequest = z
  .object({
    teamId: ID,
    priority: z.number().int().optional(),
    customDelayMs: z.number().int().optional(),
    enabled: z.boolean().optional(),
  })
  .partial()
export type BotScheduleRequest = z.infer<typeof BotScheduleRequest>
