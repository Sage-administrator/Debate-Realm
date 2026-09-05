import { prisma } from '../../../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../../../utils/auth'
import { canWriteTournament } from '../../../../../utils/tournament-auth'
import { buildVoterFingerprint } from '../../../../../utils/topic-vote'
import { safeJsonStringify, safeJsonParse } from '../../../../../utils/common'
import { getRequestIP, getHeader } from 'h3'

function parseSettings(settingsRaw: string | null | undefined): {
  audience: string
  allowMultiple: boolean
} {
  const s = safeJsonParse<any>(settingsRaw, {})
  return {
    audience: s?.audience || 'loggedIn',
    allowMultiple: !!s?.allowMultiple,
  }
}

function parseMeta(metaRaw: string | null | undefined): any {
  return safeJsonParse<any>(metaRaw, {})
}

/**
 * 提交评分问卷（match_score 来源）。
 * - 受众校验：public 匿名 / loggedIn 登录 / judges 评委
 * - 去重：allowMultiple=false 时按 (matchId, 身份) 唯一，重复提交则更新
 * - sourceId 约定：match:{matchId}:{key}
 */
export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id') as string
    const questionnaireId = getRouterParam(event, 'questionnaireId') as string

    const questionnaire = await prisma.questionnaire.findFirst({
      where: { id: questionnaireId, tournamentId: id },
      include: { questions: true },
    })
    if (!questionnaire) {
      throw createError({ statusCode: 404, message: '问卷不存在' })
    }

    const settings = parseSettings(questionnaire.settings)
    const body = await readBody(event)
    const matchId = String(body?.matchId || '')
    const answers = body?.answers || {}
    const respondentName = body?.respondentName ? String(body.respondentName).trim() : undefined

    if (!matchId) {
      throw createError({ statusCode: 400, message: 'matchId 必填' })
    }

    // ── 受众校验 ──
    let user: any = null
    let fingerprint: string | null = null

    if (settings.audience === 'public') {
      user = await getUserFromEventWithSession(event, prisma)
      const ip = getRequestIP(event, { xForwardedFor: true })
      const ua = getHeader(event, 'user-agent')
      fingerprint = buildVoterFingerprint(ip || null, ua)
    } else {
      // loggedIn / judges 都需要登录
      user = await getUserFromEventWithSession(event, prisma)
      if (!user) {
        throw createError({ statusCode: 401, message: '请先登录后再评分' })
      }
    }

    if (settings.audience === 'judges') {
      // 评委判定：赛事写权限者（组织者）或 该场 match.judge 含本用户名
      const tournament = await prisma.tournament.findUnique({
        where: { id },
        include: { team: true },
      })
      // tournament 可能为 null，此时 isTournamentAdmin 为 false
      const isTournamentAdmin = tournament
        ? canWriteTournament(user, tournament, tournament.team)
        : false
      const match = await prisma.match.findFirst({
        where: { id: matchId, tournamentId: id },
        select: { judge: true },
      })
      const judgeList = (match?.judge || '')
        .split(/[,，、;；]/)
        .map((s: string) => s.trim())
        .filter(Boolean)
      const isAssignedJudge = judgeList.length > 0 ? judgeList.includes(user.username) : true // 未指定评委时退化为任意登录用户可评

      if (!isTournamentAdmin && !isAssignedJudge) {
        throw createError({ statusCode: 403, message: '仅该场比赛的评委可评分' })
      }
    }

    // ── 必填与题型校验 ──
    for (const q of questionnaire.questions) {
      if (['divider', 'heading'].includes(q.questionType)) continue
      const raw = answers[q.fieldKey]
      const val = raw === undefined || raw === null ? '' : String(raw)
      if (q.required && !val.trim()) {
        throw createError({ statusCode: 400, message: `请填写：${q.title}` })
      }
      if (q.questionType === 'scale' && val.trim()) {
        const meta = parseMeta(q.meta)
        const min = typeof meta?.min === 'number' ? meta.min : 1
        const max = typeof meta?.max === 'number' ? meta.max : 5
        const num = Number(val)
        if (!Number.isFinite(num) || num < min || num > max) {
          throw createError({
            statusCode: 400,
            message: `${q.title} 的分值需在 ${min}-${max} 之间`,
          })
        }
      }
    }

    // ── 身份 key 与去重 ──
    const baseKey = settings.audience === 'public' ? `fp:${fingerprint}` : `u:${user.userId}`
    const uniqueKey = settings.allowMultiple ? `${baseKey}:${crypto.randomUUID()}` : baseKey
    const sourceId = `match:${matchId}:${uniqueKey}`

    const storedAnswers = safeJsonStringify(answers)
    const metaPayload = safeJsonStringify({ matchId, audience: settings.audience })

    // 查找已有（仅 when !allowMultiple）
    const existing = settings.allowMultiple
      ? null
      : await prisma.questionnaireSubmission.findFirst({
          where: { sourceType: 'match_score', sourceId },
        })

    let submission
    let updated = false
    if (existing) {
      submission = await prisma.questionnaireSubmission.update({
        where: { id: existing.id },
        data: {
          answers: storedAnswers,
          respondentName: respondentName || existing.respondentName,
          meta: metaPayload,
        },
      })
      updated = true
    } else {
      submission = await prisma.questionnaireSubmission.create({
        data: {
          questionnaireId,
          sourceType: 'match_score',
          sourceId,
          respondentUserId: user?.userId || null,
          respondentName: respondentName || user?.username || null,
          answers: storedAnswers,
          meta: metaPayload,
        },
      })
    }

    return { success: true, submissionId: submission.id, updated }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Submit match score error:', error)
    throw createError({ statusCode: 500, message: '提交评分失败' })
  }
})
