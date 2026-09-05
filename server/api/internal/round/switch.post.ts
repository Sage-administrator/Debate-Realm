// ════════════════════════════════════════════════════
// POST /api/internal/round/switch — 环节切换时自动调整频道发言权限
// 由计时程序调用，不需要前端用户认证
// 请求体：{ teamId, guildId, channelId, targetSide, internalKey }
// targetSide: 'affirmative' | 'negative' | 'judge' | 'audience'
// ════════════════════════════════════════════════════
import { prisma } from '../../../lib/prisma'
import { getBotInstance } from '../../../lib/bot-ws'
import { switchRoundWhitelist } from '../../../lib/bot-permissions'
import { verifyInternalKey } from '../../../utils/internal-auth'

export default defineEventHandler(async (event) => {
  try {
    await verifyInternalKey(event)
    const body = await readBody(event)
    const { teamId, guildId, channelId, targetSide } = body

    if (!teamId || !guildId || !channelId) {
      throw createError({ statusCode: 400, message: '缺少必要参数：teamId、guildId、channelId' })
    }

    const validSides = ['affirmative', 'negative', 'judge', 'audience']
    if (!targetSide || !validSides.includes(targetSide)) {
      throw createError({
        statusCode: 400,
        message: `无效的 targetSide，可选：${validSides.join('、')}`,
      })
    }

    // 获取 Bot 实例
    const botInstance = getBotInstance(teamId)
    if (!botInstance || !botInstance.config) {
      throw createError({ statusCode: 400, message: 'Bot 未启动，请先连接 Bot' })
    }

    // 执行环节权限切换
    const result = await switchRoundWhitelist(
      prisma,
      botInstance.config,
      teamId,
      guildId,
      channelId,
      targetSide,
      'timer_system', // 操作者：计时系统
    )

    if (!result.success) {
      throw createError({ statusCode: 400, message: result.message })
    }

    return {
      success: true,
      message: result.message,
      allowed: result.allowed,
      denied: result.denied,
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Internal Round Switch] 环节切换失败:', error)
    throw createError({ statusCode: 500, message: '环节权限切换失败' })
  }
})
