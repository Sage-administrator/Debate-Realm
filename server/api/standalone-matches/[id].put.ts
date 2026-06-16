import { readBody } from 'h3'
import { prisma } from '../../lib/prisma'
import { getUserFromEvent } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const user = getUserFromEvent(event)
    const id = getRouterParam(event, 'id')!
    const { name, description, status, scheduledAt } = await readBody<{
      name?: string; description?: string; status?: string; scheduledAt?: string
    }>(event)

    const match = await prisma.standaloneMatch.findUnique({ where: { id } })
    if (!match) throw createError({ statusCode: 404, statusMessage: '独立赛事不存在' })
    if (match.userId !== user.userId) throw createError({ statusCode: 403, statusMessage: '权限不足' })

    const updated = await prisma.standaloneMatch.update({
      where: { id },
      data: {
        name: name ?? match.name,
        description: description !== undefined ? description : match.description,
        status: status ?? match.status,
        scheduledAt: scheduledAt !== undefined ? (scheduledAt ? new Date(scheduledAt) : null) : match.scheduledAt,
      },
    })

    return {
      id: updated.id, name: updated.name, description: updated.description,
      status: updated.status, scheduledAt: updated.scheduledAt, createdAt: updated.createdAt,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Update standalone match error:', error)
    throw createError({ statusCode: 500, statusMessage: '更新独立赛事失败' })
  }
})
