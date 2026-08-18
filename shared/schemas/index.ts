/**
 * 共享 Schema 统一入口
 *
 * 使用方式：
 *   import { LoginRequest, UserInfo, TournamentInfo, ... } from '#shared/schemas'
 *   或分层引用：
 *   import { LoginRequest } from '#shared/schemas/auth'
 *
 * 前端: ~/../shared/schemas (通过 nuxt alias #shared)
 * 后端: ../../shared/schemas (相对路径) 或 #shared/schemas
 */

// ── 基础 ──
export * from './common'

// ── 认证 ──
export * from './auth'

// ── 团队 ──
export * from './team'

// ── 赛事 ──
export * from './tournament'

// ── 比赛 ──
export * from './match'

// ── 报名 ──
export * from './registration'

// ── 计时器 ──
export * from './timer'

// ── Bot ──
export * from './bot'

// ── 后台管理 ──
export * from './admin'

// ── 辩题 ──
export * from './debate-topics'

// ── 内部 API ──
export * from './internal'

// ── 问卷 ──
export * from './questionnaires'
export * from './questionnaire-submit'

// ── 定时发布 ──
export * from './scheduled-posts'

// ── 投票 ──
export * from './topic-votes'
export * from './topic-vote-cast'

// ── 赛事设置 ──
export * from './tournament-settings'
