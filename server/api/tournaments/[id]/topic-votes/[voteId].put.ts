import { readBody } from 'h3'
import { prisma } from '../../../../lib/prisma'
import { requireWriteTournament } from '../../../../utils/tournament-auth'
import { syncTopicVoteQuestionnaire } from '../../../../utils/questionnaire'

// 管理端：编辑辩题投票（标题/说明/辩题/配置/状态/截止时间等）
// 注意：已有投票记录时修改候选辩题可能导致索引错位，前端需提示
export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id') as string
    const voteId = getRouterParam(event, 'voteId') as string
    const { user } = await requireWriteTournament(event, prisma, id)

    const body = await readBody<{
      title?: string
      description?: string | null
      topics?: string[]
      matchId?: string | null
      allowedVoters?: string[] | null
      multipleChoice?: boolean
      deadline?: string | null
      showResults?: boolean
      status?: string // draft | open | closed
    }>(event)

    // 1. 确认投票存在且属于本赛事
    const existing = await prisma.topicVote.findFirst({
      where: { id: voteId, tournamentId: id },
      select: { id: true, topics: true },
    })
    if (!existing) {
      throw createError({ statusCode: 404, message: '投票不存在' })
    }

    // 2. 构建更新数据（仅更新提供的字段）
    const data: Record<string, any> = {}
    if (body.title !== undefined) {
      if (!body.title.trim()) throw createError({ statusCode: 400, message: '投票标题不能为空' })
      data.title = body.title.trim()
    }
    if (body.description !== undefined) data.description = body.description?.trim() || null
    if (body.multipleChoice !== undefined) data.multipleChoice = !!body.multipleChoice
    if (body.showResults !== undefined) data.showResults = !!body.showResults
    if (body.status !== undefined) {
      if (!['draft', 'open', 'closed'].includes(body.status)) {
        throw createError({ statusCode: 400, message: '状态值无效' })
      }
      data.status = body.status
    }
    if (body.allowedVoters !== undefined) {
      data.allowedVoters = body.allowedVoters ? JSON.stringify(body.allowedVoters) : null
    }
    if (body.matchId !== undefined) {
      // 若指定 matchId，校验归属
      if (body.matchId) {
        const match = await prisma.match.findFirst({
          where: { id: body.matchId, tournamentId: id, deletedAt: null },
          select: { id: true },
        })
        if (!match) throw createError({ statusCode: 400, message: '指定的比赛不存在或不属于本赛事' })
      }
      data.matchId = body.matchId || null
    }
    if (body.deadline !== undefined) {
      data.deadline = body.deadline ? new Date(body.deadline) : null
      if (data.deadline && isNaN(data.deadline.getTime())) {
        throw createError({ statusCode: 400, message: '截止时间格式无效' })
      }
    }
    if (body.topics !== undefined) {
      const topics = body.topics.map((t) => String(t).trim()).filter((t) => t.length > 0)
      const uniqueTopics = [...new Set(topics)]
      if (uniqueTopics.length < 2) {
        throw createError({ statusCode: 400, message: '至少需要 2 个候选辩题' })
      }
      data.topics = JSON.stringify(uniqueTopics)
    }

    // 3. 执行更新
    const updated = await prisma.topicVote.update({
      where: { id: voteId },
      data,
    })

    // 4. 同步通用投票问卷定义，确保问卷画布与业务投票配置一致。
    await syncTopicVoteQuestionnaire(prisma, id, voteId, user.userId)

    return {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      status: updated.status,
      deadline: updated.deadline,
      updatedAt: updated.updatedAt,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Update topic vote error:', error)
    throw createError({ statusCode: 500, message: '更新辩题投票失败' })
  }
})
