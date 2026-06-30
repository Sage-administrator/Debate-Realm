// ════════════════════════════════════════════════════
// GET /api/bot/arena/claims — 获取赛场认领列表
// 请求参数：?arenaId=xxx（可选，不传则返回活跃赛场）
// ════════════════════════════════════════════════════
import { prisma } from '../../../lib/prisma'
import { getUserFromEvent } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const currentUser = getUserFromEvent(event)

    if (currentUser.role !== 'admin' && currentUser.role !== 'system_admin' && currentUser.role !== 'member') {
      throw createError({ statusCode: 403, statusMessage: '权限不足' })
    }

    const query = getQuery(event)
    const arenaId = query.arenaId as string | undefined
    const teamId = (query.teamId as string) || currentUser.teamId

    if (!teamId) {
      throw createError({ statusCode: 400, statusMessage: '缺少 teamId 参数' })
    }

    // 查找活跃赛场
    const arenaWhere: any = { teamId, status: 'active' }
    if (arenaId) {
      arenaWhere.id = arenaId
    }

    const arena = await prisma.botArena.findFirst({
      where: arenaWhere,
      include: {
        roles: {
          include: {
            claims: {
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: [{ side: 'asc' }, { orderIndex: 'asc' }],
        },
      },
    })

    if (!arena) {
      return {
        success: true,
        arena: null,
        message: arenaId ? '赛场不存在或已关闭' : '当前没有活跃赛场',
      }
    }

    return {
      success: true,
      arena: {
        id: arena.id,
        name: arena.name,
        matchFormat: arena.matchFormat,
        status: arena.status,
        channelId: arena.channelId,  // 子频道ID（赛场主阵地）
        guildId: arena.guildId,      // 频道ID（容器）
        createdAt: arena.createdAt,
        roles: arena.roles.map(role => ({
          id: role.id,
          label: role.label,
          side: role.side,
          qqRoleId: role.qqRoleId,
          maxClaims: role.maxCount,
          claims: role.claims.map(claim => ({
            id: claim.id,
            userId: claim.userId,
            username: claim.username,
            createdAt: claim.createdAt,
          })),
          isFull: role.claims.length >= role.maxCount,
        })),
      },
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Arena Claims] 查询失败:', error)
    throw createError({ statusCode: 500, statusMessage: '查询赛场认领列表失败' })
  }
})