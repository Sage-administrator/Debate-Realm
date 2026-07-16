// ════════════════════════════════════════════════════
// GET /api/bot/status — 获取 Bot 运行时状态（轻量 HTTP 快照）
// 替代首页「为读一次状态而开 WebSocket」的低效模式：
//   首页仪表盘只需一次状态快照，用 HTTP GET 即可，无需建立 WS 连接再关闭。
// 数据源与 WS 的 pushStatus 完全一致（readBotRuntimeStatus），
// 且为纯查询——读状态不会自动拉起 Bot。
// 权限：role === 'admin' 或 'system_admin' 且团队为 qq_bot 模式
// ════════════════════════════════════════════════════
import { prisma } from '../../lib/prisma'
import { getUserFromEventWithSession } from '../../utils/auth'
import { readBotRuntimeStatus } from '../../lib/bot-ws'

export default defineEventHandler(async (event) => {
  try {
    const currentUser = await getUserFromEventWithSession(event, prisma)

    if (currentUser.role !== 'admin' && currentUser.role !== 'system_admin') {
      throw createError({ statusCode: 403, message: '权限不足' })
    }

    const teamId = currentUser.teamId
    if (!teamId) {
      throw createError({ statusCode: 400, message: '用户不属于任何团队' })
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        name: true,
        mode: true,
        botAppId: true,
        botAppSecret: true,
        botChannelId: true,
        botIsPrivate: true,
      },
    })

    if (!team || team.mode !== 'qq_bot') {
      throw createError({ statusCode: 400, message: '仅 QQ 频道模式团队可使用机器人功能' })
    }

    // 复用与 WS pushStatus 相同的数据源，保证状态口径一致（纯查询，不自动启动 Bot）
    return readBotRuntimeStatus(teamId, {
      name: team.name,
      mode: team.mode,
      botAppId: team.botAppId,
      botAppSecret: team.botAppSecret,
      botChannelId: team.botChannelId,
      botIsPrivate: team.botIsPrivate,
    })
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Bot Status] 获取 Bot 状态失败:', error)
    throw createError({ statusCode: 500, message: '获取 Bot 状态失败' })
  }
})
