import { prisma } from '../../lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'teamId')!

    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: true },
        },
        tournaments: {
          select: { id: true, name: true, status: true },
        },
        _count: {
          select: { users: true },
        },
      },
    })

    if (!team) {
      throw createError({ statusCode: 404, message: '团队不存在' })
    }

    return {
      id: team.id,
      name: team.name,
      mode: team.mode,
      botConfig: {
        botAppId: team.botAppId,
        botChannelId: team.botChannelId,
      },
      members: team.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        username: m.user.username,
        nickname: m.user.nickname,
        email: m.user.email,
        avatar: m.user.avatar,
        role: m.user.role,
      })),
      memberCount: team._count.users,
      tournaments: team.tournaments,
      createdAt: team.createdAt,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Get team error:', error)
    throw createError({ statusCode: 500, message: '获取团队详情失败' })
  }
})
