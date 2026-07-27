import { prisma } from '../../../../lib/prisma'
import { requireWriteTournament } from '../../../../utils/tournament-auth'

// 管理端：删除辩题库条目
export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id') as string
    const topicId = getRouterParam(event, 'topicId') as string
    await requireWriteTournament(event, prisma, id)

    const existing = await prisma.debateTopic.findFirst({
      where: { id: topicId, tournamentId: id },
    })
    if (!existing) {
      throw createError({ statusCode: 404, message: '辩题库条目不存在' })
    }

    await prisma.debateTopic.delete({ where: { id: topicId } })

    return { success: true }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Delete debate topic error:', error)
    throw createError({ statusCode: 500, message: '删除辩题库条目失败' })
  }
})
