// ════════════════════════════════════════════════════
// POST /api/bot/arena/unclaim — 通过 HTTP 取消认领（管理员操作）
// 请求体：{ arenaId, userId, roleId? }
// ════════════════════════════════════════════════════
import { prisma } from '../../../lib/prisma'
import { getUserFromEvent } from '../../../utils/auth'
import { getBotInstance } from '../../../lib/bot-ws'

export default defineEventHandler(async (event) => {
  try {
    const currentUser = getUserFromEvent(event)

    if (currentUser.role !== 'admin' && currentUser.role !== 'system_admin') {
      throw createError({ statusCode: 403, statusMessage: '仅团队管理员可操作认领' })
    }

    const body = await readBody(event)
    const { arenaId, userId, roleId } = body

    if (!arenaId || !userId) {
      throw createError({ statusCode: 400, statusMessage: '缺少必要参数：arenaId、userId' })
    }

    // 查找认领记录
    const where: any = { arenaId, userId }
    if (roleId) {
      where.roleId = roleId
    }

    const claim = await prisma.botArenaClaim.findFirst({
      where,
      include: {
        role: {
          select: { label: true, qqRoleId: true },
        },
      },
    })

    if (!claim) {
      throw createError({ statusCode: 404, statusMessage: '未找到该用户的认领记录' })
    }

    const arena = await prisma.botArena.findUnique({
      where: { id: arenaId },
      select: { teamId: true, guildId: true },
    })

    // 删除认领记录
    await prisma.botArenaClaim.delete({ where: { id: claim.id } })

    // 尝试通过 QQ API 移除身份组
    if (arena?.guildId && claim.role.qqRoleId) {
      const botInstance = getBotInstance(arena.teamId)
      if (botInstance && botInstance.status === 'connected') {
        try {
          const { callBotApi } = await import('../../../lib/bot-ws')
          await callBotApi(
            botInstance.config,
            `/guilds/${arena.guildId}/members/${userId}/roles/${claim.role.qqRoleId}`,
            'DELETE',
          )
          console.log(`[Arena Unclaim] 已通过 QQ API 为 ${userId} 移除身份组 ${claim.role.label}`)
        } catch (err) {
          console.error(`[Arena Unclaim] QQ API 移除身份组失败（认领记录已删除）:`, err)
        }
      }
    }

    return {
      success: true,
      message: `已取消用户认领的身份「${claim.role.label}」`,
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Arena Unclaim] 取消认领失败:', error)
    throw createError({ statusCode: 500, statusMessage: '取消认领操作失败' })
  }
})