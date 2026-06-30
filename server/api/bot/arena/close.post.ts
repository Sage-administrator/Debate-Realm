// ════════════════════════════════════════════════════
// POST /api/bot/arena/close — 关闭当前子频道的赛场
// 请求体：{ channelId: "子频道ID（必填）", guildId?: "频道ID（仅用于 QQ API）" }
// ════════════════════════════════════════════════════
import { prisma } from '../../../lib/prisma'
import { getUserFromEvent } from '../../../utils/auth'
import { getBotInstance } from '../../../lib/bot-ws'
import { closeArena } from '../../../lib/bot-roles'

export default defineEventHandler(async (event) => {
  try {
    const currentUser = getUserFromEvent(event)

    if (currentUser.role !== 'admin' && currentUser.role !== 'system_admin') {
      throw createError({ statusCode: 403, statusMessage: '仅团队管理员可关闭赛场' })
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
      throw createError({ statusCode: 400, statusMessage: '仅 QQ 频道模式团队可关闭赛场' })
    }

    const body = await readBody(event)
    const channelId = body.channelId || '' // 子频道 ID（赛场主阵地）
    const guildId = body.guildId || ''      // 频道 ID（仅用于 QQ API）

    if (!channelId) {
      throw createError({ statusCode: 400, statusMessage: '请提供子频道 ID（channelId）' })
    }

    const botInstance = getBotInstance(teamId)
    if (!botInstance || !botInstance.config) {
      throw createError({ statusCode: 400, statusMessage: 'Bot 未启动，请先连接 Bot' })
    }

    const result = await closeArena(prisma, botInstance.config, channelId, guildId, teamId)

    if (!result.success) {
      throw createError({ statusCode: 400, statusMessage: result.message })
    }

    return result
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Arena Close] 关闭赛场失败:', error)
    throw createError({ statusCode: 500, statusMessage: '关闭赛场失败' })
  }
})