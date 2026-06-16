import type { H3Event, EventHandlerRequest } from 'h3'
import { getHeader, createError } from 'h3'
import { verifyToken, type JWTPayload } from '../lib/jwt'

export function getUserFromEvent(event: H3Event<EventHandlerRequest>): JWTPayload {
  const authHeader = getHeader(event, 'authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: '未提供认证令牌' })
  }

  const token = authHeader.substring(7)
  const payload = verifyToken(token)

  if (!payload) {
    throw createError({ statusCode: 401, statusMessage: '无效或过期的认证令牌' })
  }

  return payload
}

export function requireRole(event: H3Event<EventHandlerRequest>, ...roles: string[]): JWTPayload {
  const user = getUserFromEvent(event)

  if (!roles.includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: '权限不足' })
  }

  return user
}
