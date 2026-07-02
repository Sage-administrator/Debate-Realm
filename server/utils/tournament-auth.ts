import type { H3Event } from 'h3'
import { createError } from 'h3'
import type { JWTPayload } from './auth'
import { getUserFromEvent } from './auth'
import type { PrismaClient, Tournament, Team } from '../lib/generated/client'

/**
 * 赛事访问者的“读权限”统一判定。
 * 规则：
 *   1) system_admin → 直接允许
 *   2) admin / subaccount → 要求该用户的 teamId 与 tournament.teamId 相同
 *   3) individual → 因 tournament.teamId 必填、individual 无 team，目前无法绑定，统一拒绝
 *   4) 未登录 / 其他 → 401 / 403
 * 注意：当前 Tournament 表没有 isPublic 字段，所以没有“公开赛事可读”分支；
 *       如后续新增 isPublic，可在此统一扩展。
 */
export function canReadTournament(user: JWTPayload | null, tournament: { teamId: string }): boolean {
  if (!user) return false
  if (user.role === 'system_admin') return true
  if (user.role === 'admin' || user.role === 'subaccount' || user.role === 'debater') {
    return !!user.teamId && user.teamId === tournament.teamId
  }
  // individual / 其他角色：当前没有"个人赛事"的数据库支持
  return false
}

/**
 * 赛事访问者的“写权限”统一判定。
 * 规则：system_admin 或 team.adminId === 当前用户 id。
 * matches.post.ts、PUT /tournaments/:id、DELETE /tournaments/:id 等均应使用此函数。
 */
export function canWriteTournament(
  user: JWTPayload | null,
  tournament: { teamId: string },
  team: Team | null | { adminId: string },
): boolean {
  if (!user) return false
  if (user.role === 'system_admin') return true
  if (user.role !== 'admin') return false // subaccount / individual 无写权限
  if (!team) return false
  return team.adminId === user.userId
}

/**
 * 从 H3 event 解析出当前用户，然后对指定 tournament 做“读权限”断言；
 * 不通过会抛出 createError（401/403），由 Nitro 框架统一处理。
 */
export async function requireReadTournament(
  event: H3Event,
  prisma: PrismaClient,
  tournamentId: string,
): Promise<{ user: JWTPayload; tournament: Tournament & { team: Team } }> {
  const user = getUserFromEvent(event) // 未登录会在此抛 401

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { team: true },
  })
  if (!tournament) {
    throw createError({ statusCode: 404, statusMessage: '赛事不存在' })
  }

  if (!canReadTournament(user, tournament)) {
    throw createError({ statusCode: 403, statusMessage: '无权限查看此赛事' })
  }

  return { user, tournament: tournament as Tournament & { team: Team } }
}

/**
 * 从 H3 event 解析出当前用户，对指定 tournament 做“写权限”断言；
 * 不通过会抛出 createError（401/403）。
 * 语义等价于原 matches.post.ts:21 的：
 *   user.role !== 'system_admin' && tournament.team.adminId !== user.userId
 */
export async function requireWriteTournament(
  event: H3Event,
  prisma: PrismaClient,
  tournamentId: string,
): Promise<{ user: JWTPayload; tournament: Tournament & { team: Team } }> {
  const user = getUserFromEvent(event)

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { team: true },
  })
  if (!tournament) {
    throw createError({ statusCode: 404, statusMessage: '赛事不存在' })
  }

  if (!canWriteTournament(user, tournament, tournament.team)) {
    throw createError({ statusCode: 403, statusMessage: '无权限修改此赛事' })
  }

  return { user, tournament: tournament as Tournament & { team: Team } }
}
