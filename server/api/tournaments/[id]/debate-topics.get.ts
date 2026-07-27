import { prisma } from '../../../lib/prisma'
import { requireReadTournament } from '../../../utils/tournament-auth'

// 管理端：获取赛事辩题库列表（支持搜索与分类过滤）
export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id') as string
    await requireReadTournament(event, prisma, id)

    const query = getQuery(event)
    const search = typeof query.search === 'string' ? query.search.trim() : ''
    const category = typeof query.category === 'string' && query.category ? query.category : ''

    const where: any = { tournamentId: id }
    if (category) where.category = category
    if (search) {
      where.OR = [
        { affirmative: { contains: search } },
        { negative: { contains: search } },
        { note: { contains: search } },
      ]
    }

    const topics = await prisma.debateTopic.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return { topics }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('List debate topics error:', error)
    throw createError({ statusCode: 500, message: '获取辩题库失败' })
  }
})
