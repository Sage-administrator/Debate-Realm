import { readBody } from 'h3'
import { prisma } from '../../../lib/prisma'
import { requireWriteTournament } from '../../../utils/tournament-auth'

// 管理端：新增辩题库条目
export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id') as string
    await requireWriteTournament(event, prisma, id)

    const body = await readBody<{
      affirmative: string
      negative: string
      category?: string
      note?: string
    }>(event)

    if (!body.affirmative?.trim() || !body.negative?.trim()) {
      throw createError({ statusCode: 400, message: '正方立场与反方立场均不能为空' })
    }

    const topic = await prisma.debateTopic.create({
      data: {
        tournamentId: id,
        affirmative: body.affirmative.trim(),
        negative: body.negative.trim(),
        category: body.category?.trim() || null,
        note: body.note?.trim() || null,
      },
    })

    return { topic }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Create debate topic error:', error)
    throw createError({ statusCode: 500, message: '创建辩题库条目失败' })
  }
})
