import { readBody } from 'h3'
import { prisma } from '../../lib/prisma'
import { getUserFromEvent } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const user = getUserFromEvent(event)
    const id = getRouterParam(event, 'id')!
    const { name, description, format, status, scheduledAt, venue } = await readBody<{
      name?: string; description?: string; format?: string; status?: string; scheduledAt?: string; venue?: string
    }>(event)

    const tournament = await prisma.tournament.findUnique({
      where: { id }, include: { team: true },
    })

    if (!tournament) throw createError({ statusCode: 404, statusMessage: '赛事不存在' })

    if (user.role !== 'system_admin' && tournament.team.adminId !== user.userId) {
      throw createError({ statusCode: 403, statusMessage: '权限不足' })
    }

    const updated = await prisma.tournament.update({
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

    return {
      id: updated.id, name: updated.name, description: updated.description,
      format: updated.format, status: updated.status,
      scheduledAt: updated.scheduledAt, venue: updated.venue, createdAt: updated.createdAt,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Update tournament error:', error)
    throw createError({ statusCode: 500, statusMessage: '更新赛事信息失败' })
  }
})
