// ════════════════════════════════════════════════════
// GET /api/bot/arena/list — 获取团队所有赛场列表
// ════════════════════════════════════════════════════
import { prisma } from '../../../lib/prisma'
import { getUserFromEvent } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const currentUser = getUserFromEvent(event)

    // 权限校验：system_admin / 团队 admin / 团队 subaccount（只读） 均可查看赛场列表
    // 注意：系统不存在 'member' 角色，合法角色见 prisma/schema.prisma User.role 注释
    if (
      currentUser.role !== 'admin' &&
      currentUser.role !== 'system_admin' &&
      currentUser.role !== 'subaccount'
    ) {
      throw createError({ statusCode: 403, statusMessage: '权限不足' })
    }

    const query = getQuery(event)
    const teamId = (query.teamId as string) || currentUser.teamId
    const status = (query.status as string) || 'all'

    if (!teamId) {
      throw createError({ statusCode: 400, statusMessage: '缺少 teamId 参数' })
    }

    const where: any = { teamId }
    if (status !== 'all') {
      where.status = status
    }

    const arenas = await prisma.botArena.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            roles: true,
          },
        },
        roles: {
          select: {
            _count: {
              select: { claims: true },
            },
          },
        },
      },
    })

    return {
      success: true,
      total: arenas.length,
      arenas: arenas.map(arena => ({
        id: arena.id,
        name: arena.name,
        matchFormat: arena.matchFormat,
        status: arena.status,
        channelId: arena.channelId,  // 子频道ID（赛场主阵地）
        guildId: arena.guildId,      // 频道ID（容器）
        roleCount: arena._count.roles,
        totalClaims: arena.roles.reduce((sum, r) => sum + r._count.claims, 0),
        createdAt: arena.createdAt,
        updatedAt: arena.updatedAt,
      })),
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Arena List] 查询失败:', error)
    throw createError({ statusCode: 500, statusMessage: '查询赛场列表失败' })
  }
})