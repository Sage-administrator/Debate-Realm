import { prisma } from '../../../../lib/prisma'
import { requireWriteTournament } from '../../../../utils/tournament-auth'
import { deleteQuestionnaireBySource } from '../../../../utils/questionnaire'

// 管理端：删除辩题投票（级联删除投票记录）
export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id') as string
    const voteId = getRouterParam(event, 'voteId') as string
    await requireWriteTournament(event, prisma, id)

    // 1. 确认投票存在且属于本赛事
    const existing = await prisma.topicVote.findFirst({
      where: { id: voteId, tournamentId: id },
      select: { id: true },
    })
    if (!existing) {
      throw createError({ statusCode: 404, message: '投票不存在' })
    }

    // 2. 删除业务投票和通用问卷索引。
    // TopicVoteRecord 与 QuestionnaireQuestion / QuestionnaireSubmission 均通过级联删除清理。
    await prisma.$transaction(async (tx) => {
      await deleteQuestionnaireBySource(tx, id, 'topic_vote', voteId)
      await tx.topicVote.delete({ where: { id: voteId } })
    })

    return { success: true, message: '投票问卷已删除' }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Delete topic vote error:', error)
    throw createError({ statusCode: 500, message: '删除辩题投票失败' })
  }
})
