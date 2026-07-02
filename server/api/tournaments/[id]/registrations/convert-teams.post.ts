// =====================================================================
// 报名记录转参赛队伍 API
// POST /api/tournaments/{id}/registrations/convert-teams
// 功能：
//   - 管理员确认自动组队结果 / 队伍报名后，将一批报名记录合并为 TournamentTeam
//   - 每支队伍创建一条 TournamentTeam 记录，并回填各 Registration.convertedTeamId
//   - 整个操作在事务内完成，保证原子性
// 请求体：
//   {
//     items: [
//       { name: string, registrationIds: string[] }
//     ]
//   }
// 返回：
//   { success: true, created: number }
// =====================================================================

import { createError } from 'h3'
import { prisma } from '../../../../lib/prisma'
import { requireWriteTournament } from '../../../../utils/tournament-auth'

export default defineEventHandler(async (event) => {
  try {
    // 1. 解析赛事 ID 并鉴权（系统管理员或赛事所属团队管理员）
    const id = getRouterParam(event, 'id') as string
    await requireWriteTournament(event, prisma, id)

    // 2. 读取请求体：items 数组，每项含队伍名 + 报名记录 ID 列表
    const body = await readBody<{
      items: { name: string; registrationIds: string[] }[]
    }>(event)

    // 3. 基础校验：items 必须是非空数组
    if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
      throw createError({ statusCode: 400, statusMessage: '缺少 items 或 items 为空' })
    }

    // 4. 校验每个 item 的字段合法性
    for (const item of body.items) {
      if (!item.name || !item.name.trim()) {
        throw createError({ statusCode: 400, statusMessage: '队伍名称不能为空' })
      }
      if (!Array.isArray(item.registrationIds) || item.registrationIds.length === 0) {
        throw createError({ statusCode: 400, statusMessage: '每支队伍至少需要 1 条报名记录' })
      }
    }

    // 5. 归属校验：所有 registrationId 必须属于本赛事且尚未转换
    const allRegIds = body.items.flatMap((it) => it.registrationIds)
    const existingRegs = await prisma.registration.findMany({
      where: { id: { in: allRegIds } },
      select: { id: true, tournamentId: true, convertedTeamId: true },
    })
    const existingMap = new Map(existingRegs.map((r) => [r.id, r]))

    for (const regId of allRegIds) {
      const reg = existingMap.get(regId)
      if (!reg) {
        throw createError({ statusCode: 404, statusMessage: `报名记录不存在: ${regId}` })
      }
      if (reg.tournamentId !== id) {
        throw createError({ statusCode: 400, statusMessage: `报名记录不属于本赛事: ${regId}` })
      }
      if (reg.convertedTeamId) {
        throw createError({ statusCode: 400, statusMessage: `报名记录已转换为参赛队伍: ${regId}` })
      }
    }

    // 6. 事务：逐个创建 TournamentTeam 并回填 Registration.convertedTeamId
    const created = await prisma.$transaction(async (tx) => {
      let count = 0
      for (const item of body.items) {
        // 6a. 创建参赛队伍
        const team = await tx.tournamentTeam.create({
          data: {
            tournamentId: id,
            name: item.name.trim(),
          },
        })
        // 6b. 回填各报名记录的 convertedTeamId，标记已转换
        await tx.registration.updateMany({
          where: { id: { in: item.registrationIds } },
          data: { convertedTeamId: team.id },
        })
        count++
      }
      return count
    })

    // 7. 返回创建结果
    return {
      success: true,
      created,
    }
  } catch (error: any) {
    // 已知的业务错误（含鉴权 / 校验抛出的 createError）直接抛出
    if (error.statusCode) throw error
    console.error('Convert teams error:', error)
    throw createError({ statusCode: 500, statusMessage: '转换为参赛队伍失败' })
  }
})
