import { readBody } from 'h3'
import { prisma } from '../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../utils/auth'
import { generateShortId } from '../../../utils/id'
import { notifyTournamentCreate } from '../../../lib/bot-notifications'

export default defineEventHandler(async (event) => {
  try {
    // 修复：使用 getUserFromEventWithSession 校验 tokenVersion
    const user = await getUserFromEventWithSession(event, prisma)
    const teamId = getRouterParam(event, 'teamId')!
    const { name, description, format, scheduledAt, venue, teams, judges } = await readBody<{
      name: string
      description?: string
      format?: string // format 非必填：赛程页可选择
      scheduledAt?: string
      venue?: string
      teams?: string[]
      judges?: string[]
    }>(event)

    if (!name) throw createError({ statusCode: 400, message: '赛事名称不能为空' })
    // 允许的赛制值；空值时默认为 ''（用户将在赛程页选择具体赛制）
    const validFormats = [
      '',
      'manual',
      'knockout',
      'knockout:single',
      'knockout:double',
      'round_robin',
      'round_robin:single',
      'round_robin:double',
      'page',
      'swiss',
      'group_knockout',
    ]
    const formatToSave = validFormats.includes(format || '') ? format || '' : ''

    const team = await prisma.team.findUnique({ where: { id: teamId } })
    if (!team) throw createError({ statusCode: 404, message: '团队不存在' })

    if (user.role !== 'system_admin' && team.adminId !== user.userId) {
      throw createError({ statusCode: 403, message: '权限不足' })
    }

    // 生成8位短ID并查重
    let shortId = generateShortId()
    while (await prisma.tournament.findUnique({ where: { id: shortId } })) {
      shortId = generateShortId()
    }

    const tournament = await prisma.tournament.create({
      data: {
        id: shortId,
        teamId,
        name,
        description: description || null,
        format: formatToSave,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        venue: venue || null,
        status: 'pending',
      },
    })

    if (teams && Array.isArray(teams)) {
      await prisma.tournamentTeam.createMany({
        data: teams.map((n: string) => ({ tournamentId: tournament.id, name: n })),
      })
    }
    if (judges && Array.isArray(judges)) {
      await prisma.tournamentJudge.createMany({
        data: judges.map((n: string) => ({ tournamentId: tournament.id, name: n })),
      })
    }

    // 通过 Bot 发送赛事创建通知（异步，不阻塞响应）
    notifyTournamentCreate(prisma, tournament.id).catch((err) => {
      console.error('[Tournament Create] Bot 通知发送失败:', err)
    })

    setResponseStatus(event, 201)
    return {
      id: tournament.id,
      name: tournament.name,
      description: tournament.description,
      format: tournament.format,
      status: tournament.status,
      scheduledAt: tournament.scheduledAt,
      venue: tournament.venue,
      createdAt: tournament.createdAt,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Create tournament error:', error)
    throw createError({ statusCode: 500, message: '创建赛事失败' })
  }
})
