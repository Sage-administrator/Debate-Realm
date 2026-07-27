// ════════════════════════════════════════════════════
// POST /api/bot/permissions/apply-stage — 按当前环节发言方套用发言权限
// 请求体：{ channelId, targetRoles }
// targetRoles: 当前环节可发言的角色 label 列表（如 ["正方一辩","反方二辩"]）
//   - 非空：列表中的角色允许发言，其余角色禁止发言
//   - 空数组 / 缺省：重置为默认——正方 + 反方 + 评委可发言，观众不可
// 规则为单一真相来源，前端环节切换时调用本接口即可与发言权限联动。
// 注意：发言权限按"发言方（具体角色）"处理，而非按阵营。
// ════════════════════════════════════════════════════
import { prisma } from '../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../utils/auth'
import { getBotInstance } from '../../../lib/bot-ws'
import { allowRoleSpeak, denyRoleSpeak, logPermissionChange } from '../../../lib/bot-permissions'

export default defineEventHandler(async (event) => {
  try {
    const currentUser = await getUserFromEventWithSession(event, prisma)

    if (currentUser.role !== 'admin' && currentUser.role !== 'system_admin') {
      throw createError({ statusCode: 403, message: '仅团队管理员可切换发言权限' })
    }

    const teamId = currentUser.teamId
    if (!teamId) {
      throw createError({ statusCode: 400, message: '用户不属于任何团队' })
    }

    const body = await readBody(event)
    const { channelId, targetRoles } = body as { channelId?: string; targetRoles?: string[] }

    if (!channelId) {
      throw createError({ statusCode: 400, message: '缺少 channelId 参数' })
    }

    // targetRoles 校验：必须是字符串数组（可为空，表示默认权限）
    if (targetRoles !== undefined && !Array.isArray(targetRoles)) {
      throw createError({ statusCode: 400, message: 'targetRoles 必须是字符串数组' })
    }
    // 归一化：去空白、去 ·，与赛场身份组 label 对齐
    const allowSet = new Set(
      (targetRoles || []).map((r: string) => (r || '').replace(/[·\s]/g, '')).filter(Boolean),
    )
    const isDefault = allowSet.size === 0

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

    // 按 channelId 直查活跃赛场
    const arena = await prisma.botArena.findFirst({
      where: { channelId, teamId, status: 'active' },
      include: { roles: true },
    })
    if (!arena) {
      throw createError({ statusCode: 404, message: '未找到对应的活跃赛场' })
    }

    // 每个身份组：命中 targetRoles 则允许发言，否则禁止；
    // 空 targetRoles（默认）时：正方 + 反方 + 评委可发言，观众不可。
    const shouldAllow = (role: { label: string; side: string }): boolean => {
      if (isDefault) return role.side !== 'audience'
      return allowSet.has(role.label.replace(/[·\s]/g, ''))
    }

    const allowed: string[] = []
    const denied: string[] = []
    let applied = 0

    for (const role of arena.roles) {
      if (!role.qqRoleId) continue
      const allow = shouldAllow(role)
      const ok = allow
        ? await allowRoleSpeak(botInstance.config, channelId, role.qqRoleId)
        : await denyRoleSpeak(botInstance.config, channelId, role.qqRoleId)
      if (!ok) continue
      applied++
      if (allow) {
        allowed.push(role.label)
        await logPermissionChange(prisma, {
          teamId,
          guildId: arena.guildId || '',
          channelId,
          action: 'ROUND_SWITCH_ALLOW',
          targetType: 'role',
          targetId: role.qqRoleId,
          targetName: role.label,
          operator: currentUser.username || 'admin',
          detail: `环节联动：允许「${role.label}」发言${isDefault ? '（默认权限）' : `（发言方=${[...allowSet].join('、')}）`}`,
        })
      } else {
        denied.push(role.label)
        await logPermissionChange(prisma, {
          teamId,
          guildId: arena.guildId || '',
          channelId,
          action: 'ROUND_SWITCH_DENY',
          targetType: 'role',
          targetId: role.qqRoleId,
          targetName: role.label,
          operator: currentUser.username || 'admin',
          detail: `环节联动：禁止「${role.label}」发言${isDefault ? '（默认权限）' : `（发言方=${[...allowSet].join('、')}）`}`,
        })
      }
    }

    return {
      success: true,
      targetRoles: [...allowSet],
      isDefault,
      applied,
      allowed,
      denied,
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Apply Stage Permission] 失败:', error)
    throw createError({ statusCode: 500, message: '套用环节发言权限失败' })
  }
})
