// ════════════════════════════════════════════════════
// POST /api/bot/unbind — 解绑 Bot（清除数据库配置 + 删除内存实例）
// 功能：
//   1. 校验用户权限（仅团队管理员/system_admin可操作）
//   2. 调用 stopBotInstance(teamId) 关闭 WebSocket 连接并删除实例记录
//   3. 更新数据库 Team 表：将 botAppId/botAppSecret/botChannelId 全部设为 null
// 与 /disconnect 的区别：/disconnect 仅断连保留配置，/unbind 彻底清除配置
// 场景：团队不再使用 Bot 功能、更换新的 Bot 账号等
// 权限：role === 'admin' 或 role === 'system_admin'
// ════════════════════════════════════════════════════
import { prisma } from '../../lib/prisma'
import { getUserFromEventWithSession } from '../../utils/auth'
import { stopBotInstance } from '../../lib/bot-ws'

export default defineEventHandler(async (event) => {
  try {
    // 修复：使用 getUserFromEventWithSession 校验 tokenVersion
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
      select: { mode: true },
    })

    if (!team || team.mode !== 'qq_bot') {
      throw createError({ statusCode: 400, message: '仅 QQ 频道模式团队可使用机器人功能' })
    }

    // 1. 断开 WebSocket 并删除实例
    stopBotInstance(teamId)

    // 2. 清除数据库中的 Bot 配置
    await prisma.team.update({
      where: { id: teamId },
      data: {
        botAppId: null,
        botAppSecret: null,
        botChannelId: null,
      },
    })

    return { success: true, message: 'Bot 已解绑，配置和连接已全部清除' }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Bot Unbind] 解绑失败:', error)
    throw createError({ statusCode: 500, message: '解绑 Bot 失败' })
  }
})
