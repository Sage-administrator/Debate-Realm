import { readBody } from 'h3'
import { prisma } from '../../../../lib/prisma'
import { requireWriteTournament } from '../../../../utils/tournament-auth'

// 管理端：更新辩题库条目
export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id') as string
    const topicId = getRouterParam(event, 'topicId') as string
    await requireWriteTournament(event, prisma, id)

    const body = await readBody<{
      affirmative?: string
      negative?: string
      category?: string
      note?: string
    }>(event)

    const existing = await prisma.debateTopic.findFirst({
      where: { id: topicId, tournamentId: id },
    })
    if (!existing) {
      throw createError({ statusCode: 404, message: '辩题库条目不存在' })
    }

    const data: Record<string, any> = {}
    if (body.affirmative !== undefined) {
      if (!body.affirmative.trim()) throw createError({ statusCode: 400, message: '正方立场不能为空' })
      data.affirmative = body.affirmative.trim()
    }
    if (body.negative !== undefined) {
      if (!body.negative.trim()) throw createError({ statusCode: 400, message: '反方立场不能为空' })
      data.negative = body.negative.trim()
    }
    if (body.category !== undefined) data.category = body.category.trim() || null
    if (body.note !== undefined) data.note = body.note.trim() || null

    const topic = await prisma.debateTopic.update({
      where: { id: topicId },
      data,
    })

    return { topic }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Update debate topic error:', error)
    throw createError({ statusCode: 500, message: '更新辩题库条目失败' })
  }
})
