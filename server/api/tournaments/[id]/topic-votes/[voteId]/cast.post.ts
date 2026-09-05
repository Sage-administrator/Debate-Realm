import { readBody, getRequestIP, getHeader } from 'h3'
import { prisma } from '../../../../../lib/prisma'
import { getUserFromEventWithSession, type JWTPayload } from '../../../../../utils/auth'
import { canReadTournament } from '../../../../../utils/tournament-auth'
import {
  parseTopics,
  parseAllowedVoters,
  determineLoginVoterType,
  buildVoterFingerprint,
} from '../../../../../utils/topic-vote'
import {
  recordTopicVoteQuestionnaireSubmission,
  syncTopicVoteQuestionnaire,
} from '../../../../../utils/questionnaire'

// 提交投票接口：同时支持登录用户与公开投票
// 投票者类型判定：
//   - 登录用户：按角色自动判定（admin / debater）
//   - 未登录用户：默认 public；若 allowedVoters 含 judge/debater 且用户自报身份，可使用对应类型
export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id') as string
    const voteId = getRouterParam(event, 'voteId') as string

    // 1. 可选鉴权
    let user: JWTPayload | null = null
    try {
      user = await getUserFromEventWithSession(event, prisma)
    } catch {
      user = null
    }

    // 2. 读取请求体
    const body = await readBody<{
      topicIndices: number[] // 选中的辩题索引列表
      voterName?: string // 公开投票时的标识/昵称
      voterType?: string // 未登录用户可自报身份：judge / debater（需 allowedVoters 允许）
    }>(event)

    // 3. 查询投票详情
    const vote = await prisma.topicVote.findFirst({
      where: { id: voteId, tournamentId: id },
      include: { records: true },
    })
    if (!vote) {
      throw createError({ statusCode: 404, message: '投票不存在' })
    }

    // 4. 校验：投票状态必须为 open
    if (vote.status !== 'open') {
      throw createError({
        statusCode: 400,
        message: '该投票当前不可提交（状态：' + vote.status + '）',
      })
    }

    // 5. 校验：截止时间
    if (vote.deadline && new Date() > vote.deadline) {
      throw createError({ statusCode: 400, message: '投票已截止' })
    }

    // 6. 解析候选辩题与允许的投票者类型
    const topics = parseTopics(vote.topics)
    const allowedVoters = parseAllowedVoters(vote.allowedVoters)
    if (topics.length < 2) {
      throw createError({ statusCode: 500, message: '候选辩题配置异常' })
    }

    // 7. 判定投票者类型
    let voterType: string
    let userId: string | null = null
    let voterName: string | null = null
    let fingerprint: string | null = null

    if (user) {
      // 登录用户：按角色自动判定
      const tournament = await prisma.tournament.findUnique({
        where: { id },
        include: { team: true },
      })
      if (!tournament) {
        throw createError({ statusCode: 404, message: '赛事不存在' })
      }
      const loginType = determineLoginVoterType(user, tournament.teamId)
      if (!loginType) {
        throw createError({ statusCode: 403, message: '您无权参与此赛事的投票' })
      }
      voterType = loginType
      userId = user.userId

      // 防重复：登录用户同一投票只能投一次
      const existing = await prisma.topicVoteRecord.findFirst({
        where: { voteId, userId },
        select: { id: true },
      })
      if (existing) {
        throw createError({ statusCode: 409, message: '您已参与过此投票' })
      }
    } else {
      // 未登录用户
      // 若自报身份（judge/debater）且 allowedVoters 允许，则使用该类型；否则默认 public
      const selfDeclared = body.voterType
      if (
        selfDeclared &&
        ['judge', 'debater'].includes(selfDeclared) &&
        allowedVoters.includes(selfDeclared)
      ) {
        voterType = selfDeclared
      } else {
        voterType = 'public'
      }

      // 仅当 allowedVoters 含 public 或对应类型时允许
      if (!allowedVoters.includes(voterType)) {
        throw createError({ statusCode: 403, message: '您无权参与此投票' })
      }

      // 公开投票需填写昵称
      voterName = body.voterName?.trim() || null
      if (!voterName && voterType === 'public') {
        throw createError({ statusCode: 400, message: '请填写您的昵称' })
      }

      // 生成防刷指纹
      const ip = getRequestIP(event, { xForwardedFor: true })
      const ua = getHeader(event, 'user-agent')
      fingerprint = buildVoterFingerprint(ip || null, ua)

      // 防重复：同一指纹只能投一次
      const existing = await prisma.topicVoteRecord.findFirst({
        where: { voteId, voterFingerprint: fingerprint },
        select: { id: true },
      })
      if (existing) {
        throw createError({ statusCode: 409, message: '您已参与过此投票' })
      }
    }

    // 8. 校验：投票者类型必须在 allowedVoters 中
    if (!allowedVoters.includes(voterType)) {
      throw createError({ statusCode: 403, message: '当前身份无权参与此投票' })
    }

    // 9. 校验：topicIndices 有效性
    let indices = Array.isArray(body.topicIndices) ? body.topicIndices : []
    // 过滤无效索引
    indices = indices.filter((i) => Number.isInteger(i) && i >= 0 && i < topics.length)
    if (indices.length === 0) {
      throw createError({ statusCode: 400, message: '请至少选择一个辩题' })
    }
    // 单选时仅取第一个
    if (!vote.multipleChoice && indices.length > 1) {
      throw createError({ statusCode: 400, message: '此投票为单选，只能选择一个辩题' })
    }
    // 去重
    indices = [...new Set(indices)]

    // 10. 创建投票记录
    const record = await prisma.topicVoteRecord.create({
      data: {
        voteId,
        topicIndices: JSON.stringify(indices),
        userId,
        voterType,
        voterName,
        voterFingerprint: fingerprint,
      },
    })

    // 11. 同步通用投票问卷定义并写入统一问卷提交快照。
    // 业务投票记录仍用于原有统计；统一提交记录用于跨问卷统计、导出和审计。
    await syncTopicVoteQuestionnaire(prisma, id, vote.id, vote.createdBy)
    await recordTopicVoteQuestionnaireSubmission(prisma, id, vote, record, indices)

    setResponseStatus(event, 201)
    return {
      success: true,
      message: '投票成功',
      recordId: record.id,
      topicIndices: indices,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Cast topic vote error:', error)
    throw createError({ statusCode: 500, message: '提交投票失败' })
  }
})
