// =====================================================================
// 佳辩设置 API —— 保存最佳辩手模式等赛果配置
// POST /api/tournaments/{id}/result-settings
//
// 请求体：
//   {
//     bestDebaterMode: 'both' | 'winner_only'   // 最佳辩手评选方式
//   }
// =====================================================================

import { readBody, createError } from 'h3'
import { prisma } from '../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const user = await getUserFromEventWithSession(event, prisma)
    const id = getRouterParam(event, 'id')!

    const body = await readBody<{
      bestDebaterMode: 'both' | 'winner_only'
    }>(event)

    // 1) 加载赛事（含团队信息，用于权限校验）
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: { team: true },
    })
    if (!tournament) {
      throw createError({ statusCode: 404, message: '赛事不存在' })
    }

    // 2) 权限校验：system_admin 或所属团队的管理员（team.adminId 是创建团队的用户ID）
    if (user.role !== 'system_admin' && user.userId !== tournament.team?.adminId) {
      throw createError({ statusCode: 403, message: '权限不足' })
    }

    // 3) 校验参数
    const validModes = ['both', 'winner_only']
    const bestDebaterMode = validModes.includes(body.bestDebaterMode) ? body.bestDebaterMode : 'both'

    // 4) 更新赛事配置
    await prisma.tournament.update({
      where: { id },
      data: { bestDebaterMode },
    })

    return { success: true, bestDebaterMode }
  } catch (error: any) {
    if (error.statusCode) throw error
    const errMsg = error instanceof Error ? `${error.message}\n${error.stack}` : String(error)
    console.error('[result-settings] 保存失败:', errMsg)
    throw createError({ statusCode: 500, message: error?.message || error?.toString() || '保存失败' })
}
})
