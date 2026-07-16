// POST /api/team/api-token — 生成/重置团队服务令牌（管理员专属）
// 鉴权：用户会话令牌 + admin/system_admin 角色。仅此一次返回明文令牌。
import { randomUUID } from 'node:crypto'
import { prisma } from '../../lib/prisma'
import { getUserFromEventWithSession, requireRole } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const user = await getUserFromEventWithSession(event, prisma)
    requireRole(event, 'admin', 'system_admin')

    const teamId = user.teamId
    if (!teamId) throw createError({ statusCode: 400, message: '用户不属于任何团队' })

    const token = randomUUID()
    await prisma.team.update({
      where: { id: teamId },
      data: { apiToken: token },
    })

    // 明文令牌只在此返回一次，后续无法从接口再次读出（字段不开放查询）
    return { apiToken: token }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Team] 生成服务令牌失败:', error)
    throw createError({ statusCode: 500, message: '生成服务令牌失败' })
  }
})
