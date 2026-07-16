// PUT /api/auth/profile — 更新当前用户个人信息（昵称、邮箱、头像 URL、用户名）
import { readBody } from 'h3'
import { prisma } from '../../lib/prisma'
import { getUserFromEventWithSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // 校验登录态 + tokenVersion 一致性
    const user = await getUserFromEventWithSession(event, prisma)
    const body = await readBody<{
      username?: string
      nickname?: string | null
      email?: string | null
      avatar?: string | null
    }>(event)

    // ── 字段校验 ──
    const data: {
      nickname?: string | null
      email?: string | null
      avatar?: string | null
      username?: string
    } = {}

    // 用户名：非空且与当前不同时才更新，需校验唯一性
    if (body.username !== undefined) {
      const newUsername = body.username.trim()
      if (!newUsername) {
        throw createError({ statusCode: 400, message: '用户名不能为空' })
      }
      if (newUsername.length > 30) {
        throw createError({ statusCode: 400, message: '用户名长度不能超过30个字符' })
      }
      // 仅当与当前用户名不同时才校验唯一性
      const currentUser = await prisma.user.findUnique({ where: { id: user.userId } })
      if (currentUser && newUsername !== currentUser.username) {
        const existing = await prisma.user.findUnique({ where: { username: newUsername } })
        if (existing) {
          throw createError({ statusCode: 409, message: '该用户名已被占用' })
        }
        data.username = newUsername
      }
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
        // 简单邮箱格式校验
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

    // 无任何可更新字段
    if (Object.keys(data).length === 0) {
      throw createError({ statusCode: 400, message: '没有需要更新的字段' })
    }

    // 更新用户信息
    const updated = await prisma.user.update({
      where: { id: user.userId },
      data,
      include: { team: true },
    })

    return {
      id: updated.id,
      username: updated.username,
      nickname: updated.nickname,
      email: updated.email,
      avatar: updated.avatar,
      role: updated.role,
      mode: updated.mode,
      team: updated.team
        ? { id: updated.team.id, name: updated.team.name, mode: updated.team.mode }
        : null,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Update profile error:', error)
    throw createError({ statusCode: 500, message: '更新个人信息失败' })
  }
})
