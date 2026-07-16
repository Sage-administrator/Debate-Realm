import { prisma } from '../../../lib/prisma'
import { requireReadTournament } from '../../../utils/tournament-auth'

// 管理端：获取某赛事下的全部报名记录列表
// 支持按 status（pending/approved/rejected）与 type（individual/team）筛选
export default defineEventHandler(async (event) => {
  try {
    // 1. 解析路由参数中的赛事 ID
    const id = getRouterParam(event, 'id') as string

    // 2. 鉴权 + 校验赛事存在性：requireReadTournament 内部不通过会抛 401/403/404
    const { user, tournament } = await requireReadTournament(event, prisma, id)

    // 3. 解析可选查询参数：status / type / 分页参数
    const query = getQuery(event)
    const status = typeof query.status === 'string' ? query.status : undefined
    const type = typeof query.type === 'string' ? query.type : undefined
    // 分页参数：page 从 1 开始，pageSize 默认 50，最大 200（防止一次拉取过多）
    const page = Math.max(1, parseInt((query.page as string) || '1', 10) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt((query.pageSize as string) || '50', 10) || 50))

    // 4. 构建查询条件：必须属于该赛事，可叠加可选筛选
    const where: { tournamentId: string; status?: string; type?: string } = {
      tournamentId: id,
    }
    if (status) where.status = status
    if (type) where.type = type

    // 5. 查询报名记录，包含成员信息，按创建时间倒序
    // 优化：加分页限制，避免报名量大时一次性返回所有数据
    const [registrations, total] = await Promise.all([
      prisma.registration.findMany({
        where,
        include: { members: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.registration.count({ where }),
    ])

    // 6. 返回分页结构（兼容旧版前端：registrations 字段为数组）
    return {
      registrations,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  } catch (error: any) {
    // 已知的业务错误（含鉴权抛出的 createError）直接抛出
    if (error.statusCode) throw error
    console.error('List registrations error:', error)
    throw createError({ statusCode: 500, message: '获取报名列表失败' })
  }
})
