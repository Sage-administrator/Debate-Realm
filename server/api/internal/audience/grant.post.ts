// ════════════════════════════════════════════════════
// POST /api/internal/audience/grant — 授权观众临时发言
// 由计时程序或管理员调用
// 请求体：{ teamId, guildId, channelId, userId, username, durationMs?, internalKey }
// ════════════════════════════════════════════════════
import { prisma } from '../../../lib/prisma'
import { getBotInstance } from '../../../lib/bot-ws'
import { grantAudienceSpeak } from '../../../lib/bot-permissions'
import { verifyInternalKey } from '../../../utils/internal-auth'

export default defineEventHandler(async (event) => {
  try {
    await verifyInternalKey(event)
    const body = await readBody(event)
    const { teamId, guildId, channelId, userId, username, durationMs } = body

    if (!teamId || !guildId || !channelId || !userId) {
      throw createError({ statusCode: 400, statusMessage: '缺少必要参数：teamId、guildId、channelId、userId' })
    }

    if (!username) {
      throw createError({ statusCode: 400, statusMessage: '缺少 username 参数' })
    }

    // 获取 Bot 实例
    const botInstance = getBotInstance(teamId)
    if (!botInstance || !botInstance.config) {
      throw createError({ statusCode: 400, statusMessage: 'Bot 未启动，请先连接 Bot' })
    }

    // 授权临时发言
    const result = await grantAudienceSpeak(
      prisma,
      botInstance.config,
      teamId,
      guildId,
      channelId,
      userId,
      username,
      'timer_system',
      durationMs || 5 * 60 * 1000, // 默认 5 分钟
    )

    if (!result.success) {
      throw createError({ statusCode: 400, statusMessage: result.message })
    }

    return {
      success: true,
      message: result.message,
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Internal Audience Grant] 授权失败:', error)
    throw createError({ statusCode: 500, statusMessage: '观众临时发言授权失败' })
  }
})