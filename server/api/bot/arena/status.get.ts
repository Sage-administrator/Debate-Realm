// ════════════════════════════════════════════════════
// GET /api/bot/arena/status — 获取赛场状态（可按 channelId 筛选，不传则返回团队所有活跃赛场）
// ════════════════════════════════════════════════════
import { prisma } from '../../../lib/prisma'
import { getUserFromEvent } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const currentUser = getUserFromEvent(event)

    if (currentUser.role !== 'admin' && currentUser.role !== 'system_admin') {
      throw createError({ statusCode: 403, statusMessage: '权限不足' })
    }

    const teamId = currentUser.teamId
    if (!teamId) {
      throw createError({ statusCode: 400, statusMessage: '用户不属于任何团队' })
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { mode: true },
    })

    if (!team || team.mode !== 'qq_bot') {
      throw createError({ statusCode: 400, statusMessage: '仅 QQ 频道模式团队可使用' })
    }

    const query = getQuery(event)
    const channelId = query.channelId as string | undefined

    // 按 channelId 筛选或返回团队所有活跃赛场
    const where: any = { teamId, status: 'active' }
    if (channelId) {
      where.channelId = channelId
    }

    const arenas = await prisma.botArena.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        roles: {
          orderBy: { orderIndex: 'asc' },
          include: { claims: true },
        },
      },
    })

    if (arenas.length === 0) {
      return { active: false, message: '当前没有活跃的赛场', arenas: [] }
    }

    return {
      active: true,
      total: arenas.length,
      arenas: arenas.map(arena => ({
        id: arena.id,
        name: arena.name,
        matchFormat: arena.matchFormat,
        status: arena.status,
        channelId: arena.channelId,  // 子频道ID（赛场主阵地）
        guildId: arena.guildId,      // 频道ID（容器）
        createdAt: arena.createdAt,
        roles: arena.roles.map(r => ({
          id: r.id,
          label: r.label,
          side: r.side,
          orderIndex: r.orderIndex,
          qqRoleId: r.qqRoleId,
          maxCount: r.maxCount,
          claimedCount: r.claims.length,
          claims: r.claims.map(c => ({
            userId: c.userId,
            username: c.username,
          })),
        })),
      })),
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Arena Status] 获取状态失败:', error)
    throw createError({ statusCode: 500, statusMessage: '获取赛场状态失败' })
  }
})