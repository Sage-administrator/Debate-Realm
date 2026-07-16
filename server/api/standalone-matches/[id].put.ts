import { readBody } from 'h3'
import { prisma } from '../../lib/prisma'
import { getUserFromEventWithSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const user = await getUserFromEventWithSession(event, prisma)
    const id = getRouterParam(event, 'id')!
    const { name, description, venue, status, scheduledAt } = await readBody<{
      name?: string; description?: string; venue?: string; status?: string; scheduledAt?: string
    }>(event)

    const match = await prisma.standaloneMatch.findUnique({ where: { id } })
    if (!match) throw createError({ statusCode: 404, message: '独立赛事不存在' })
    if (match.userId !== user.userId) throw createError({ statusCode: 403, message: '权限不足' })

    const updated = await prisma.standaloneMatch.update({
      where: { id },
      data: {
        name: name ?? match.name,
        description: description !== undefined ? description : match.description,
        venue: venue !== undefined ? venue : match.venue,
        status: status ?? match.status,
        scheduledAt: scheduledAt !== undefined ? (scheduledAt ? new Date(scheduledAt) : null) : match.scheduledAt,
      },
    })

    return {
      id: updated.id, name: updated.name, description: updated.description, venue: updated.venue,
      status: updated.status, scheduledAt: updated.scheduledAt, createdAt: updated.createdAt,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Update standalone match error:', error)
    throw createError({ statusCode: 500, message: '更新独立赛事失败' })
  }
})
