// POST /api/bot/send — 发送机器人测试消息
import { readBody } from 'h3'
import { prisma } from '../../lib/prisma'
import { getUserFromEvent } from '../../utils/auth'
import { sendChannelMessage, sendGroupMessage, sendPrivateMessage } from '../../lib/bot-http'

export default defineEventHandler(async (event) => {
  try {
    const currentUser = getUserFromEvent(event)

    // 仅团队管理员可操作
    if (currentUser.role !== 'admin' && currentUser.role !== 'system_admin') {
      throw createError({ statusCode: 403, statusMessage: '权限不足' })
    }

    const teamId = currentUser.teamId
    if (!teamId) {
      throw createError({ statusCode: 400, statusMessage: '用户不属于任何团队' })
    }

    const body = await readBody<{
      targetId: string
      content: string
      messageType?: 'channel' | 'group' | 'private'
    }>(event)

    // 校验参数
    if (!body.targetId || !body.targetId.trim()) {
      throw createError({ statusCode: 400, statusMessage: '目标 ID（频道/群/用户）不能为空' })
    }
    if (!body.content || !body.content.trim()) {
      throw createError({ statusCode: 400, statusMessage: '消息内容不能为空' })
    }

    const messageType = body.messageType || 'channel'

    // 获取团队 Bot 配置
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { mode: true, botAppId: true, botAppSecret: true },
    })

    // 仅 QQ 频道模式团队可使用机器人功能
    if (!team || team.mode !== 'qq_bot') {
      throw createError({
        statusCode: 400,
        statusMessage: '仅 QQ 频道模式团队可使用机器人功能',
      })
    }

    if (!team.botAppId || !team.botAppSecret) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bot 未配置，请先在机器人管理中填写 App ID 和 App Secret',
      })
    }

    const credentials = {
      appId: team.botAppId,
      appSecret: team.botAppSecret,
    }

    // 根据消息类型发送
    let result: unknown
    switch (messageType) {
      case 'group':
        result = await sendGroupMessage(credentials, body.targetId.trim(), body.content.trim())
        break
      case 'private':
        result = await sendPrivateMessage(credentials, body.targetId.trim(), body.content.trim())
        break
      case 'channel':
      default:
        result = await sendChannelMessage(credentials, body.targetId.trim(), body.content.trim())
        break
    }

    return {
      success: true,
      message: '消息发送成功',
      result,
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Bot Send] 发送消息失败:', error)
    const msg = error instanceof Error ? error.message : '发送消息失败'
    throw createError({ statusCode: 500, statusMessage: msg })
  }
})
