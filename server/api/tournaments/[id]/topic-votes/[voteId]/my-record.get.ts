import { prisma } from '../../../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../../../utils/auth'

// 查询当前登录用户在某投票中的投票记录（用于前端判断"是否已投票"）
// 未登录时返回 null
export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id') as string
    const voteId = getRouterParam(event, 'voteId') as string

    // 1. 可选鉴权
    let user
    try {
      user = await getUserFromEventWithSession(event, prisma)
    } catch {
      return { record: null }
    }

    // 2. 查询该用户在此投票中的记录
    const record = await prisma.topicVoteRecord.findFirst({
      where: { voteId, userId: user.userId },
      select: { id: true, topicIndices: true, voterType: true, createdAt: true },
    })

    if (!record) return { record: null }

    return {
      record: {
        id: record.id,
        topicIndices: JSON.parse(record.topicIndices),
        voterType: record.voterType,
        createdAt: record.createdAt,
      },
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Get my vote record error:', error)
    throw createError({ statusCode: 500, message: '查询投票记录失败' })
  }
})
