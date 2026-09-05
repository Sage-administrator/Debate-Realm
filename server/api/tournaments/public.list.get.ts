// ════════════════════════════════════════════════
// GET /api/tournaments/public.list — 公开赛事列表
// 无需登录，仅返回 isPublic=true 的赛事
// 用于宣传页、报名入口
// ════════════════════════════════════════════════
import { prisma } from '../../lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const page = parseInt(query.page as string) || 1
    const pageSize = Math.min(parseInt(query.pageSize as string) || 20, 100)
    const keyword = (query.keyword as string)?.trim() || ''
    const status = (query.status as string) || ''

    // 构建查询条件
    const where: any = { isPublic: true }
    if (keyword) {
      where.OR = [{ name: { contains: keyword } }, { description: { contains: keyword } }]
    }
    if (status && status !== 'all') {
      where.status = status
    }

    // 并行查询总数和列表
    const [total, tournaments] = await Promise.all([
      prisma.tournament.count({ where }),
      prisma.tournament.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          team: {
            select: { id: true, name: true },
          },
          _count: {
            select: {
              registrations: true,
              matches: true,
              judges: true,
            },
          },
        },
      }),
    ])

    // 格式化返回数据（脱敏，不暴露敏感信息）
    const list = tournaments.map((t: any) => ({
      id: t.id,
      name: t.name,
      description: t.description || '',
      format: t.format,
      status: t.status,
      scheduledAt: t.scheduledAt,
      venue: t.venue || '',
      // 主办方信息
      organizer: t.team?.name || '',
      teamId: t.teamId,
      // 报名相关
      registrationOpen: t.registrationOpen,
      registrationDeadline: t.registrationDeadline,
      registrationType: t.registrationType,
      // 统计数据
      registrationCount: t._count?.registrations || 0,
      matchCount: t._count?.matches || 0,
      judgeCount: t._count?.judges || 0,
      // 时间
      createdAt: t.createdAt,
    }))

    return {
      success: true,
      data: {
        list,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    }
  } catch (error: any) {
    console.error('Public tournament list error:', error)
    throw createError({ statusCode: 500, message: '获取赛事列表失败' })
  }
})
