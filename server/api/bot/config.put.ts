// PUT /api/bot/config — 更新机器人配置（App ID / Secret / 频道 ID），保存后自动启动/重启 Bot
import { readBody } from 'h3'
import { prisma } from '../../lib/prisma'
import { getUserFromEvent } from '../../utils/auth'
import { createBotInstance, stopBotInstance, getBotInstance } from '../../lib/bot-ws'

export default defineEventHandler(async (event) => {
  try {
    const currentUser = getUserFromEvent(event)

    // 仅团队管理员可修改
    if (currentUser.role !== 'admin' && currentUser.role !== 'system_admin') {
      throw createError({ statusCode: 403, statusMessage: '权限不足' })
    }

    const teamId = currentUser.teamId
    if (!teamId) {
      throw createError({ statusCode: 400, statusMessage: '用户不属于任何团队' })
    }

    const body = await readBody<{
      botAppId?: string | null
      botAppSecret?: string | null
      botChannelId?: string | null
    }>(event)

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true, name: true, mode: true,
        botAppId: true, botAppSecret: true, botChannelId: true,
      },
    })

    if (!team) {
      throw createError({ statusCode: 404, statusMessage: '团队不存在' })
    }

    // 仅 QQ 频道模式团队可使用机器人功能
    if (team.mode !== 'qq_bot') {
      throw createError({ statusCode: 400, statusMessage: '仅 QQ 频道模式团队可使用机器人功能' })
    }

    // 更新团队 Bot 配置（允许传入 null/空串以清除）
    const updateData: Record<string, string | null> = {}
    if (body.botAppId !== undefined) updateData.botAppId = body.botAppId || null
    if (body.botAppSecret !== undefined) updateData.botAppSecret = body.botAppSecret || null
    if (body.botChannelId !== undefined) updateData.botChannelId = body.botChannelId || null
    const updated = await prisma.team.update({
      where: { id: teamId },
      data: updateData,
      select: {
        id: true, name: true, mode: true,
        botAppId: true, botAppSecret: true, botChannelId: true,
      },
    })

    // 判断是否要操作 Bot 实例
    const isUpdatingCredentials = body.botAppId !== undefined || body.botAppSecret !== undefined
    const isOnlyChannel = !isUpdatingCredentials && body.botChannelId !== undefined
    let resultMessage = ''

    if (isOnlyChannel) {
      // 仅更新频道 ID：不重启 Bot，只更新内存中实例的 channelId
      const instance = getBotInstance(teamId)
      if (instance) {
        instance.config.channelId = updated.botChannelId
      }
      resultMessage = '默认频道已更新'
      console.log(`[Bot Config] 已更新团队「${updated.name}」的默认频道为 ${updated.botChannelId}`)
    } else {
      // 更新凭证：停止旧实例后重建
      const newAppId = updateData.botAppId ?? team.botAppId
      const newAppSecret = updateData.botAppSecret ?? team.botAppSecret
      const hasCredentials = !!(newAppId && newAppSecret)

      stopBotInstance(teamId)

      if (hasCredentials) {
        createBotInstance({
          appId: newAppId!,
          appSecret: newAppSecret!,
          teamId: updated.id,
          teamName: updated.name,
          channelId: updated.botChannelId,
          intents: ['PUBLIC_GUILD_MESSAGES', 'GROUP_AND_C2C_EVENT'],
        })
        resultMessage = 'Bot 配置已保存并启动'
        console.log(`[Bot Config] 已为团队「${updated.name}」重启 Bot 实例`)
      } else {
        resultMessage = 'Bot 配置已清除'
        console.log(`[Bot Config] 已停止团队「${updated.name}」的 Bot 实例`)
      }
    }

    return {
      success: true,
      message: resultMessage,
      config: {
        appId: updated.botAppId
          ? updated.botAppId.slice(0, 6) + '****' + updated.botAppId.slice(-4)
          : null,
        channelId: updated.botChannelId,
      },
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Bot Config] 更新配置失败:', error)
    throw createError({
      statusCode: 500,
      statusMessage: '更新机器人配置失败',
    })
  }
})
