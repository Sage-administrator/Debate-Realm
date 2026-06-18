// POST /api/bot/connect — 重新连接 Bot WebSocket
import { prisma } from '../../lib/prisma'
import { getUserFromEvent } from '../../utils/auth'
import { connectBot } from '../../lib/bot-ws'

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
      select: { name: true, mode: true, botAppId: true, botAppSecret: true, botChannelId: true },
    })

    if (!team || team.mode !== 'qq_bot') {
      throw createError({ statusCode: 400, statusMessage: '仅 QQ 频道模式团队可使用机器人功能' })
    }

    if (!team.botAppId || !team.botAppSecret) {
      throw createError({ statusCode: 400, statusMessage: 'Bot 未配置，请先完成配置' })
    }

    connectBot(teamId, team.botAppId, team.botAppSecret, team.name, team.botChannelId)
    return { success: true, message: 'Bot 正在重新连接...' }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Bot Connect] 重连失败:', error)
    throw createError({ statusCode: 500, statusMessage: 'Bot 重新连接失败' })
  }
})
