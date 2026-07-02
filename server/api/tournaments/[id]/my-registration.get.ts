import { prisma } from '../../../lib/prisma'
import { getUserFromEvent } from '../../../utils/auth'

// 已登录用户查询自己在指定赛事中的报名记录
export default defineEventHandler(async (event) => {
  try {
    // 1. 解析路由参数中的赛事 ID
    const id = getRouterParam(event, 'id') as string

    // 2. 获取当前登录用户（未登录或令牌无效时抛 401）
    const user = getUserFromEvent(event)

    // 3. 查询该用户在此赛事下的所有报名记录（含成员信息）
    const registrations = await prisma.registration.findMany({
      where: {
        userId: user.userId,
        tournamentId: id,
      },
      include: { members: true },
    })

    // 4. 返回报名记录数组（可能为空，也可能有多条）
    return registrations
  } catch (error: any) {
    // 已知的业务错误（如 401 未认证）直接抛出
    if (error.statusCode) throw error
    console.error('Get my registration error:', error)
    throw createError({ statusCode: 500, statusMessage: '查询报名记录失败' })
  }
})
