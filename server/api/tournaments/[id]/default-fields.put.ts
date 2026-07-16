// 更新赛事的默认字段配置（管理员接口）
// 配置：姓名、电话、邮箱、队伍名称、成员信息、备注等默认字段的适用类型和必填性
import { createError } from 'h3'
import { prisma } from '../../../lib/prisma'
import { requireWriteTournament } from '../../../utils/tournament-auth'
import { DEFAULT_FIELDS } from '../../../utils/default-fields'

// 允许配置的默认字段 key 列表
const ALLOWED_FIELD_KEYS = DEFAULT_FIELDS.map((f) => f.fieldKey)

// 合法的 appliesTo 值
const VALID_APPLIES_TO = ['individual', 'team', 'both']

export default defineEventHandler(async (event) => {
  // 1. 从路由参数中解析赛事 ID
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: '缺少赛事ID' })

  // 2. 读取请求体
  const body = await readBody(event)
  if (!body || !Array.isArray(body.fields)) {
    throw createError({ statusCode: 400, message: '缺少 fields 数组' })
  }

  // 3. 权限校验
  await requireWriteTournament(event, prisma, id)

  // 4. 校验并构造配置对象
  const config: Record<string, { appliesTo: string; required: boolean }> = {}
  for (const field of body.fields) {
    if (!field || !field.fieldKey || !ALLOWED_FIELD_KEYS.includes(field.fieldKey)) {
      continue // 跳过不合法的字段
    }
    const appliesTo = VALID_APPLIES_TO.includes(field.appliesTo) ? field.appliesTo : 'both'
    const required = typeof field.required === 'boolean' ? field.required : false
    config[field.fieldKey] = { appliesTo, required }
  }

  // 5. 保存到数据库
  const updated = await prisma.tournament.update({
    where: { id },
    data: {
      defaultFieldsConfig: JSON.stringify(config),
    },
    select: {
      id: true,
      defaultFieldsConfig: true,
    },
  })

  // 6. 返回更新后的配置
  return {
    data: {
      id: updated.id,
      defaultFieldsConfig: updated.defaultFieldsConfig,
    },
  }
})
