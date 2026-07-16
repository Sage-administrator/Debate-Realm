// ════════════════════════════════════════════════════
// GET /api/bot/channels/:guildId/subchannels — 获取指定服务器（频道）下的子频道列表
// 功能：
//   1. 校验用户权限（仅团队管理员/system_admin可访问）
//   2. 调用 fetchBotChannels(teamId, guildId) → 内部调用 QQ API /guilds/{guild_id}/channels
//   3. 返回 { channels: [{ id, name, type?, subType?, parentId? }], error?: string }
// 用途：
//   - 测试消息级联选择器的第二级：选定服务器后，遍历该服务器下的子频道
// 权限：role === 'admin' 或 role === 'system_admin'
// ════════════════════════════════════════════════════
import { prisma } from '../../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../../utils/auth'
import { fetchBotChannels } from '../../../../lib/bot-ws'

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
      select: { mode: true, botAppId: true },
    })

    if (!team || team.mode !== 'qq_bot') {
      throw createError({ statusCode: 400, message: '仅 QQ 频道模式团队可使用机器人功能' })
    }

    if (!team.botAppId) {
      throw createError({ statusCode: 400, message: 'Bot 未配置' })
    }

    const guildId = getRouterParam(event, 'guildId')
    if (!guildId) {
      throw createError({ statusCode: 400, message: '缺少 guildId 参数' })
    }

    const result = await fetchBotChannels(teamId, guildId)
    return result
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Bot SubChannels] 获取子频道列表失败:', error)
    throw createError({ statusCode: 500, message: '获取子频道列表失败' })
  }
})
