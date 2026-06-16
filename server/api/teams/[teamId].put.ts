import { readBody } from 'h3'
import { prisma } from '../../lib/prisma'
import { getUserFromEvent } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const currentUser = getUserFromEvent(event)
    const id = getRouterParam(event, 'teamId')!
    const { name, botAppId, botAppSecret, botChannelId } = await readBody<{
      name?: string
      botAppId?: string | null
      botAppSecret?: string | null
      botChannelId?: string | null
    }>(event)

    const team = await prisma.team.findUnique({ where: { id } })

    if (!team) {
      throw createError({ statusCode: 404, statusMessage: '团队不存在' })
    }

    // 检查权限
    if (currentUser.role !== 'system_admin' && team.adminId !== currentUser.userId) {
      throw createError({ statusCode: 403, statusMessage: '权限不足' })
    }

    const updatedTeam = await prisma.team.update({
      where: { id },
      data: {
        name: name ?? team.name,
        botAppId: botAppId !== undefined ? botAppId : team.botAppId,
        botAppSecret: botAppSecret !== undefined ? botAppSecret : team.botAppSecret,
        botChannelId: botChannelId !== undefined ? botChannelId : team.botChannelId,
      },
    })

    return {
      id: updatedTeam.id,
      name: updatedTeam.name,
      mode: updatedTeam.mode,
      botConfig: {
        botAppId: updatedTeam.botAppId,
        botChannelId: updatedTeam.botChannelId,
      },
      createdAt: updatedTeam.createdAt,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Update team error:', error)
    throw createError({ statusCode: 500, statusMessage: '更新团队信息失败' })
  }
})
