// ════════════════════════════════════════════════════
// POST /api/bot/arena/create — 创建赛场（在 QQ 频道中创建身份组）
// 请求体：{ name: "赛场名", matchFormat: "4v4", channelId: "子频道ID（必填）", guildId?: "频道ID" }
// 注意：channelId 是赛场主阵地，guildId 仅用于 QQ API 调用（创建身份组需要）
// ════════════════════════════════════════════════════
import { prisma } from '../../../lib/prisma'
import { getUserFromEvent } from '../../../utils/auth'
import { getBotInstance } from '../../../lib/bot-ws'
import { createArena, getNextArenaLetter } from '../../../lib/bot-roles'

export default defineEventHandler(async (event) => {
  try {
    const currentUser = getUserFromEvent(event)

    if (currentUser.role !== 'admin' && currentUser.role !== 'system_admin') {
      throw createError({ statusCode: 403, statusMessage: '仅团队管理员可创建赛场' })
    }

    const teamId = currentUser.teamId
    if (!teamId) {
      throw createError({ statusCode: 400, statusMessage: '用户不属于任何团队' })
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { mode: true, botAppId: true, botAppSecret: true, botChannelId: true },
    })

    if (!team || team.mode !== 'qq_bot') {
      throw createError({ statusCode: 400, statusMessage: '仅 QQ 频道模式团队可创建赛场' })
    }

    const body = await readBody(event)
    let arenaName = body.name || ''
    const matchFormat = body.matchFormat || '4v4'
    const channelId = body.channelId || '' // 子频道 ID（赛场主阵地，必填）
    const guildId = body.guildId || ''      // 频道 ID（仅用于 QQ API）

    // 没传 name 或 name 为空 → 自动按字母序号命名：赛场A、赛场B、赛场C...
    if (!arenaName || !arenaName.trim()) {
      const letter = await getNextArenaLetter(prisma, teamId)
      arenaName = `赛场${letter}`
    }

    if (!channelId) {
      throw createError({ statusCode: 400, statusMessage: '请提供子频道 ID（channelId），子频道是赛场主阵地' })
    }

    if (!['4v4', '3v3', '2v2'].includes(matchFormat)) {
      throw createError({ statusCode: 400, statusMessage: '不支持的比赛形式，可选：4v4、3v3、2v2' })
    }

    // 获取 Bot 实例的配置
    const botInstance = getBotInstance(teamId)
    if (!botInstance || !botInstance.config) {
      throw createError({ statusCode: 400, statusMessage: 'Bot 未启动，请先连接 Bot' })
    }

    const result = await createArena(prisma, botInstance.config, teamId, matchFormat, guildId, arenaName, channelId)

    if (!result.success) {
      throw createError({ statusCode: 400, statusMessage: result.message })
    }

    return result
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Arena Create] 创建赛场失败:', error)
    throw createError({ statusCode: 500, statusMessage: '创建赛场失败' })
  }
})