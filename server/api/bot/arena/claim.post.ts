// ════════════════════════════════════════════════════
// POST /api/bot/arena/claim — 通过 HTTP 认领身份（管理员操作）
// 请求体：{ arenaId, roleId, userId, username, guildId }
// ════════════════════════════════════════════════════
import { prisma } from '../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../utils/auth'
import { getBotInstance } from '../../../lib/bot-ws'

export default defineEventHandler(async (event) => {
  try {
    const currentUser = await getUserFromEventWithSession(event, prisma)

    if (currentUser.role !== 'admin' && currentUser.role !== 'system_admin') {
      throw createError({ statusCode: 403, message: '仅团队管理员可操作认领' })
    }

    // 安全：teamId 必填，确保用户属于团队（system_admin 也需指定目标团队）
    const body = await readBody(event)
    const { arenaId, roleId, userId, username, guildId } = body

    if (!arenaId || !roleId || !userId || !username) {
      throw createError({
        statusCode: 400,
        message: '缺少必要参数：arenaId、roleId、userId、username',
      })
    }

    // 越权修复：必须校验 arena.teamId === currentUser.teamId，
    // 否则任意团队 admin 可对其他团队的赛场创建认领记录（横向越权）
    // 校验赛场存在且活跃，并强制按 teamId 过滤防止跨团队越权
    const arenaWhere: any = { id: arenaId, status: 'active' }
    if (currentUser.role !== 'system_admin') {
      if (!currentUser.teamId) {
        throw createError({ statusCode: 403, message: '当前用户未关联团队' })
      }
      arenaWhere.teamId = currentUser.teamId
    }

    const arena = await prisma.botArena.findFirst({
      where: arenaWhere,
      include: {
        roles: {
          where: { id: roleId },
          include: { claims: true },
        },
      },
    })

    if (!arena) {
      throw createError({ statusCode: 404, message: '赛场不存在或已关闭' })
    }

    const role = arena.roles[0]
    if (!role) {
      throw createError({ statusCode: 404, message: '身份组不存在' })
    }

    // 检查是否已满员
    if (role.claims.length >= role.maxCount) {
      throw createError({
        statusCode: 400,
        message: `身份「${role.label}」已满员（${role.claims.length}/${role.maxCount}）`,
      })
    }

    // 检查是否重复认领
    const existing = await prisma.botArenaClaim.findFirst({
      where: { arenaId, roleId, userId },
    })
    if (existing) {
      throw createError({ statusCode: 400, message: '该用户已认领过此身份' })
    }

    // 创建认领记录
    const claim = await prisma.botArenaClaim.create({
      data: {
        arenaId,
        roleId,
        userId,
        username,
        guildId: guildId || arena.guildId || '',
      },
    })

    // 尝试通过 QQ API 添加身份组（如果 Bot 已连接）
    const botInstance = getBotInstance(arena.teamId)
    if (botInstance && botInstance.status === 'connected' && role.qqRoleId && guildId) {
      try {
        const { callBotApi } = await import('../../../lib/bot-ws')
        await callBotApi(
          botInstance.config,
          `/guilds/${guildId}/members/${userId}/roles/${role.qqRoleId}`,
          'PUT',
        )
        console.log(`[Arena Claim] 已通过 QQ API 为 ${username} 添加身份组 ${role.label}`)
      } catch (err) {
        console.error(`[Arena Claim] QQ API 添加身份组失败（认领记录已保存）:`, err)
      }
    }

    return {
      success: true,
      message: `用户「${username}」成功认领身份「${role.label}」`,
      claimId: claim.id,
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Arena Claim] 认领失败:', error)
    throw createError({ statusCode: 500, message: '认领操作失败' })
  }
})
