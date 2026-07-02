// 获取赛事的报名配置（公开接口，无需鉴权）
// 返回：赛事基础信息 + 报名设置 + 自定义报名字段
import { prisma } from '../../../lib/prisma'

export default defineEventHandler(async (event) => {
  // 1. 从路由参数中解析赛事 ID
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: '缺少赛事ID' })

  // 2. 查询赛事基础信息与报名设置（仅 select 所需字段，避免泄露敏感数据）
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: {
      // 赛事基础信息
      id: true,
      name: true,
      description: true,
      format: true,
      venue: true,
      scheduledAt: true,
      // 报名系统配置字段
      registrationOpen: true,
      registrationDeadline: true,
      isPublic: true,
      teamSize: true,
      registrationInfo: true,
    },
  })

  // 3. 赛事不存在则返回 404
  if (!tournament) {
    throw createError({ statusCode: 404, statusMessage: '赛事不存在' })
  }

  // 4. 查询该赛事的自定义报名字段，按 sortOrder 升序排列
  const registrationFields = await prisma.registrationField.findMany({
    where: { tournamentId: id },
    orderBy: { sortOrder: 'asc' },
  })

  // 5. 组合并返回完整的报名配置
  return {
    // 赛事基础信息
    id: tournament.id,
    name: tournament.name,
    description: tournament.description,
    format: tournament.format,
    venue: tournament.venue,
    scheduledAt: tournament.scheduledAt,
    // 报名设置
    registrationOpen: tournament.registrationOpen,
    registrationDeadline: tournament.registrationDeadline,
    isPublic: tournament.isPublic,
    teamSize: tournament.teamSize,
    registrationInfo: tournament.registrationInfo,
    // 自定义报名字段
    fields: registrationFields.map((f) => ({
      id: f.id,
      fieldName: f.fieldName,
      fieldKey: f.fieldKey,
      fieldType: f.fieldType,
      fieldOptions: f.fieldOptions,
      required: f.required,
      sortOrder: f.sortOrder,
      appliesTo: f.appliesTo,
    })),
  }
})
