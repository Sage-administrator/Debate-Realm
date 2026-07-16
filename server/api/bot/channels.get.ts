// ════════════════════════════════════════════════════
// GET /api/bot/channels — 获取 Bot 所在的频道/服务器列表
// 功能：
//   1. 校验用户权限（仅团队管理员/system_admin可访问）
//   2. 调用 fetchBotGuilds(teamId) → 内部调用 QQ API /users/@me/guilds
//   3. 返回 { guilds: [{ id, name, ownerId?, joinedAt? }], error?: string }
// 用途：
//   - 让管理员查看 Bot 当前加入了哪些频道/服务器
//   - 协助配置默认的消息发送频道（频道 ID）
// 权限：role === 'admin' 或 role === 'system_admin'
// ════════════════════════════════════════════════════
import { prisma } from '../../lib/prisma'
import { getUserFromEventWithSession } from '../../utils/auth'
import { fetchBotGuilds } from '../../lib/bot-ws'

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

    // 调用 QQ Bot API 获取频道列表
    const result = await fetchBotGuilds(teamId)
    return result
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Bot Channels] 获取频道列表失败:', error)
    throw createError({ statusCode: 500, message: '获取频道列表失败' })
  }
})
