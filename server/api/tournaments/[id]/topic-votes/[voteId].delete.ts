import { prisma } from '../../../../lib/prisma'
import { requireWriteTournament } from '../../../../utils/tournament-auth'

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
      throw createError({ statusCode: 404, statusMessage: '投票不存在' })
    }

    // 2. 删除（TopicVoteRecord 通过 onDelete: Cascade 自动级联删除）
    await prisma.topicVote.delete({ where: { id: voteId } })

    return { success: true, message: '投票已删除' }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Delete topic vote error:', error)
    throw createError({ statusCode: 500, statusMessage: '删除辩题投票失败' })
  }
})
