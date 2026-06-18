// GET /api/bot/status — 获取机器人运行状态与配置信息（含 WS 实时状态）
import { prisma } from '../../lib/prisma'
import { getUserFromEvent } from '../../utils/auth'
import { getBotRuntimeStatus } from '../../lib/bot-ws'

export default defineEventHandler(async (event) => {
  try {
    const currentUser = getUserFromEvent(event)

    // 仅团队管理员可查看
    if (currentUser.role !== 'admin' && currentUser.role !== 'system_admin') {
      throw createError({ statusCode: 403, statusMessage: '权限不足' })
    }

    const teamId = currentUser.teamId
    if (!teamId) {
      throw createError({ statusCode: 400, statusMessage: '用户不属于任何团队' })
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        mode: true,
        botAppId: true,
        botAppSecret: true,
        botChannelId: true,
      },
    })

    if (!team) {
      throw createError({ statusCode: 404, statusMessage: '团队不存在' })
    }

    // 仅 QQ 频道模式团队可使用机器人功能
    if (team.mode !== 'qq_bot') {
      throw createError({ statusCode: 400, statusMessage: '仅 QQ 频道模式团队可使用机器人功能' })
    }

    // 合并数据库配置 + WS 运行时状态
    const runtimeStatus = getBotRuntimeStatus(teamId, {
      name: team.name,
      mode: team.mode,
      botAppId: team.botAppId,
      botChannelId: team.botChannelId,
    })

    return runtimeStatus
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Bot Status] 获取状态失败:', error)
    throw createError({ statusCode: 500, statusMessage: '获取机器人状态失败' })
  }
})
