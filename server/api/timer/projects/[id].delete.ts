import { prisma } from '../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../utils/auth'

// DELETE /api/timer/projects/[id] — 删除计时器项目
export default defineEventHandler(async (event) => {
  const payload = await getUserFromEventWithSession(event, prisma)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: '缺少项目ID' })

  // 检查项目是否存在且属于当前用户
  const existing = await prisma.debateTimerProject.findUnique({
    where: { id },
    select: { userId: true },
  })

  if (!existing) {
    throw createError({ statusCode: 404, message: '项目不存在' })
  }
  if (existing.userId !== payload.userId) {
    throw createError({ statusCode: 403, message: '无权删除此项目' })
  }

  // 删除项目（级联删除会自动清理所有环节）
  await prisma.debateTimerProject.delete({
    where: { id },
  })

  return { success: true, message: '已删除' }
})
