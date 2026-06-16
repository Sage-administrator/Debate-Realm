import { readBody } from 'h3'
import { prisma } from '../../../lib/prisma'
import { getUserFromEvent } from '../../../utils/auth'
import { generateShortId } from '../../../utils/id'

export default defineEventHandler(async (event) => {
  try {
    const user = getUserFromEvent(event)
    const teamId = getRouterParam(event, 'teamId')!
    const { name, description, format, scheduledAt, venue, teams, judges } = await readBody<{
      name: string; description?: string; format: string
      scheduledAt?: string; venue?: string; teams?: string[]; judges?: string[]
    }>(event)

    if (!name) throw createError({ statusCode: 400, statusMessage: '赛事名称不能为空' })
    if (!['knockout', 'round_robin'].includes(format)) throw createError({ statusCode: 400, statusMessage: '无效的赛制' })

    const team = await prisma.team.findUnique({ where: { id: teamId } })
    if (!team) throw createError({ statusCode: 404, statusMessage: '团队不存在' })

    if (user.role !== 'system_admin' && team.adminId !== user.userId) {
      throw createError({ statusCode: 403, statusMessage: '权限不足' })
    }

    // 生成7位短ID并查重
    let shortId = generateShortId()
    while (await prisma.tournament.findUnique({ where: { id: shortId } })) {
      shortId = generateShortId()
    }

    const tournament = await prisma.tournament.create({
      data: {
        id: shortId,
        teamId, name,
        description: description || null,
        format,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        venue: venue || null,
        status: 'pending',
      },
    })

    if (teams && Array.isArray(teams)) {
      await prisma.tournamentTeam.createMany({ data: teams.map((n: string) => ({ tournamentId: tournament.id, name: n })) })
    }
    if (judges && Array.isArray(judges)) {
      await prisma.tournamentJudge.createMany({ data: judges.map((n: string) => ({ tournamentId: tournament.id, name: n })) })
    }

    setResponseStatus(event, 201)
    return {
      id: tournament.id, name: tournament.name, description: tournament.description,
      format: tournament.format, status: tournament.status,
      scheduledAt: tournament.scheduledAt, venue: tournament.venue, createdAt: tournament.createdAt,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Create tournament error:', error)
    throw createError({ statusCode: 500, statusMessage: '创建赛事失败' })
  }
})
