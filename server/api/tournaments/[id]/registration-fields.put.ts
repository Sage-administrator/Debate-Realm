// 管理赛事的报名表单字段（整体替换）
// 统一处理系统字段和自定义字段的更新
import { createError } from 'h3'
import { prisma } from '../../../lib/prisma'
import { requireWriteTournament } from '../../../utils/tournament-auth'
import { isSystemFieldKey } from '../../../utils/system-fields'
import { syncRegistrationQuestionnaire } from '../../../utils/questionnaire'

// 单个报名字段的结构定义
interface RegistrationFieldInput {
  id?: string // 已有字段的 ID（系统字段更新时需要）
  fieldName: string // 字段显示名称（中文标签）
  fieldKey: string // 字段键名（英文标识，用于数据存储与映射）
  fieldType: string // text | textarea | select | checkbox | radio | number | date | phone | email | members | divider | heading
  fieldOptions?: string | null // JSON 字符串：选项列表（select/radio/checkbox 用）
  required: boolean
  sortOrder: number
  appliesTo: string // individual | team | both
  placeholder?: string | null
  description?: string | null
  width?: string // half | full
  systemField?: boolean
}

// 合法的字段类型
const VALID_FIELD_TYPES = [
  'text',
  'textarea',
  'select',
  'checkbox',
  'radio',
  'number',
  'date',
  'phone',
  'email',
  'members',
  'divider',
  'heading',
]

// 合法的 appliesTo 值
const VALID_APPLIES_TO = ['individual', 'team', 'both']

// 合法的 width 值
const VALID_WIDTH = ['half', 'full']

export default defineEventHandler(async (event) => {
  try {
    // 1. 从路由参数解析赛事 ID
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, message: '缺少赛事ID' })

    // 读取请求体
    const body = await readBody<{ fields: RegistrationFieldInput[] }>(event)
    if (!body || !Array.isArray(body.fields)) {
      throw createError({ statusCode: 400, message: '缺少fields参数或格式不正确' })
    }

    // 2. 权限校验：系统管理员 或 该赛事所属团队的管理员
    const { user } = await requireWriteTournament(event, prisma, id)

    // 3. 事务：整体替换字段配置
    await prisma.$transaction(async (tx) => {
      // 3.1 先删除该赛事下所有非系统字段（系统字段保留，单独更新）
      await tx.registrationField.deleteMany({
        where: { tournamentId: id, systemField: false },
      })

      // 3.2 处理每个字段
      let i = 0
      for (const f of body.fields) {
        // 跳过空记录或 fieldName 为空且非装饰类型的记录
        if (!f || (!f.fieldName?.trim() && !['divider', 'heading'].includes(f.fieldType))) {
          i++
          continue
        }

        const fieldType = VALID_FIELD_TYPES.includes(f.fieldType) ? f.fieldType : 'text'
        const appliesTo = VALID_APPLIES_TO.includes(f.appliesTo) ? f.appliesTo : 'both'
        const width = VALID_WIDTH.includes(f.width || '') ? f.width! : 'full'
        const isSystem = isSystemFieldKey(f.fieldKey) || !!f.systemField

        const data = {
          tournamentId: id,
          fieldName: f.fieldName?.trim() || '',
          fieldKey: f.fieldKey,
          fieldType,
          fieldOptions: f.fieldOptions ?? null,
          required: !!f.required,
          sortOrder: typeof f.sortOrder === 'number' ? f.sortOrder : i,
          appliesTo,
          placeholder: f.placeholder ?? null,
          description: f.description ?? null,
          width,
          systemField: isSystem,
        }

        if (isSystem && f.id) {
          // 系统字段：更新已有记录（不修改 fieldKey/fieldType）
          await tx.registrationField.update({
            where: { id: f.id },
            data: {
              fieldName: data.fieldName,
              fieldOptions: data.fieldOptions,
              required: data.required,
              sortOrder: data.sortOrder,
              appliesTo: data.appliesTo,
              placeholder: data.placeholder,
              description: data.description,
              width: data.width,
            },
          })
        } else {
          // 自定义字段：创建新记录
          await tx.registrationField.create({ data })
        }
        i++
      }
    })

    // 4. 返回更新后的字段列表
    const updated = await prisma.registrationField.findMany({
      where: { tournamentId: id },
      orderBy: { sortOrder: 'asc' },
    })

    // 5. 同步到通用问卷定义，保证报名问卷也进入统一问卷系统。
    await syncRegistrationQuestionnaire(prisma, id, user.userId)

    return {
      success: true,
      fields: updated.map((f) => ({
        id: f.id,
        fieldName: f.fieldName,
        fieldKey: f.fieldKey,
        fieldType: f.fieldType,
        fieldOptions: f.fieldOptions,
        required: f.required,
        sortOrder: f.sortOrder,
        appliesTo: f.appliesTo,
        placeholder: f.placeholder,
        description: f.description,
        width: f.width,
        systemField: f.systemField,
      })),
    }
  } catch (error: any) {
    // 已知错误（如权限/参数校验）直接抛出
    if (error.statusCode) throw error
    console.error('Update registration fields error:', error)
    throw createError({ statusCode: 500, message: '更新报名字段失败' })
  }
})
