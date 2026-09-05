import { readBody } from 'h3'
import { prisma } from '../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../utils/auth'
import { canWriteTournament } from '../../../utils/tournament-auth'

export default defineEventHandler(async (event) => {
  try {
    // 修复：使用 getUserFromEventWithSession 校验 tokenVersion
    const user = await getUserFromEventWithSession(event, prisma)
    const id = getRouterParam(event, 'id')!

    // 读取请求体的 currentVersion
    const body = (await readBody<{ currentVersion?: number }>(event)) || {}

    // 2. 读取比赛，确保 deletedAt 不为 null（已删除）
    const match = await prisma.match.findUnique({
      where: { id },
      include: { tournament: { include: { team: true } } },
    })

    if (!match) {
      throw createError({ statusCode: 404, message: '40001场次不存在' })
    }

    if (!match.deletedAt) {
      throw createError({ statusCode: 400, message: '40005场次未处于删除状态，无需恢复' })
    }

    // 权限校验：使用统一的权限判定函数
    if (!match.tournament || !canWriteTournament(user, match.tournament, match.tournament.team)) {
      throw createError({ statusCode: 403, message: '40003权限不足' })
    }

    // 3. 读取请求体的 currentVersion，做乐观锁校验
    const currentVersion = body.currentVersion
    if (currentVersion !== undefined && currentVersion !== match.version) {
      throw createError({
        statusCode: 409,
        message: `40002版本冲突：当前版本为 ${match.version}，请刷新后重试`,
      })
    }

    // 4. 使用 prisma.match.updateMany() 同时清除 deletedAt/deletedBy/deleteReason，version+1
    const updateResult = await prisma.match.updateMany({
      where: {
        id,
        version: currentVersion !== undefined ? currentVersion : match.version,
      },
      data: {
        deletedAt: null,
        deletedBy: null,
        deleteReason: null,
        version: { increment: 1 },
      },
    })

    if (updateResult.count === 0) {
      throw createError({
        statusCode: 409,
        message: '40002版本冲突：记录已被其他操作修改',
      })
    }

    // 5. 返回统一响应格式
    return {
      code: 0,
      message: 'success',
      data: {
        match: {
          id,
          deletedAt: null,
          version: (currentVersion !== undefined ? currentVersion : match.version) + 1,
        },
      },
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Restore match error:', error)
    throw createError({ statusCode: 500, message: '50000恢复场次失败' })
  }
})
