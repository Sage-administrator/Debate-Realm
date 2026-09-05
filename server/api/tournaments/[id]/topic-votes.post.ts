import { readBody } from 'h3'
import { prisma } from '../../../lib/prisma'
import { requireWriteTournament } from '../../../utils/tournament-auth'
import { syncTopicVoteQuestionnaire } from '../../../utils/questionnaire'
import { normalizeTopicItem, topicDisplayText } from '../../../utils/topic-vote'

// 管理端：创建辩题投票
// 支持赛事级（不传 matchId）与场次级（传 matchId）两种粒度
// 候选辩题 topics 支持结构化：字符串 或 { text, affirmative, negative, sourceTopicId, category }
export default defineEventHandler(async (event) => {
  try {
    // 1. 解析赛事 ID 并鉴权（需写权限）
    const id = getRouterParam(event, 'id') as string
    const { user } = await requireWriteTournament(event, prisma, id)

    // 2. 读取请求体
    const body = await readBody<{
      title: string
      description?: string
      topics: any[] // 候选辩题数组（字符串或结构化对象）
      matchId?: string | null // 关联比赛 ID；不传/null 为赛事级
      allowedVoters?: string[] // 允许的投票者类型
      multipleChoice?: boolean // 是否多选
      deadline?: string | null // 截止时间
      showResults?: boolean // 是否展示实时结果
      status?: string // draft | open | closed
    }>(event)

    // 3. 校验：标题必填
    if (!body.title?.trim()) {
      throw createError({ statusCode: 400, message: '投票标题不能为空' })
    }

    // 4. 校验：候选辩题至少 2 个且不重复（按展示文本去重）
    const normalized = (body.topics || [])
      .map(normalizeTopicItem)
      .filter((t): t is NonNullable<typeof t> => t !== null)
    const seen = new Set<string>()
    const uniqueTopics: ReturnType<typeof normalizeTopicItem>[] = []
    for (const t of normalized) {
      const key = topicDisplayText(t)
      if (!key || seen.has(key)) continue
      seen.add(key)
      uniqueTopics.push(t)
    }
    if (uniqueTopics.length < 2) {
      throw createError({ statusCode: 400, message: '至少需要 2 个候选辩题' })
    }

    // 5. 校验：若指定 matchId，需确认该比赛属于本赛事
    if (body.matchId) {
      const match = await prisma.match.findFirst({
        where: { id: body.matchId, tournamentId: id, deletedAt: null },
        select: { id: true },
      })
      if (!match) {
        throw createError({ statusCode: 400, message: '指定的比赛不存在或不属于本赛事' })
      }
    }

    // 6. 校验：截止时间不能早于当前
    let deadline: Date | null = null
    if (body.deadline) {
      deadline = new Date(body.deadline)
      if (isNaN(deadline.getTime())) {
        throw createError({ statusCode: 400, message: '截止时间格式无效' })
      }
    }

    // 7. 创建投票记录
    const vote = await prisma.topicVote.create({
      data: {
        tournamentId: id,
        matchId: body.matchId || null,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        topics: JSON.stringify(uniqueTopics),
        status: body.status || 'open',
        allowedVoters: body.allowedVoters ? JSON.stringify(body.allowedVoters) : null,
        multipleChoice: !!body.multipleChoice,
        deadline,
        showResults: body.showResults !== false,
        createdBy: user.userId,
      },
    })

    // 8. 同步创建通用投票问卷定义，投票也归入统一问卷系统。
    await syncTopicVoteQuestionnaire(prisma, id, vote.id, user.userId)

    setResponseStatus(event, 201)
    return {
      id: vote.id,
      tournamentId: vote.tournamentId,
      matchId: vote.matchId,
      title: vote.title,
      description: vote.description,
      topics: uniqueTopics,
      status: vote.status,
      allowedVoters: vote.allowedVoters,
      multipleChoice: vote.multipleChoice,
      deadline: vote.deadline,
      showResults: vote.showResults,
      createdAt: vote.createdAt,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Create topic vote error:', error)
    throw createError({ statusCode: 500, message: '创建辩题投票失败' })
  }
})
