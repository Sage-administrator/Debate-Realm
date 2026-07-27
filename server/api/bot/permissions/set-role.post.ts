// ════════════════════════════════════════════════════
// POST /api/bot/permissions/set-role — 按单个身份组切换发言权限
// 请求体：{ channelId, qqRoleId, allow }
//   channelId: 赛场绑定的语音子频道 ID（通过赛场名选中后由前端传入）
//   qqRoleId:  BotArenaRole.qqRoleId（QQ 身份组 ID）
//   allow:     true=允许发言 / false=禁止发言
// ════════════════════════════════════════════════════
import { prisma } from '../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../utils/auth'
import { getBotInstance } from '../../../lib/bot-ws'
import { allowRoleSpeak, denyRoleSpeak, logPermissionChange } from '../../../lib/bot-permissions'

export default defineEventHandler(async (event) => {
  try {
    // 校验 token 与 tokenVersion
    const currentUser = await getUserFromEventWithSession(event, prisma)

    if (currentUser.role !== 'admin' && currentUser.role !== 'system_admin') {
      throw createError({ statusCode: 403, message: '仅团队管理员可切换发言权限' })
    }

    const teamId = currentUser.teamId
    if (!teamId) {
      throw createError({ statusCode: 400, message: '用户不属于任何团队' })
    }

    const body = await readBody(event)
    const { channelId, qqRoleId, allow } = body as {
      channelId?: string
      qqRoleId?: string
      allow?: boolean
    }

    if (!channelId) {
      throw createError({ statusCode: 400, message: '缺少 channelId 参数' })
    }
    if (!qqRoleId) {
      throw createError({ statusCode: 400, message: '缺少 qqRoleId 参数' })
    }
    if (typeof allow !== 'boolean') {
      throw createError({ statusCode: 400, message: 'allow 参数必须为布尔值' })
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { mode: true },
    })

    if (!team || team.mode !== 'qq_bot') {
      throw createError({ statusCode: 400, message: '仅 QQ 频道模式团队可使用' })
    }

    const botInstance = getBotInstance(teamId)
    if (!botInstance || !botInstance.config) {
      throw createError({ statusCode: 400, message: 'Bot 未启动，请先连接 Bot' })
    }

    // 校验该身份组确实属于本团队的指定活跃赛场，防止越权切换任意身份组
    const arena = await prisma.botArena.findFirst({
      where: { channelId, teamId, status: 'active' },
      include: { roles: { where: { qqRoleId } } },
    })

    if (!arena) {
      throw createError({ statusCode: 404, message: '未找到对应的活跃赛场' })
    }
    const role = arena.roles[0]
    if (!role) {
      throw createError({ statusCode: 404, message: '该身份组不属于当前赛场' })
    }

    const ok = allow
      ? await allowRoleSpeak(botInstance.config, channelId, qqRoleId)
      : await denyRoleSpeak(botInstance.config, channelId, qqRoleId)

    if (!ok) {
      throw createError({ statusCode: 400, message: '切换发言权限失败，请检查 Bot 权限' })
    }

    await logPermissionChange(prisma, {
      teamId,
      guildId: arena.guildId || '',
      channelId,
      action: allow ? 'ROLE_SPEAK_ALLOW' : 'ROLE_SPEAK_DENY',
      targetType: 'role',
      targetId: qqRoleId,
      targetName: role.label,
      operator: currentUser.username || 'admin',
      detail: allow ? `允许「${role.label}」发言` : `禁止「${role.label}」发言`,
    })

    return { success: true, allow, label: role.label }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Set Role Speak] 失败:', error)
    throw createError({ statusCode: 500, message: '切换发言权限失败' })
  }
})
