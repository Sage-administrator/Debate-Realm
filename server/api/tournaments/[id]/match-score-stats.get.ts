import { prisma } from '../../../lib/prisma'
import { requireReadTournament } from '../../../utils/tournament-auth'
import { safeJsonParse } from '../../../utils/common'

function parseMeta(metaRaw: string | null | undefined): any {
  return safeJsonParse<any>(metaRaw, {})
}

// 从 sourceId（match:{matchId}:{key}）解析 matchId（uuid 不含冒号，安全 split）
function parseMatchId(sourceId: string): string | null {
  const parts = sourceId.split(':')
  if (parts.length >= 2 && parts[0] === 'match') return parts[1] ?? null
  return null
}

// 计算一组数值的均值与分布
function aggregateScale(values: number[]) {
  const valid = values.filter((v) => Number.isFinite(v))
  const count = valid.length
  if (count === 0) {
    return { count: 0, avg: 0, distribution: [] as { value: number; count: number }[] }
  }
  const sum = valid.reduce((a, b) => a + b, 0)
  const distMap = new Map<number, number>()
  for (const v of valid) {
    distMap.set(v, (distMap.get(v) || 0) + 1)
  }
  const distribution = [...distMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([value, count]) => ({ value, count }))
  return { count, avg: Math.round((sum / count) * 100) / 100, distribution }
}

/**
 * 评分问卷统计聚合接口。
 * 返回：hasTemplate、各场（按 matchId 分组）的 scale 题均值/分布/提交数、整体聚合。
 */
export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id') as string
    await requireReadTournament(event, prisma, id)

    const template = await prisma.questionnaire.findFirst({
      where: { tournamentId: id, sourceType: 'match_score' },
      include: { questions: { orderBy: { sortOrder: 'asc' } } },
    })

    if (!template) {
      return { success: true, hasTemplate: false, matches: [], overall: [], submissionTotal: 0 }
    }

    const submissions = await prisma.questionnaireSubmission.findMany({
      where: { questionnaireId: template.id },
      orderBy: { submittedAt: 'asc' },
    })

    const scaleQuestions = template.questions.filter((q) => q.questionType === 'scale')

    // 按 matchId 分组
    const byMatch = new Map<string, any[]>()
    for (const sub of submissions) {
      const matchId = parseMatchId(sub.sourceId)
      if (!matchId) continue
      if (!byMatch.has(matchId)) byMatch.set(matchId, [])
      byMatch.get(matchId)!.push(sub)
    }

    // 对一场比赛聚合
    function aggregate(matchSubs: any[]) {
      const scales = scaleQuestions.map((q) => {
        const meta = parseMeta(q.meta)
        const values: number[] = matchSubs.map((s) => {
          const answers = safeJsonParse<Record<string, any>>(s.answers, {})
          return Number(answers?.[q.fieldKey])
        })
        return {
          fieldKey: q.fieldKey,
          title: q.title,
          min: typeof meta?.min === 'number' ? meta.min : 1,
          max: typeof meta?.max === 'number' ? meta.max : 5,
          ...aggregateScale(values),
        }
      })
      return { submissionCount: matchSubs.length, scales }
    }

    const matches = [...byMatch.entries()].map(([matchId, subs]) => ({
      matchId,
      ...aggregate(subs),
    }))

    const overall = aggregate(submissions).scales

    return {
      success: true,
      hasTemplate: true,
      questionnaireId: template.id,
      title: template.title,
      settings: safeJsonParse<any>(template.settings, {}),
      matches,
      overall,
      submissionTotal: submissions.length,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Match score stats error:', error)
    throw createError({ statusCode: 500, message: '获取评分统计失败' })
  }
})
