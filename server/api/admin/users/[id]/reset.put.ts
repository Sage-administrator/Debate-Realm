import { readBody } from 'h3'
import { prisma } from '../../../../lib/prisma'
import { hashPassword } from '../../../../lib/jwt'
import { requireRole } from '../../../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    requireRole(event, 'system_admin')

    const id = getRouterParam(event, 'id')!
    const { newPassword } = await readBody<{ newPassword: string }>(event)

    if (!newPassword) {
      throw createError({ statusCode: 400, statusMessage: '新密码不能为空' })
    }

    if (newPassword.length < 6) {
      throw createError({ statusCode: 400, statusMessage: '密码长度至少6位' })
    }

    const user = await prisma.user.findUnique({ where: { id } })

    if (!user) {
      throw createError({ statusCode: 404, statusMessage: '用户不存在' })
    }

    const hashedPassword = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    })

    return { message: '密码重置成功' }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Reset password error:', error)
    throw createError({ statusCode: 500, statusMessage: '重置密码失败' })
  }
})
