import { readBody } from 'h3'
import { prisma } from '../../lib/prisma'
import { generateToken, comparePassword } from '../../lib/jwt'

export default defineEventHandler(async (event) => {
  try {
    const { username, password } = await readBody<{ username: string; password: string }>(event)

    if (!username || !password) {
      throw createError({ statusCode: 400, statusMessage: '用户名和密码不能为空' })
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: { team: true },
    })

    if (!user) {
      throw createError({ statusCode: 401, statusMessage: '用户名或密码错误' })
    }

    const isValid = await comparePassword(password, user.password)
    if (!isValid) {
      throw createError({ statusCode: 401, statusMessage: '用户名或密码错误' })
    }

    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      mode: user.mode,
    })

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        mode: user.mode,
        team: user.team
          ? {
              id: user.team.id,
              name: user.team.name,
              mode: user.team.mode,
            }
          : null,
      },
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Login error:', error)
    throw createError({ statusCode: 500, statusMessage: '登录失败' })
  }
})
