// ════════════════════════════════════════════════════
// POST /api/bot/permissions/switch-round — 切换环节白名单
// 请求体：{ targetSide, channelId }
// targetSide 可选值：affirmative / negative / judge / audience
// ════════════════════════════════════════════════════
import { prisma } from '../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../utils/auth'
import { getBotInstance } from '../../../lib/bot-ws'
import { switchRoundWhitelist } from '../../../lib/bot-permissions'

export default defineEventHandler(async (event) => {
  try {
    // 修复：使用 getUserFromEventWithSession 校验 tokenVersion
    const currentUser = await getUserFromEventWithSession(event, prisma)

    if (currentUser.role !== 'admin' && currentUser.role !== 'system_admin') {
      throw createError({ statusCode: 403, statusMessage: '仅团队管理员可切换环节' })
    }

    const teamId = currentUser.teamId
    if (!teamId) {
      throw createError({ statusCode: 400, statusMessage: '用户不属于任何团队' })
    }

    const body = await readBody(event)
    const { targetSide, channelId } = body

    const validSides = ['affirmative', 'negative', 'judge', 'audience']
    if (!targetSide || !validSides.includes(targetSide)) {
      throw createError({ statusCode: 400, statusMessage: `targetSide 无效，可选：${validSides.join('、')}` })
    }

    if (!channelId) {
      throw createError({ statusCode: 400, statusMessage: '缺少 channelId 参数' })
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { mode: true },
    })

    if (!team || team.mode !== 'qq_bot') {
      throw createError({ statusCode: 400, statusMessage: '仅 QQ 频道模式团队可使用' })
    }

    const botInstance = getBotInstance(teamId)
    if (!botInstance || !botInstance.config) {
      throw createError({ statusCode: 400, statusMessage: 'Bot 未启动，请先连接 Bot' })
    }

    const result = await switchRoundWhitelist(
      prisma,
      botInstance.config,
      teamId,
      '', // guildId 由 channelId 推断
      channelId,
      targetSide,
      currentUser.username || 'admin',
    )

    if (!result.success) {
      throw createError({ statusCode: 400, statusMessage: result.message })
    }

    return result
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Switch Round] 切换失败:', error)
    throw createError({ statusCode: 500, statusMessage: '切换环节失败' })
  }
})