import { readBody } from 'h3'
import { prisma } from '../../lib/prisma'
import { hashPassword } from '../../lib/jwt'
import { requireRole } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    requireRole(event, 'system_admin')

    const { username, password, role, mode, teamId } = await readBody<{
      username: string
      password: string
      role: string
      mode: string
      teamId?: string
    }>(event)

    if (!username || !password) {
      throw createError({ statusCode: 400, message: '用户名和密码不能为空' })
    }

    // 验证用户名长度
    if (username.length < 2) {
      throw createError({ statusCode: 400, message: '用户名至少2个字符' })
    }

    // 验证密码长度
    if (password.length < 6) {
      throw createError({ statusCode: 400, message: '密码至少6位' })
    }

    // 验证角色
    if (!['system_admin', 'admin', 'subaccount', 'individual'].includes(role)) {
      throw createError({ statusCode: 400, message: '无效的角色' })
    }

    // 验证模式（新增 'system' 用于系统管理员）
    if (!['qq_bot', 'team', 'individual', 'system'].includes(mode)) {
      throw createError({ statusCode: 400, message: '无效的模式' })
    }

    // 验证模式与角色的一致性
    if (mode === 'individual' && role !== 'individual') {
      throw createError({ statusCode: 400, message: '个人模式只能选择个人用户角色' })
    }

    if (mode === 'system' && role !== 'system_admin') {
      throw createError({ statusCode: 400, message: '系统管理模式只能选择系统管理员角色' })
    }

    // 团队模式（team/qq_bot）下，角色必须为 admin 或 subaccount
    if ((mode === 'team' || mode === 'qq_bot') && !['admin', 'subaccount'].includes(role)) {
      throw createError({ statusCode: 400, message: '团队模式下角色必须为团队管理员或子账号' })
    }

    // 团队模式下，需要提供 teamId（除非是系统管理员在创建团队管理员时后端会回填）
    if ((role === 'admin' || role === 'subaccount') && teamId) {
      const team = await prisma.team.findUnique({ where: { id: teamId } })
      if (!team) {
        throw createError({ statusCode: 400, message: '团队不存在' })
      }
      // 子账号必须有 teamId
    } else if (role === 'subaccount' && !teamId) {
      throw createError({ statusCode: 400, message: '子账号必须选择所属团队' })
    }

    // 系统管理员角色不应有 teamId
    if (role === 'system_admin' && teamId) {
      throw createError({ statusCode: 400, message: '系统管理员不应关联团队' })
    }

    // 个人用户不应有 teamId
    if (role === 'individual' && teamId) {
      throw createError({ statusCode: 400, message: '个人用户不应关联团队' })
    }

    const existingUser = await prisma.user.findUnique({
      where: { username },
    })

    if (existingUser) {
      throw createError({ statusCode: 400, message: '用户名已存在' })
    }

    // 将前端 'system' 模式映射为数据库存储的 'team'（系统管理员本质上是团队模式的一种）
    const dbMode = mode === 'system' ? 'team' : mode

    const hashedPassword = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role,
        mode: dbMode,
        teamId: teamId || null,
      },
      include: { team: true },
    })

    setResponseStatus(event, 201)
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      mode: user.mode,
      team: user.team ? { id: user.team.id, name: user.team.name } : null,
      createdAt: user.createdAt,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Create user error:', error)
    throw createError({ statusCode: 500, message: '创建用户失败' })
  }
})
