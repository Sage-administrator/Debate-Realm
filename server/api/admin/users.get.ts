import { prisma } from '../../lib/prisma'
import { getUserFromEventWithSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // 修复：使用 getUserFromEventWithSession 校验 tokenVersion
    const currentUser = await getUserFromEventWithSession(event, prisma)

    if (currentUser.role !== 'system_admin') {
      throw createError({ statusCode: 403, statusMessage: '仅系统管理员可查看用户列表' })
    }

    // 分页参数：page 从 1 开始，pageSize 默认 50，最大 200
    const query = getQuery(event)
    const page = Math.max(1, parseInt((query.page as string) || '1', 10) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt((query.pageSize as string) || '50', 10) || 50))

    // 修复：使用 select 替代 include，避免拉取 team 的敏感字段（botAppSecret 等）
    // 同时加分页限制，避免用户量大时一次性返回所有数据
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          username: true,
          role: true,
          mode: true,
          createdAt: true,
          team: { select: { id: true, name: true } }, // 仅取必要字段
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count(),
    ])

    return {
      users,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Get users error:', error)
    throw createError({ statusCode: 500, statusMessage: '获取用户列表失败' })
  }
})
