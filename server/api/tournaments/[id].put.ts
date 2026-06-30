import { readBody } from 'h3'
import { prisma } from '../../lib/prisma'
import { requireWriteTournament } from '../../utils/tournament-auth'

// 更新赛事接口：支持更新基础信息 + 队伍列表 + 评委列表
export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id') as string

    // 读取请求体
    const body = await readBody<{
      name?: string; description?: string; format?: string; status?: string; scheduledAt?: string; venue?: string;
      teams?: string[]; judges?: string[];
    }>(event)

    const { name, description, format, status, scheduledAt, venue, teams, judges } = body

    // 权限校验：系统管理员 或 该赛事所属团队的管理员
    const { tournament } = await requireWriteTournament(event, prisma, id)

    // 更新基础信息
    const hasBasicUpdate = name !== undefined || description !== undefined || format !== undefined
      || status !== undefined || scheduledAt !== undefined || venue !== undefined
    if (hasBasicUpdate) {
      await prisma.tournament.update({
        where: { id },
        data: {
          name: name ?? tournament.name,
          description: description !== undefined ? description : tournament.description,
          format: format ?? tournament.format,
          status: status ?? tournament.status,
          scheduledAt: scheduledAt !== undefined ? (scheduledAt ? new Date(scheduledAt) : null) : tournament.scheduledAt,
          venue: venue !== undefined ? venue : tournament.venue,
        },
      })
    }

    // 更新队伍列表（整体替换：先删除旧的，再创建新的）
    if (teams !== undefined) {
      await prisma.tournamentTeam.deleteMany({ where: { tournamentId: id } })
      // 去重，保留顺序
      const seen = new Set<string>()
      const uniqueTeams: string[] = []
      for (const n of teams) {
        const trimmed = (n || '').trim()
        if (!trimmed || seen.has(trimmed)) continue
        seen.add(trimmed)
        uniqueTeams.push(trimmed)
      }
      if (uniqueTeams.length > 0) {
        await prisma.tournamentTeam.createMany({
          data: uniqueTeams.map((teamName, i) => ({ tournamentId: id, name: teamName, orderNum: i + 1 })),
        })
      }
    }

    // 更新评委列表（整体替换）
    if (judges !== undefined) {
      await prisma.tournamentJudge.deleteMany({ where: { tournamentId: id } })
      const seen = new Set<string>()
      const uniqueJudges: string[] = []
      for (const n of judges) {
        const trimmed = (n || '').trim()
        if (!trimmed || seen.has(trimmed)) continue
        seen.add(trimmed)
        uniqueJudges.push(trimmed)
      }
      if (uniqueJudges.length > 0) {
        await prisma.tournamentJudge.createMany({
          data: uniqueJudges.map((judgeName, i) => ({ tournamentId: id, name: judgeName, orderNum: i + 1 })),
        })
      }
    }

    return { success: true, message: '更新成功' }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Update tournament error:', error)
    throw createError({ statusCode: 500, statusMessage: '更新赛事信息失败' })
  }
})
