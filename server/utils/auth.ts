import type { H3Event, EventHandlerRequest } from 'h3'
import { getHeader, createError } from 'h3'
import { verifyToken, type JWTPayload } from '../lib/jwt'
import type { PrismaClient } from '../lib/generated/client'
import { prisma } from '../lib/prisma'

// 允许其他模块直接 import type { JWTPayload } from '../utils/auth'
export type { JWTPayload }

// 被踢下线的标准错误信息
export const KICKED_MESSAGE = '您的账号已在其他设备登录，请重新登录'

/**
 * 从请求事件中获取用户信息（不校验 session）
 */
export function getUserFromEvent(event: H3Event<EventHandlerRequest>): JWTPayload {
  const authHeader = getHeader(event, 'authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, message: '未提供认证令牌' })
  }

  const token = authHeader.substring(7)
  const payload = verifyToken(token)

  if (!payload) {
    throw createError({ statusCode: 401, message: '无效或过期的认证令牌' })
  }

  return payload
}

/**
 * 从请求事件中获取用户信息，并校验 tokenVersion 是否与数据库一致（单设备登录校验）
 * 若 tokenVersion 不匹配，说明账号已在其他设备登录，返回 401 含被踢提示
 */
export async function getUserFromEventWithSession(
  event: H3Event<EventHandlerRequest>,
  prisma: PrismaClient,
): Promise<JWTPayload> {
  const payload = getUserFromEvent(event)

  // 查询数据库中的当前 tokenVersion
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { tokenVersion: true },
  })

  if (!user) {
    throw createError({ statusCode: 401, message: '用户不存在' })
  }

  if (user.tokenVersion !== payload.tokenVersion) {
    throw createError({ statusCode: 401, message: KICKED_MESSAGE })
  }

  return payload
}

export function requireRole(event: H3Event<EventHandlerRequest>, ...roles: string[]): JWTPayload {
  const user = getUserFromEvent(event)

  if (!roles.includes(user.role)) {
    throw createError({ statusCode: 403, message: '权限不足' })
  }

  return user
}

/**
 * 服务令牌守卫：供 WorkBuddy 自动化调用的 /dispatch* 端点使用。
 * 与用户会话令牌隔离 —— 自动化 prompt 无法持有用户会话，故使用团队级 apiToken。
 * 用法：在路由中 `const team = await requireServiceToken(event, prisma)`，返回命中的 Team。
 */
export async function requireServiceToken(
  event: H3Event<EventHandlerRequest>,
  prisma: PrismaClient,
) {
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, message: '未提供服务令牌' })
  }
  const token = authHeader.substring(7)
  const team = await prisma.team.findFirst({ where: { apiToken: token } })
  if (!team) {
    throw createError({ statusCode: 401, message: '无效的服务令牌' })
  }
  return team
}
