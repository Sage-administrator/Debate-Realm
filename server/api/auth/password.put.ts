import { readBody } from 'h3'
import { prisma } from '../../lib/prisma'
import { comparePassword, hashPassword } from '../../lib/jwt'
import { getUserFromEvent } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const user = getUserFromEvent(event)
    const { oldPassword, newPassword } = await readBody<{ oldPassword: string; newPassword: string }>(event)

    if (!oldPassword || !newPassword) {
      throw createError({ statusCode: 400, statusMessage: '旧密码和新密码不能为空' })
    }

    if (newPassword.length < 6) {
      throw createError({ statusCode: 400, statusMessage: '新密码长度至少6位' })
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
    })

    if (!dbUser) {
      throw createError({ statusCode: 404, statusMessage: '用户不存在' })
    }

    const isValid = await comparePassword(oldPassword, dbUser.password)
    if (!isValid) {
      throw createError({ statusCode: 401, statusMessage: '旧密码错误' })
    }

    const hashedPassword = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { password: hashedPassword },
    })

    return { message: '密码修改成功' }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Change password error:', error)
    throw createError({ statusCode: 500, statusMessage: '修改密码失败' })
  }
})
