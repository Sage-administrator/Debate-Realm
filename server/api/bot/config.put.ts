// ════════════════════════════════════════════════════
// PUT /api/bot/config — 更新机器人配置（保存后自动启动/重启 Bot）
// 请求体：{
//   botAppId?: string | null,      // QQ 机器人 AppID（可为空以清除凭证）
//   botAppSecret?: string | null,  // QQ 机器人 AppSecret（可为空以清除凭证）
//   botChannelId?: string | null   // 默认消息发送频道/群 ID（可选）
// }
// 功能：
//   1. 校验用户权限（仅团队管理员/system_admin可操作）
//   2. 更新数据库 Team 表中的 Bot 配置字段
//   3. 智能更新内存实例：
//      - 仅更新 channelId：直接修改内存实例 config，不重启连接
//      - 更新凭证（AppId/AppSecret）：stopBotInstance() 清除旧实例 + createBotInstance() 创建新实例
//      - 清除凭证（传空）：停止并删除现有 Bot 实例
//   4. 返回脱敏后的配置摘要（AppID 前6位 + **** + 后4位）
// 权限：role === 'admin' 或 role === 'system_admin'
// ════════════════════════════════════════════════════
import { readBody } from 'h3'
import { prisma } from '../../lib/prisma'
import { getUserFromEventWithSession } from '../../utils/auth'
import { createBotInstance, stopBotInstance, getBotInstance, resolveIntents } from '../../lib/bot-ws'

export default defineEventHandler(async (event) => {
  try {
    const currentUser = await getUserFromEventWithSession(event, prisma)

    // 仅团队管理员可修改
    if (currentUser.role !== 'admin' && currentUser.role !== 'system_admin') {
      throw createError({ statusCode: 403, message: '权限不足' })
    }

    const teamId = currentUser.teamId
    if (!teamId) {
      throw createError({ statusCode: 400, message: '用户不属于任何团队' })
    }

    const body = await readBody<{
      botAppId?: string | null
      botAppSecret?: string | null
      botChannelId?: string | null
      botIsPrivate?: boolean
    }>(event)

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true, name: true, mode: true,
        botAppId: true, botAppSecret: true, botChannelId: true,
        botIsPrivate: true,
      },
    })

    if (!team) {
      throw createError({ statusCode: 404, message: '团队不存在' })
    }

    // 仅 QQ 频道模式团队可使用机器人功能
    if (team.mode !== 'qq_bot') {
      throw createError({ statusCode: 400, message: '仅 QQ 频道模式团队可使用机器人功能' })
    }

    // 更新团队 Bot 配置（允许传入 null/空串以清除）
    const updateData: Record<string, string | null | boolean> = {}
    if (body.botAppId !== undefined) updateData.botAppId = body.botAppId || null
    if (body.botAppSecret !== undefined) updateData.botAppSecret = body.botAppSecret || null
    if (body.botChannelId !== undefined) updateData.botChannelId = body.botChannelId || null
    if (body.botIsPrivate !== undefined) updateData.botIsPrivate = body.botIsPrivate
    const updated = await prisma.team.update({
      where: { id: teamId },
      data: updateData,
      select: {
        id: true, name: true, mode: true,
        botAppId: true, botAppSecret: true, botChannelId: true,
        botIsPrivate: true,
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
          isPrivate: updated.botIsPrivate ?? false,
          intents: resolveIntents(updated.botIsPrivate ?? false),
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
      message: '更新机器人配置失败',
    })
  }
})
