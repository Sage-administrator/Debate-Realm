/**
 * 全局身份认证中间件
 *
 * 职责：提取 JWT、校验 tokenVersion，将用户信息注入 event.context.user。
 * 不强制认证（不抛 401），只设置 context.user = JWTPayload | null。
 * 权限判断由各 handler 自行根据 context.user 决定。
 *
 * 跳过的路径（无需认证）：
 * - 登录相关 API (/api/auth/login, /api/auth/confirm-login)
 * - 公开赛事 API (/api/tournaments/public.list, /api/tournaments/{id}/public)
 * - 公开报名配置 (/api/tournaments/{id}/registration-config)
 * - 内部 API (/api/internal/*) — 使用 INTERNAL_API_KEY
 * - 定时发布调度 (/api/scheduled-posts/dispatch-due, /api/scheduled-posts/publish) — 使用 apiToken
 */

import { defineEventHandler, getRequestURL, getHeader, getCookie } from 'h3'
import { verifyToken } from '../lib/jwt'
import type { JWTPayload } from '../lib/jwt'
import { prisma } from '../lib/prisma'

const TOKEN_COOKIE = 'auth_token'

// 无需认证（或使用其他认证方式）的路径前缀
const PUBLIC_PREFIXES = [
  '/api/auth/login',
  '/api/auth/confirm-login',
  '/api/auth/register',
  '/api/tournaments/public.list',
  '/api/internal/',
  '/api/scheduled-posts/dispatch-due',
  '/api/scheduled-posts/publish',
  '/api/scheduled-posts/',
  '/_nuxt/',
  '/api/_nuxt_icon/',
  '/__nuxt_devtools__/',
]

function isPublicPath(path: string): boolean {
  // 精确匹配 /api/tournaments/*/public 和 /api/tournaments/*/registration-config
  if (/^\/api\/tournaments\/[^/]+\/(public|registration-config)/.test(path)) return true
  return PUBLIC_PREFIXES.some(p => path.startsWith(p))
}

function extractToken(headers: Headers, cookies: Record<string, string> | undefined): string | null {
  const authHeader = headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) return authHeader.substring(7)
  if (cookies?.[TOKEN_COOKIE]) return cookies[TOKEN_COOKIE]
  return null
}

export default defineEventHandler(async (event) => {
  // 公网路径直接跳过，避免无意义的 JWT 解析和 DB 查询
  const path = getRequestURL(event, { xForwardedHost: true }).pathname
  if (isPublicPath(path)) return

  try {
    const token = extractToken(event.headers, event.context.cookies)
    if (!token) return // 无 token，设 null，由 handler 自行判断

    const payload = verifyToken(token)
    if (!payload) return // token 无效

    // 校验 tokenVersion 是否与数据库一致（单设备登录 / 踢下线检测）
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { tokenVersion: true },
    })
    if (!user || user.tokenVersion !== payload.tokenVersion) return // 已下线，放过由 handler 处理

    event.context.user = payload as JWTPayload & Record<string, unknown>
  } catch {
    // 认证失败不抛错，保持 context.user 为 undefined/null
  }
})
