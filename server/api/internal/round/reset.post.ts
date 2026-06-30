// ════════════════════════════════════════════════════
// POST /api/internal/round/reset — 重置所有发言权限（取消环节限制）
// 由计时程序调用
// 请求体：{ teamId, guildId, channelId, internalKey }
// ════════════════════════════════════════════════════
import { prisma } from '../../../lib/prisma'
import { getBotInstance } from '../../../lib/bot-ws'
import { resetAllSpeakPermissions } from '../../../lib/bot-permissions'
import { verifyInternalKey } from '../../../utils/internal-auth'

export default defineEventHandler(async (event) => {
  try {
    await verifyInternalKey(event)
    const body = await readBody(event)
    const { teamId, guildId, channelId } = body

    if (!teamId || !guildId || !channelId) {
      throw createError({ statusCode: 400, statusMessage: '缺少必要参数：teamId、guildId、channelId' })
    }

    // 获取 Bot 实例
    const botInstance = getBotInstance(teamId)
    if (!botInstance || !botInstance.config) {
      throw createError({ statusCode: 400, statusMessage: 'Bot 未启动，请先连接 Bot' })
    }

    const result = await resetAllSpeakPermissions(
      prisma,
      botInstance.config,
      teamId,
      guildId,
      channelId,
      'timer_system',
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
    console.error('[Internal Round Reset] 重置失败:', error)
    throw createError({ statusCode: 500, statusMessage: '重置发言权限失败' })
  }
})