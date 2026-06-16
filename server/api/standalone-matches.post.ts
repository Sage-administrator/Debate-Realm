import { readBody } from 'h3'
import { prisma } from '../lib/prisma'
import { getUserFromEvent } from '../utils/auth'
import { generateShortId } from '../utils/id'

export default defineEventHandler(async (event) => {
  try {
    const user = getUserFromEvent(event)
    const { name, description, scheduledAt } = await readBody<{ name: string; description?: string; scheduledAt?: string }>(event)

    if (!name) throw createError({ statusCode: 400, statusMessage: '赛事名称不能为空' })
    if (user.mode !== 'individual') throw createError({ statusCode: 403, statusMessage: '只有个人用户可以创建独立赛事' })

    // 生成7位短ID并查重
    let shortId = generateShortId()
    while (await prisma.standaloneMatch.findUnique({ where: { id: shortId } })) {
      shortId = generateShortId()
    }

    const match = await prisma.standaloneMatch.create({
      data: {
        id: shortId,
        userId: user.userId, name,
        description: description || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: 'pending',
      },
    })

    setResponseStatus(event, 201)
    return {
      id: match.id, name: match.name, description: match.description,
      status: match.status, scheduledAt: match.scheduledAt, createdAt: match.createdAt,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Create standalone match error:', error)
    throw createError({ statusCode: 500, statusMessage: '创建独立赛事失败' })
  }
})
