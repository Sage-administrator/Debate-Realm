import { readBody } from 'h3'
import { prisma } from '../../lib/prisma'
import { getUserFromEventWithSession } from '../../utils/auth'
import { canWriteTournament } from '../../utils/tournament-auth'

export default defineEventHandler(async (event) => {
  try {
    // 修复：使用 getUserFromEventWithSession 校验 tokenVersion，
    // 否则被踢下线的旧 token 在 7 天过期前仍可删除比赛
    const user = await getUserFromEventWithSession(event, prisma)
    const id = getRouterParam(event, 'id')!

    // 读取请求体（含 currentVersion 和可选 deleteReason
    const body = (await readBody<{ currentVersion?: number; deleteReason?: string }>(event)) || {}

    // 1. 查找比赛（含所属 tournament 信息，用于权限校验）
    // 修复：使用 findFirst + deletedAt: null 过滤软删除记录
    const match = await prisma.match.findFirst({
      where: { id, deletedAt: null },
      include: { tournament: { include: { team: true } } },
    })

    if (!match) {
      throw createError({ statusCode: 404, message: '40001场次不存在或已删除' })
    }

    // 2. 权限校验：使用统一的权限判定函数
    if (!match.tournament || !canWriteTournament(user, match.tournament, match.tournament.team)) {
      throw createError({ statusCode: 403, message: '40003权限不足' })
    }

    // 3. 禁止删除已晋级比赛的校验：查询所有 match 中 promotedFromA === id 或 promotedFromB === id 的记录
    const dependentMatches = await prisma.match.findMany({
      where: {
        deletedAt: null,
        OR: [{ promotedFromA: id }, { promotedFromB: id }],
      },
    })

    if (dependentMatches.length > 0) {
      const dependentInfo = dependentMatches.map((m) => `第${m.orderNum}场`).join('、')
      throw createError({
        statusCode: 400,
        message: `40004需先撤销${dependentInfo}的晋级关系`,
      })
    }

    // 4. 乐观锁校验
    const currentVersion = body.currentVersion
    if (currentVersion !== undefined && currentVersion !== match.version) {
      throw createError({
        statusCode: 409,
        message: `40002版本冲突：当前版本为 ${match.version}，请刷新后重试`,
      })
    }

    // 5. 软删除：使用 prisma.match.updateMany() 同时更新 { deletedAt, deletedBy, deleteReason, version: {increment:1} }，条件为 {id, version: currentVersion}
    const now = new Date()
    const updateResult = await prisma.match.updateMany({
      where: {
        id,
        deletedAt: null,
        version: currentVersion !== undefined ? currentVersion : match.version,
      },
      data: {
        deletedAt: now,
        deletedBy: user.userId,
        deleteReason: body.deleteReason || '',
        version: { increment: 1 },
      },
    })

    if (updateResult.count === 0) {
      throw createError({
        statusCode: 409,
        message: '40002版本冲突：记录已被其他操作修改',
      })
    }

    // 6. 返回统一响应格式
    return {
      code: 0,
      message: 'success',
      data: {
        match: {
          id,
          status: 'deleted',
          version: (currentVersion !== undefined ? currentVersion : match.version) + 1,
          deletedAt: now,
        },
      },
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Delete match error:', error)
    throw createError({ statusCode: 500, message: '50000删除场次失败' })
  }
})
