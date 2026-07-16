import { prisma } from '../../../../lib/prisma'
import { getUserFromEventWithSession, type JWTPayload } from '../../../../utils/auth'
import { canReadTournament } from '../../../../utils/tournament-auth'
import { parseTopics, parseAllowedVoters, computeVoteStats } from '../../../../utils/topic-vote'

// 通用详情接口：管理员与投票者均可查看
// - 公开投票（allowedVoters 含 public）：任何人可查看基本信息
// - 非公开投票：需登录且有赛事读权限
// - 统计数据：showResults=true 或管理员可查看，否则仅返回基本信息
export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id') as string
    const voteId = getRouterParam(event, 'voteId') as string

    // 1. 可选鉴权：尝试获取登录用户，未登录时 user 为 null
    let user: JWTPayload | null = null
    try {
      user = await getUserFromEventWithSession(event, prisma)
    } catch {
      user = null
    }

    // 2. 查询投票详情（含赛事 teamId 用于权限判定）
    const vote = await prisma.topicVote.findFirst({
      where: { id: voteId, tournamentId: id },
      include: { match: true, records: true },
    })
    if (!vote) {
      throw createError({ statusCode: 404, message: '投票不存在' })
    }

    // 3. 权限判定
    const allowedVoters = parseAllowedVoters(vote.allowedVoters)
    const isPublic = allowedVoters.includes('public')

    // 判断当前用户是否为管理员（有读权限即视为可查看统计）
    let isAdmin = false
    if (user) {
      // 查询赛事的 teamId 做权限判定
      const tournament = await prisma.tournament.findUnique({
        where: { id },
        include: { team: true },
      })
      if (tournament && canReadTournament(user, tournament)) {
        isAdmin = true
      }
    }

    // 非公开投票且非管理员 → 拒绝
    if (!isPublic && !isAdmin) {
      throw createError({ statusCode: 403, message: '无权限查看此投票' })
    }

    // 4. 组装返回数据
    const topics = parseTopics(vote.topics)
    const base = {
      id: vote.id,
      tournamentId: vote.tournamentId,
      matchId: vote.matchId,
      match: vote.match
        ? { id: vote.match.id, round: vote.match.round, teamA: vote.match.teamA, teamB: vote.match.teamB, topic: vote.match.topic }
        : null,
      title: vote.title,
      description: vote.description,
      topics,
      status: vote.status,
      allowedVoters: vote.allowedVoters,
      allowedVoterTypes: allowedVoters,
      multipleChoice: vote.multipleChoice,
      deadline: vote.deadline,
      showResults: vote.showResults,
      isPublic,
      createdAt: vote.createdAt,
      updatedAt: vote.updatedAt,
    }

    // 5. 统计数据：showResults=true 或管理员可查看
    const canSeeResults = vote.showResults || isAdmin
    if (canSeeResults) {
      const stats = computeVoteStats(topics, vote.records)
      return { ...base, stats }
    }

    // 不展示结果时仅返回总票数（不暴露各选项分布）
    return { ...base, stats: { total: vote.records.length, results: [] } }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Get topic vote error:', error)
    throw createError({ statusCode: 500, message: '获取投票详情失败' })
  }
})
