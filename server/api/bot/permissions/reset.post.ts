// ════════════════════════════════════════════════════
// POST /api/bot/permissions/reset — 重置所有身份组发言权限
// 请求体：{ channelId }
// ════════════════════════════════════════════════════
import { prisma } from '../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../utils/auth'
import { getBotInstance } from '../../../lib/bot-ws'
import { resetAllSpeakPermissions } from '../../../lib/bot-permissions'

export default defineEventHandler(async (event) => {
  try {
    // 修复：使用 getUserFromEventWithSession 校验 tokenVersion
    const currentUser = await getUserFromEventWithSession(event, prisma)

    if (currentUser.role !== 'admin' && currentUser.role !== 'system_admin') {
      throw createError({ statusCode: 403, message: '仅团队管理员可重置权限' })
    }

    const teamId = currentUser.teamId
    if (!teamId) {
      throw createError({ statusCode: 400, message: '用户不属于任何团队' })
    }

    const body = await readBody(event)
    const { channelId } = body

    if (!channelId) {
      throw createError({ statusCode: 400, message: '缺少 channelId 参数' })
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { mode: true },
    })

    if (!team || team.mode !== 'qq_bot') {
      throw createError({ statusCode: 400, message: '仅 QQ 频道模式团队可使用' })
    }

    const botInstance = getBotInstance(teamId)
    if (!botInstance || !botInstance.config) {
      throw createError({ statusCode: 400, message: 'Bot 未启动，请先连接 Bot' })
    }

    const result = await resetAllSpeakPermissions(
      prisma,
      botInstance.config,
      teamId,
      '',
      channelId,
      currentUser.username || 'admin',
    )

    if (!result.success) {
      throw createError({ statusCode: 400, message: result.message })
    }

    return result
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Reset Permissions] 重置失败:', error)
    throw createError({ statusCode: 500, message: '重置权限失败' })
  }
})