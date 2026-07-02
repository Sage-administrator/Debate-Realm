// 更新赛事的报名设置（管理员接口）
// 鉴权：系统管理员 或 该赛事所属团队的管理员（requireWriteTournament）
import { createError } from 'h3'
import { prisma } from '../../../lib/prisma'
import { requireWriteTournament } from '../../../utils/tournament-auth'

export default defineEventHandler(async (event) => {
  // 1. 从路由参数中解析赛事 ID
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: '缺少赛事ID' })

  // 2. 读取请求体
  const body = await readBody(event)
  if (!body) throw createError({ statusCode: 400, statusMessage: '缺少请求体' })

  // 3. 权限校验：requireWriteTournament 会在赛事不存在时抛 404、无权限时抛 403
  await requireWriteTournament(event, prisma, id)

  // 4. 解析需要更新的字段（仅允许白名单内的字段透传到数据库）
  const {
    registrationOpen,
    registrationDeadline,
    isPublic,
    teamSize,
    registrationInfo,
  } = body

  // 构造更新数据对象，仅包含明确传入的字段
  const updateData: {
    registrationOpen?: boolean
    registrationDeadline?: Date | null
    isPublic?: boolean
    teamSize?: number | null
    registrationInfo?: string | null
  } = {}

  if (typeof registrationOpen === 'boolean') {
    updateData.registrationOpen = registrationOpen
  }
  if (registrationDeadline !== undefined) {
    // 允许传入 ISO 字符串设置截止时间，或 null 清除截止时间
    updateData.registrationDeadline = registrationDeadline
      ? new Date(registrationDeadline)
      : null
  }
  if (typeof isPublic === 'boolean') {
    updateData.isPublic = isPublic
  }
  if (teamSize !== undefined) {
    // 允许传入数字设置人数要求，或 null 清除要求
    updateData.teamSize = typeof teamSize === 'number' ? teamSize : null
  }
  if (registrationInfo !== undefined) {
    updateData.registrationInfo =
      typeof registrationInfo === 'string' ? registrationInfo : null
  }

  // 5. 执行更新（select 仅返回报名相关字段）
  const updated = await prisma.tournament.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      registrationOpen: true,
      registrationDeadline: true,
      isPublic: true,
      teamSize: true,
      registrationInfo: true,
    },
  })

  // 6. 返回更新后的报名设置
  return {
    data: updated,
  }
})
