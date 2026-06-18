// GET /api/bot/channels — 获取 Bot 所在频道/服务器列表
import { prisma } from '../../lib/prisma'
import { getUserFromEvent } from '../../utils/auth'
import { fetchBotGuilds } from '../../lib/bot-ws'

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
      select: { mode: true, botAppId: true },
    })

    if (!team || team.mode !== 'qq_bot') {
      throw createError({ statusCode: 400, statusMessage: '仅 QQ 频道模式团队可使用机器人功能' })
    }

    if (!team.botAppId) {
      throw createError({ statusCode: 400, statusMessage: 'Bot 未配置' })
    }

    // 调用 QQ Bot API 获取频道列表
    const result = await fetchBotGuilds(teamId)
    return result
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Bot Channels] 获取频道列表失败:', error)
    throw createError({ statusCode: 500, statusMessage: '获取频道列表失败' })
  }
})
