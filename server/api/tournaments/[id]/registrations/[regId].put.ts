import { readBody } from 'h3'
import { prisma } from '../../../../lib/prisma'
import { requireWriteTournament } from '../../../../utils/tournament-auth'

// 管理端：审核（通过 / 拒绝）某条报名记录
export default defineEventHandler(async (event) => {
  try {
    // 1. 解析路由参数：赛事 ID + 报名记录 ID
    const id = getRouterParam(event, 'id') as string
    const regId = getRouterParam(event, 'regId') as string

    // 2. 鉴权：系统管理员或该赛事所属团队的管理员才可审核
    const { user, tournament } = await requireWriteTournament(event, prisma, id)

    // 3. 读取请求体：action（approve/reject）+ 可选 reviewNote
    const body = await readBody<{
      action: 'approve' | 'reject'
      reviewNote?: string
    }>(event)

    const { action, reviewNote } = body

    // 4. 校验 action 取值合法
    if (action !== 'approve' && action !== 'reject') {
      throw createError({ statusCode: 400, statusMessage: 'action 必须为 approve 或 reject' })
    }

    // 5. 查找该报名记录（须同时满足 regId 与 tournamentId，确保归属正确）
    const registration = await prisma.registration.findFirst({
      where: { id: regId, tournamentId: id },
    })

    // 6. 记录不存在则返回 404
    if (!registration) {
      throw createError({ statusCode: 404, statusMessage: '报名记录不存在' })
    }

    // 7. 已审核（非 pending）则拒绝重复审核
    if (registration.status !== 'pending') {
      throw createError({ statusCode: 400, statusMessage: '该报名已审核' })
    }

    // 8. 映射为新状态值
    const newStatus = action === 'approve' ? 'approved' : 'rejected'

    // 9. 更新报名记录：写入审核状态、审核时间、审核人、审核备注
    await prisma.registration.update({
      where: { id: regId },
      data: {
        status: newStatus,
        reviewedAt: new Date(),
        reviewedBy: user.userId,
        reviewNote: reviewNote?.trim() || null,
      },
    })

    // 10. 返回审核结果
    return { success: true, status: newStatus }
  } catch (error: any) {
    // 已知的业务错误（含鉴权 / 校验抛出的 createError）直接抛出
    if (error.statusCode) throw error
    console.error('Review registration error:', error)
    throw createError({ statusCode: 500, statusMessage: '审核报名失败' })
  }
})
