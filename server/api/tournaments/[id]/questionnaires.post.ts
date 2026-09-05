import { prisma } from '../../../lib/prisma'
import { requireWriteTournament } from '../../../utils/tournament-auth'
import { safeJsonStringify } from '../../../utils/common'

// 支持的题型白名单（沿用通用问卷底座，新增 scale 量表题）。
const QUESTION_TYPES = new Set([
  'text',
  'textarea',
  'radio',
  'checkbox',
  'select',
  'number',
  'date',
  'phone',
  'email',
  'members',
  'heading',
  'divider',
  'scale',
])

// 安全序列化：对象/数组 → JSON 字符串；已为字符串则原样存储；null/undefined → null。
function toStoredJson(value: any): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  return safeJsonStringify(value)
}

/**
 * 通用「保存问卷设计」接口（upsert）。
 * 当前用于：
 *   - 评分问卷：sourceType='match_score'，sourceId=tournamentId
 * 组织者调用，鉴权为写权限。
 */
export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id') as string
    await requireWriteTournament(event, prisma, id)

    const body = await readBody(event)
    if (!body || typeof body !== 'object') {
      throw createError({ statusCode: 400, message: '请求体无效' })
    }

    const { sourceType, sourceId, title, description, status, settings, questions } = body as any

    if (!sourceType || !sourceId) {
      throw createError({ statusCode: 400, message: 'sourceType 与 sourceId 必填' })
    }

    // 题目校验与规整
    const normalizedQuestions = Array.isArray(questions)
      ? questions.map((q: any, index: number) => {
          const questionType = q.questionType || 'text'
          if (!QUESTION_TYPES.has(questionType)) {
            throw createError({ statusCode: 400, message: `不支持的题型：${questionType}` })
          }
          return {
            fieldKey: q.fieldKey || `field_${questionType}_${index + 1}`,
            title: String(q.title ?? '').trim() || '未命名题目',
            questionType,
            options: toStoredJson(q.options),
            // scale 题型的配置（min/max/step/左右标签）存于 meta；题目说明（富文本）也放在 meta.description
            meta: toStoredJson({
              ...(q.meta && typeof q.meta === 'object' && !Array.isArray(q.meta) ? q.meta : {}),
              description: q.description ?? null,
            }),
            required: !!q.required,
            sortOrder: typeof q.sortOrder === 'number' ? q.sortOrder : index,
          }
        })
      : []

    const data = {
      title: String(title ?? '').trim() || '未命名问卷',
      description: description ? String(description) : null,
      status: status || 'open',
      settings: toStoredJson(settings),
    }

    // upsert：按 (tournamentId, sourceType, sourceId) 唯一约束
    const existing = await prisma.questionnaire.findFirst({
      where: { tournamentId: id, sourceType, sourceId },
      select: { id: true },
    })

    let questionnaire
    if (existing) {
      questionnaire = await prisma.questionnaire.update({
        where: { id: existing.id },
        data: {
          ...data,
          questions: {
            deleteMany: {},
            create: normalizedQuestions,
          },
        },
      })
    } else {
      questionnaire = await prisma.questionnaire.create({
        data: {
          tournamentId: id,
          sourceType,
          sourceId,
          ...data,
          questions: {
            create: normalizedQuestions,
          },
        },
      })
    }

    return { success: true, id: questionnaire.id }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Save questionnaire error:', error)
    throw createError({ statusCode: 500, message: '保存问卷设计失败' })
  }
})
