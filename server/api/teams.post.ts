import { readBody } from 'h3'
import { prisma } from '../lib/prisma'
import { hashPassword } from '../lib/jwt'
import { requireRole } from '../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    requireRole(event, 'system_admin')

    const { name, mode, adminUsername, adminPassword, botAppId, botAppSecret, botChannelId } =
      await readBody<{
        name: string
        mode: string
        adminUsername: string
        adminPassword: string
        botAppId?: string
        botAppSecret?: string
        botChannelId?: string
      }>(event)

    if (!name || !mode) {
      throw createError({ statusCode: 400, message: '团队名称和模式不能为空' })
    }

    if (!['qq_bot', 'team'].includes(mode)) {
      throw createError({ statusCode: 400, message: '无效的模式' })
    }

    if (!adminUsername || !adminPassword) {
      throw createError({ statusCode: 400, message: '管理员用户名和密码不能为空' })
    }

    const existingAdmin = await prisma.user.findUnique({
      where: { username: adminUsername },
    })

    if (existingAdmin) {
      throw createError({ statusCode: 400, message: '管理员用户名已存在' })
    }

    // 创建管理员用户（teamId 先留空）
    const hashedPassword = await hashPassword(adminPassword)
    const adminUser = await prisma.user.create({
      data: {
        username: adminUsername,
        password: hashedPassword,
        role: 'admin',
        mode,
        teamId: null as any,
      },
    })

    // 创建团队
    const team = await prisma.team.create({
      data: {
        name,
        adminId: adminUser.id,
        mode,
        botAppId: botAppId || null,
        botAppSecret: botAppSecret || null,
        botChannelId: botChannelId || null,
      },
    })

    // 回填管理员的 teamId
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { teamId: team.id },
    })

    // 创建管理员的 TeamMember 记录（计入团队成员数）
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: adminUser.id },
    })

    setResponseStatus(event, 201)
    return {
      id: team.id,
      name: team.name,
      mode: team.mode,
      adminId: team.adminId,
      botConfig: {
        botAppId: team.botAppId,
        botChannelId: team.botChannelId,
      },
      createdAt: team.createdAt,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Create team error:', error)
    throw createError({ statusCode: 500, message: '创建团队失败' })
  }
})
