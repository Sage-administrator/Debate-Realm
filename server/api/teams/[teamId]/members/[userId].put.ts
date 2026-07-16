// PUT /api/teams/[teamId]/members/[userId] — 管理员更新团队成员的个人信息
// 允许更新：username/nickname/email/avatar
// 权限：仅 system_admin 或团队 admin 可调用
import { readBody } from 'h3'
import { prisma } from '../../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // 校验登录态 + 单设备登录一致性
    const currentUser = await getUserFromEventWithSession(event, prisma)
    const teamId = getRouterParam(event, 'teamId')!
    const userId = getRouterParam(event, 'userId')!

    // 查询团队是否存在
    const team = await prisma.team.findUnique({ where: { id: teamId } })
    if (!team) {
      throw createError({ statusCode: 404, message: '团队不存在' })
    }

    // 权限校验：仅 system_admin 或该团队的 admin 可操作
    if (currentUser.role !== 'system_admin' && team.adminId !== currentUser.userId) {
      throw createError({ statusCode: 403, message: '权限不足' })
    }

    // 确认目标用户是该团队成员
    const member = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      include: { user: true },
    })
    if (!member) {
      throw createError({ statusCode: 404, message: '成员不存在' })
    }

    // 读取请求体
    const body = await readBody<{
      username?: string
      nickname?: string | null
      email?: string | null
      avatar?: string | null
    }>(event)

    // 构造更新数据
    const data: {
      username?: string
      nickname?: string | null
      email?: string | null
      avatar?: string | null
    } = {}

    // 用户名校验：非空、长度、唯一性
    if (body.username !== undefined) {
      const newUsername = body.username.trim()
      if (!newUsername) {
        throw createError({ statusCode: 400, message: '用户名不能为空' })
      }
      if (newUsername.length > 30) {
        throw createError({ statusCode: 400, message: '用户名长度不能超过30个字符' })
      }
      // 与当前用户名不同时才校验唯一性
      if (newUsername !== member.user.username) {
        const existing = await prisma.user.findUnique({ where: { username: newUsername } })
        if (existing) {
          throw createError({ statusCode: 409, message: '该用户名已被占用' })
        }
      }
      data.username = newUsername
    }

    // 昵称：允许清空（传 null/空字符串 → null）
    if (body.nickname !== undefined) {
      const nick = body.nickname?.trim() || null
      if (nick && nick.length > 30) {
        throw createError({ statusCode: 400, message: '昵称长度不能超过30个字符' })
      }
      data.nickname = nick
    }

    // 邮箱：允许清空，有值时校验格式
    if (body.email !== undefined) {
      const mail = body.email?.trim() || null
      if (mail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(mail)) {
          throw createError({ statusCode: 400, message: '邮箱格式不正确' })
        }
      }
      data.email = mail
    }

    // 头像 URL：允许清空
    if (body.avatar !== undefined) {
      const url = body.avatar?.trim() || null
      if (url && url.length > 500) {
        throw createError({ statusCode: 400, message: '头像 URL 长度不能超过500个字符' })
      }
      data.avatar = url
    }

    // 无可更新字段
    if (Object.keys(data).length === 0) {
      throw createError({ statusCode: 400, message: '没有需要更新的字段' })
    }

    // 更新用户信息
    const updated = await prisma.user.update({
      where: { id: userId },
      data,
    })

    return {
      message: '成员信息已更新',
      user: {
        id: updated.id,
        username: updated.username,
        nickname: updated.nickname,
        email: updated.email,
        avatar: updated.avatar,
        role: updated.role,
      },
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Update team member error:', error)
    throw createError({ statusCode: 500, message: '更新成员信息失败' })
  }
})
