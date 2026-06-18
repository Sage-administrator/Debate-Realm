// POST /api/bot/disconnect — 断开 Bot WebSocket 连接（保留配置）
import { prisma } from '../../lib/prisma'
import { getUserFromEvent } from '../../utils/auth'
import { disconnectBot } from '../../lib/bot-ws'

export default defineEventHandler(async (event) => {
  try {
    const currentUser = getUserFromEvent(event)

    if (currentUser.role !== 'admin' && currentUser.role !== 'system_admin') {
      throw createError({ statusCode: 403, statusMessage: '权限不足' })
    }

    const teamId = currentUser.teamId
    if (!teamId) {
      throw createError({ statusCode: 400, statusMessage: '用户不属于任何团队' })
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { mode: true },
    })

    if (!team || team.mode !== 'qq_bot') {
      throw createError({ statusCode: 400, statusMessage: '仅 QQ 频道模式团队可使用机器人功能' })
    }

    disconnectBot(teamId)
    return { success: true, message: 'Bot 连接已断开' }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Bot Disconnect] 断连失败:', error)
    throw createError({ statusCode: 500, statusMessage: '断开 Bot 连接失败' })
  }
})
