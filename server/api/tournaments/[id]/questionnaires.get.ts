import { prisma } from '../../../lib/prisma'
import { requireReadTournament } from '../../../utils/tournament-auth'

// 安全解析 JSON 字符串，避免历史脏数据导致整个接口失败。
function safeParse(value: string | null) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

// 管理端：获取某赛事下的通用问卷列表
// 统一返回报名问卷、投票问卷，以及后续可能扩展的签到/反馈问卷。
export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id') as string
    await requireReadTournament(event, prisma, id)

    const query = getQuery(event)
    const sourceType = typeof query.sourceType === 'string' ? query.sourceType : undefined
    const status = typeof query.status === 'string' ? query.status : undefined

    const where: Record<string, any> = { tournamentId: id }
    if (sourceType) where.sourceType = sourceType
    if (status) where.status = status

    const questionnaires = await prisma.questionnaire.findMany({
      where,
      include: {
        _count: {
          select: {
            questions: true,
            submissions: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return questionnaires.map((q) => ({
      id: q.id,
      tournamentId: q.tournamentId,
      sourceType: q.sourceType,
      sourceId: q.sourceId,
      title: q.title,
      description: q.description,
      status: q.status,
      settings: safeParse(q.settings),
      createdBy: q.createdBy,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
      questionCount: q._count.questions,
      submissionCount: q._count.submissions,
    }))
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('List questionnaires error:', error)
    throw createError({ statusCode: 500, message: '获取问卷列表失败' })
  }
})
