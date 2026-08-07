import type { H3Event, EventHandlerRequest } from 'h3'
import { getHeader, createError, getCookie } from 'h3'
import { verifyToken, type JWTPayload } from '../lib/jwt'
import type { PrismaClient } from '../lib/generated/client'
import { prisma } from '../lib/prisma'

// 允许其他模块直接 import type { JWTPayload } from '../utils/auth'
export type { JWTPayload }

// 被踢下线的标准错误信息
export const KICKED_MESSAGE = '您的账号已在其他设备登录，请重新登录'

// Cookie 名称（与登录接口和前端保持一致）
const TOKEN_COOKIE = 'auth_token'

/**
 * 从请求事件中提取 token
 * 优先级：Authorization header > Cookie
 * 支持两种场景：
 * 1. 客户端 API 调用：通过 Authorization: Bearer <token> 发送
 * 2. SSR / 浏览器直接访问：通过 Cookie 自动发送
 */
function extractTokenFromEvent(event: H3Event<EventHandlerRequest>): string | null {
  // 1. 优先从 Authorization header 读取（客户端 API 调用方式）
  const authHeader = getHeader(event, 'authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  // 2. 兜底从 Cookie 读取（SSR 阶段、浏览器直接访问等场景）
  const cookieToken = getCookie(event, TOKEN_COOKIE)
  if (cookieToken) {
    return cookieToken
  }

  return null
}

/**
 * 从请求事件中获取用户信息（不校验 session）
 */
export function getUserFromEvent(event: H3Event<EventHandlerRequest>): JWTPayload {
  const token = extractTokenFromEvent(event)

  if (!token) {
    throw createError({ statusCode: 401, message: '未提供认证令牌' })
  }

  const payload = verifyToken(token)

  if (!payload) {
    throw createError({ statusCode: 401, message: '无效或过期的认证令牌' })
  }

  return payload
}

/**
 * 从请求事件中获取用户信息，并校验 tokenVersion 是否与数据库一致（单设备登录校验）
 *
 * 若 auth 中间件已在 event.context.user 中注入了校验过的用户信息，直接复用（免 DB 查询）。
 * 否则走完整的 token 提取 → JWT 验证 → DB tokenVersion 校验流程。
 */
export async function getUserFromEventWithSession(
  event: H3Event<EventHandlerRequest>,
  prisma: PrismaClient,
): Promise<JWTPayload> {
  // 快速路径：auth 中间件已校验过，直接返回缓存结果
  if (event.context.user) {
    return event.context.user as JWTPayload
  }

  const payload = getUserFromEvent(event)

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

  // 缓存到 context，后续调用直接复用
  event.context.user = payload as JWTPayload & Record<string, unknown>
  return payload
}

/**
 * requireRole — 角色断言
 * 优先使用 event.context.user（中间件注入），否则走 getUserFromEvent 提取 token。
 */
export function requireRole(event: H3Event<EventHandlerRequest>, ...roles: string[]): JWTPayload {
  const user = (event.context.user as JWTPayload | undefined) ?? getUserFromEvent(event)

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
