// 管理赛事的自定义报名字段（整体替换）
import { createError } from 'h3'
import { prisma } from '../../../lib/prisma'
import { requireWriteTournament } from '../../../utils/tournament-auth'

// 单个报名字段的结构定义
interface RegistrationFieldInput {
  fieldName: string    // 字段显示名称（中文标签）
  fieldKey: string     // 字段键名（英文标识，用于 customData 存储）
  fieldType: string    // text | textarea | select | checkbox | radio
  fieldOptions?: string | null  // JSON 字符串：选项列表（select/radio/checkbox 用）
  required: boolean
  sortOrder: number
  appliesTo: string    // individual | team | both
}

export default defineEventHandler(async (event) => {
  try {
    // 1. 从路由参数解析赛事 ID
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: '缺少赛事ID' })

    // 读取请求体
    const body = await readBody<{ fields: RegistrationFieldInput[] }>(event)
    if (!body || !Array.isArray(body.fields)) {
      throw createError({ statusCode: 400, statusMessage: '缺少fields参数或格式不正确' })
    }

    // 2. 权限校验：系统管理员 或 该赛事所属团队的管理员
    await requireWriteTournament(event, prisma, id)

    // 3. 整体替换：先删除该赛事下所有已存在的报名字段
    await prisma.registrationField.deleteMany({ where: { tournamentId: id } })

    // 4. 过滤掉 fieldName 为空的记录，构造待创建数据
    const toCreate = body.fields
      .filter((f) => (f.fieldName || '').trim() !== '')
      .map((f) => ({
        tournamentId: id,
        fieldName: f.fieldName.trim(),
        fieldKey: f.fieldKey,
        fieldType: f.fieldType || 'text',
        fieldOptions: f.fieldOptions ?? null,
        required: !!f.required,
        sortOrder: typeof f.sortOrder === 'number' ? f.sortOrder : 0,
        appliesTo: f.appliesTo || 'both',
      }))

    // 批量创建新字段
    if (toCreate.length > 0) {
      await prisma.registrationField.createMany({ data: toCreate })
    }

    // 5. 返回成功
    return { success: true }
  } catch (error: any) {
    // 已知错误（如权限/参数校验）直接抛出
    if (error.statusCode) throw error
    console.error('Update registration fields error:', error)
    throw createError({ statusCode: 500, statusMessage: '更新报名字段失败' })
  }
})
