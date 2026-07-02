import { readBody } from 'h3'
import { prisma } from '../../../lib/prisma'
import { hashPassword } from '../../../lib/jwt'
import { getUserFromEventWithSession } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // 修复：使用 getUserFromEventWithSession 校验 tokenVersion
    const currentUser = await getUserFromEventWithSession(event, prisma)
    const id = getRouterParam(event, 'teamId')!
    const { username, password } = await readBody<{ username: string; password: string }>(event)

    if (!username || !password) {
      throw createError({ statusCode: 400, statusMessage: '用户名和密码不能为空' })
    }

    if (password.length < 6) {
      throw createError({ statusCode: 400, statusMessage: '密码长度至少6位' })
    }

    const team = await prisma.team.findUnique({ where: { id } })

    if (!team) {
      throw createError({ statusCode: 404, statusMessage: '团队不存在' })
    }

    if (currentUser.role !== 'system_admin' && team.adminId !== currentUser.userId) {
      throw createError({ statusCode: 403, statusMessage: '权限不足' })
    }

    const existingUser = await prisma.user.findUnique({ where: { username } })
    if (existingUser) {
      throw createError({ statusCode: 400, statusMessage: '用户名已存在' })
    }

    const hashedPassword = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role: 'subaccount',
        mode: team.mode,
        teamId: id,
      },
    })

    await prisma.teamMember.create({
      data: { teamId: id, userId: user.id },
    })

    setResponseStatus(event, 201)
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Add member error:', error)
    throw createError({ statusCode: 500, statusMessage: '添加子账号失败' })
  }
})
