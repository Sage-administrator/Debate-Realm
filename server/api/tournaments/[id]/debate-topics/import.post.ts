import { readBody } from 'h3'
import { prisma } from '../../../../lib/prisma'
import { requireWriteTournament } from '../../../../utils/tournament-auth'

// 管理端：批量导入辩题库条目（CSV 导入）
export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id') as string
    await requireWriteTournament(event, prisma, id)

    const body = await readBody<{
      topics?: Array<{
        affirmative?: string
        negative?: string
        category?: string
        note?: string
      }>
    }>(event)

    if (!Array.isArray(body.topics) || body.topics.length === 0) {
      throw createError({ statusCode: 400, message: '没有可导入的辩题' })
    }

    // 规范化并过滤有效行：正方/反方 均非空
    const rows: { affirmative: string; negative: string; category: string | null; note: string | null }[] = []
    for (const t of body.topics) {
      const aff = (t?.affirmative || '').toString().trim()
      const neg = (t?.negative || '').toString().trim()
      if (!aff || !neg) continue
      rows.push({
        affirmative: aff,
        negative: neg,
        category: (t?.category || '').toString().trim() || null,
        note: (t?.note || '').toString().trim() || null,
      })
    }

    if (rows.length === 0) {
      throw createError({ statusCode: 400, message: '有效的辩题行为 0（每行的正方立场与反方立场均不能为空）' })
    }

    // 批内去重（按 正方|反方 小写）
    const seen = new Set<string>()
    const unique: typeof rows = []
    for (const r of rows) {
      const key = `${r.affirmative.toLowerCase()}|||${r.negative.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(r)
    }

    // 与已有库去重：跳过已存在的 (正方,反方)
    const existing = await prisma.debateTopic.findMany({
      where: { tournamentId: id },
      select: { affirmative: true, negative: true },
    })
    const existKeys = new Set(existing.map((e) => `${e.affirmative.toLowerCase()}|||${e.negative.toLowerCase()}`))
    const toCreate = unique.filter((r) => !existKeys.has(`${r.affirmative.toLowerCase()}|||${r.negative.toLowerCase()}`))

    const skipped = unique.length - toCreate.length

    if (toCreate.length > 0) {
      await prisma.$transaction(
        toCreate.map((r) =>
          prisma.debateTopic.create({
            data: {
              tournamentId: id,
              affirmative: r.affirmative,
              negative: r.negative,
              category: r.category,
              note: r.note,
            },
          }),
        ),
      )
    }

    return {
      created: toCreate.length,
      skipped,
      total: rows.length,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Import debate topics error:', error)
    throw createError({ statusCode: 500, message: '批量导入辩题失败' })
  }
})
