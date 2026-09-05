// ════════════════════════════════════════════════
// GET /api/tournaments/[id]/public — 公开赛事详情
// 无需登录，仅返回 isPublic=true 的赛事公开信息
// 用于宣传页、赛事介绍、报名入口
// ════════════════════════════════════════════════
import { prisma } from '../../../lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')!

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        team: { select: { id: true, name: true } },
        teams: { select: { name: true, groupLabel: true } },
        judges: { select: { name: true } },
        // 报名字段配置（系统字段 + 自定义字段，按 sortOrder 排序）
        regFields: {
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: {
            registrations: { where: { status: 'approved' } },
            matches: { where: { deletedAt: null } },
          },
        },
      },
    })

    if (!tournament) {
      throw createError({ statusCode: 404, message: '赛事不存在' })
    }

    // 非公开赛事：只有赛事管理员（需登录）才能查看，这里直接返回 404 避免暴露存在性
    if (!tournament.isPublic) {
      throw createError({ statusCode: 404, message: '赛事不存在或未公开' })
    }

    return {
      success: true,
      data: {
        // 基本信息
        id: tournament.id,
        name: tournament.name,
        description: tournament.description || '',
        format: tournament.format,
        status: tournament.status,
        scheduledAt: tournament.scheduledAt,
        venue: tournament.venue || '',
        // 主办方
        organizer: tournament.team?.name || '',
        organizerId: tournament.teamId,
        // 报名配置
        registrationOpen: tournament.registrationOpen,
        registrationDeadline: tournament.registrationDeadline,
        registrationType: tournament.registrationType,
        teamSize: tournament.teamSize,
        registrationInfo: tournament.registrationInfo || '',
        // 统一字段配置（系统字段 + 自定义字段，用于报名表单动态渲染）
        fields: tournament.regFields || [],
        // 参赛队伍（已通过的）
        teams: tournament.teams.map((t) => ({ name: t.name, groupLabel: t.groupLabel })),
        // 评委名单
        judges: tournament.judges.map((j) => j.name),
        // 统计数据
        stats: {
          registrationCount: tournament._count?.registrations || 0,
          matchCount: tournament._count?.matches || 0,
          judgeCount: tournament.judges.length,
        },
        createdAt: tournament.createdAt,
      },
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Public tournament detail error:', error)
    throw createError({ statusCode: 500, message: '获取赛事详情失败' })
  }
})
