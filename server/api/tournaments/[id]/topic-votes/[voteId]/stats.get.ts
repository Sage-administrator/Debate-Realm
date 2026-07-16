import { prisma } from '../../../../../lib/prisma'
import { requireReadTournament } from '../../../../../utils/tournament-auth'
import { parseTopics, parseAllowedVoters, computeVoteStats } from '../../../../../utils/topic-vote'

// 管理端：获取投票详细统计（含各选项得票数、百分比、投票者类型分布、投票者列表）
export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id') as string
    const voteId = getRouterParam(event, 'voteId') as string
    await requireReadTournament(event, prisma, id)

    // 1. 查询投票详情
    const vote = await prisma.topicVote.findFirst({
      where: { id: voteId, tournamentId: id },
      include: { records: true, match: true },
    })
    if (!vote) {
      throw createError({ statusCode: 404, message: '投票不存在' })
    }

    // 2. 计算统计
    const topics = parseTopics(vote.topics)
    const stats = computeVoteStats(topics, vote.records)
    const allowedVoters = parseAllowedVoters(vote.allowedVoters)

    // 3. 投票者类型分布
    const byType: Record<string, number> = {}
    for (const r of vote.records) {
      byType[r.voterType] = (byType[r.voterType] || 0) + 1
    }

    // 4. 投票者列表（脱敏：不返回 userId / fingerprint）
    const voters = vote.records.map((r) => ({
      id: r.id,
      voterType: r.voterType,
      voterName: r.voterName,
      topicIndices: JSON.parse(r.topicIndices),
      createdAt: r.createdAt,
    }))

    return {
      id: vote.id,
      title: vote.title,
      topics,
      status: vote.status,
      multipleChoice: vote.multipleChoice,
      deadline: vote.deadline,
      allowedVoterTypes: allowedVoters,
      match: vote.match
        ? { id: vote.match.id, round: vote.match.round, teamA: vote.match.teamA, teamB: vote.match.teamB }
        : null,
      totalVotes: stats.total,
      results: stats.results,
      byType,
      voters,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Get topic vote stats error:', error)
    throw createError({ statusCode: 500, message: '获取投票统计失败' })
  }
})
