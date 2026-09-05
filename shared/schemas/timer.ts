/**
 * 计时器相关 Schema — 前后端共享
 */
import { z } from 'zod'
import { ID, StageType } from './common'

// ── 计时器环节 ──

export const TimerStage = z.object({
  id: ID.optional(),
  name: z.string().min(1),
  duration: z.number().int().min(0),
  type: StageType,
  description: z.string().nullable().optional(),
  orderIndex: z.number().int(),
  positiveDuration: z.number().int().nullable().optional(),
  negativeDuration: z.number().int().nullable().optional(),
  speaker: z.string().nullable().optional(),
  questioner: z.string().nullable().optional(),
  responder: z.string().nullable().optional(),
  responders: z.string().nullable().optional(),
  firstSpeaker: z.string().nullable().optional(),
  questionDuration: z.number().int().nullable().optional(),
  answerDuration: z.number().int().nullable().optional(),
  protectionTime: z.number().int().nullable().optional(),
  enabled: z.boolean().optional().default(true),
  pptImage: z.string().nullable().optional(),
  positiveSpeakers: z.string().nullable().optional(),
  negativeSpeakers: z.string().nullable().optional(),
  speakers: z.string().nullable().optional(),
})
export type TimerStage = z.infer<typeof TimerStage>

// ── 计时器配置 ──

export const TimerConfig = z.object({
  title: z.string().min(1),
  positiveTopic: z.string().nullable().optional(),
  negativeTopic: z.string().nullable().optional(),
  teamPositiveName: z.string().nullable().optional(),
  teamNegativeName: z.string().nullable().optional(),
  uiConfig: z.record(z.string(), z.any()).nullable().optional(),
  skinConfig: z.record(z.string(), z.any()).nullable().optional(),
  audioConfig: z.record(z.string(), z.any()).nullable().optional(),
  teamLogoConfig: z.record(z.string(), z.any()).nullable().optional(),
  stages: z.array(TimerStage).optional(),
})
export type TimerConfig = z.infer<typeof TimerConfig>

// ── 计时器项目 ──

export const TimerProjectInfo = z.object({
  id: ID,
  name: z.string(),
  title: z.string(),
  positiveTopic: z.string().nullable(),
  negativeTopic: z.string().nullable(),
  teamPositiveName: z.string().nullable(),
  teamNegativeName: z.string().nullable(),
  uiConfig: z.any().nullable(),
  stages: z.array(TimerStage),
  createdAt: z.string(),
})
export type TimerProjectInfo = z.infer<typeof TimerProjectInfo>

// ── 创建/更新计时器项目 ──

export const CreateTimerProjectRequest = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  positiveTopic: z.string().nullable().optional(),
  negativeTopic: z.string().nullable().optional(),
  teamPositiveName: z.string().nullable().optional(),
  teamNegativeName: z.string().nullable().optional(),
  uiConfig: z.record(z.string(), z.any()).nullable().optional(),
})
export type CreateTimerProjectRequest = z.infer<typeof CreateTimerProjectRequest>

export const UpdateTimerProjectRequest = z.object({
  title: z.string().optional(),
  name: z.string().optional(),
  positiveTopic: z.string().nullable().optional(),
  negativeTopic: z.string().nullable().optional(),
  teamPositiveName: z.string().nullable().optional(),
  teamNegativeName: z.string().nullable().optional(),
  uiConfig: z.record(z.string(), z.any()).nullable().optional(),
  stages: z.array(TimerStage).optional(),
}).partial()
export type UpdateTimerProjectRequest = z.infer<typeof UpdateTimerProjectRequest>

// ── 计时器模板 ──

export const TimerTemplate = z.object({
  phases: z.string(),
})
export type TimerTemplate = z.infer<typeof TimerTemplate>
