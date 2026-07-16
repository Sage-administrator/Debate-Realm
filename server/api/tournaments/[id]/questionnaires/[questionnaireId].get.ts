import { prisma } from '../../../../lib/prisma'
import { requireReadTournament } from '../../../../utils/tournament-auth'

// 安全解析 JSON 字符串，避免历史脏数据导致整个接口失败。
function safeParse(value: string | null) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

// 管理端：获取单份通用问卷详情
// 包含题目定义和最近提交记录，可用于统一预览、统计和导出。
export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id') as string
    const questionnaireId = getRouterParam(event, 'questionnaireId') as string
    await requireReadTournament(event, prisma, id)

    const questionnaire = await prisma.questionnaire.findFirst({
      where: { id: questionnaireId, tournamentId: id },
      include: {
        questions: { orderBy: { sortOrder: 'asc' } },
        submissions: {
          orderBy: { submittedAt: 'desc' },
          take: 100,
        },
      },
    })

    if (!questionnaire) {
      throw createError({ statusCode: 404, message: '问卷不存在' })
    }

    return {
      id: questionnaire.id,
      tournamentId: questionnaire.tournamentId,
      sourceType: questionnaire.sourceType,
      sourceId: questionnaire.sourceId,
      title: questionnaire.title,
      description: questionnaire.description,
      status: questionnaire.status,
      settings: safeParse(questionnaire.settings),
      createdBy: questionnaire.createdBy,
      createdAt: questionnaire.createdAt,
      updatedAt: questionnaire.updatedAt,
      questions: questionnaire.questions.map((q) => ({
        id: q.id,
        fieldKey: q.fieldKey,
        title: q.title,
        questionType: q.questionType,
        options: safeParse(q.options),
        required: q.required,
        sortOrder: q.sortOrder,
        visibilityRule: safeParse(q.visibilityRule),
        meta: safeParse(q.meta),
      })),
      submissions: questionnaire.submissions.map((s) => ({
        id: s.id,
        sourceType: s.sourceType,
        sourceId: s.sourceId,
        respondentUserId: s.respondentUserId,
        respondentName: s.respondentName,
        answers: safeParse(s.answers),
        meta: safeParse(s.meta),
        submittedAt: s.submittedAt,
      })),
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Get questionnaire error:', error)
    throw createError({ statusCode: 500, message: '获取问卷详情失败' })
  }
})
