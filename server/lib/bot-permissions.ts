// ════════════════════════════════════════════════════
// Bot 频道权限管理模块
// 处理 QQ 频道身份组权限切换、观众临时发言授权
// ════════════════════════════════════════════════════

import type { PrismaClient } from './generated/client'
import { callBotApi } from './bot-ws'
import type { BotConfig } from './bot-ws'
import { getActiveArena } from './bot-roles'

// ---------- QQ 频道权限常量 ----------

/** 发言权限位掩码 */
const SEND_MESSAGES = 1 << 11 // 2048
/** 查看频道权限 */
const VIEW_CHANNEL = 1 << 10 // 1024

// ---------- 权限操作日志记录 ----------

/**
 * 记录权限操作日志到数据库
 */
async function logPermissionChange(
  prisma: PrismaClient,
  params: {
    teamId: string
    guildId: string
    channelId: string
    action: string
    targetType: 'role' | 'user'
    targetId: string
    targetName: string
    operator: string
    detail: string
  },
): Promise<void> {
  const timestamp = new Date().toISOString()
  console.log(`[PermissionLog][${timestamp}] ${params.action} | ${params.targetType}:${params.targetName}(${params.targetId}) | 操作者: ${params.operator} | ${params.detail}`)

  // 持久化到数据库
  try {
    await prisma.botPermissionLog.create({
      data: {
        teamId: params.teamId,
        guildId: params.guildId,
        channelId: params.channelId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        targetName: params.targetName,
        operator: params.operator,
        detail: params.detail,
      },
    })
  } catch (err) {
    console.error('[PermissionLog] 写入数据库失败:', err)
  }
}

// ---------- 身份组权限管理 ----------

/**
 * 设置身份组在子频道的权限
 * PUT /channels/{channel_id}/roles/{role_id}/permissions
 *
 * @param allow 权限位掩码（要授予的权限）
 * @param deny 权限位掩码（要拒绝的权限）
 */
export async function setRoleChannelPermission(
  botConfig: BotConfig,
  channelId: string,
  roleId: string,
  allow: number,
  deny: number = 0,
): Promise<boolean> {
  try {
    await callBotApi(botConfig, `/channels/${channelId}/roles/${roleId}/permissions`, 'PUT', {
      add: String(allow),
      remove: String(deny),
    })
    return true
  } catch (err) {
    console.error(`[BotPermissions] 设置身份组权限失败 (roleId=${roleId}):`, err)
    return false
  }
}

/**
 * 允许身份组发言
 */
export async function allowRoleSpeak(
  botConfig: BotConfig,
  channelId: string,
  roleId: string,
): Promise<boolean> {
  return setRoleChannelPermission(botConfig, channelId, roleId, SEND_MESSAGES)
}

/**
 * 禁止身份组发言
 */
export async function denyRoleSpeak(
  botConfig: BotConfig,
  channelId: string,
  roleId: string,
): Promise<boolean> {
  return setRoleChannelPermission(botConfig, channelId, roleId, 0, SEND_MESSAGES)
}

// ---------- 用户权限管理 ----------

/**
 * 设置成员在子频道的特殊权限（覆盖身份组权限）
 * PUT /channels/{channel_id}/members/{user_id}/permissions
 */
export async function setMemberChannelPermission(
  botConfig: BotConfig,
  channelId: string,
  userId: string,
  allow: number,
  deny: number = 0,
): Promise<boolean> {
  try {
    await callBotApi(botConfig, `/channels/${channelId}/members/${userId}/permissions`, 'PUT', {
      add: String(allow),
      remove: String(deny),
    })
    return true
  } catch (err) {
    console.error(`[BotPermissions] 设置成员权限失败 (userId=${userId}):`, err)
    return false
  }
}

/**
 * 允许特定用户发言（观众临时发言授权）
 */
export async function allowUserSpeak(
  botConfig: BotConfig,
  channelId: string,
  userId: string,
): Promise<boolean> {
  return setMemberChannelPermission(botConfig, channelId, userId, SEND_MESSAGES)
}

/**
 * 禁止特定用户发言（撤销观众临时发言）
 */
export async function denyUserSpeak(
  botConfig: BotConfig,
  channelId: string,
  userId: string,
): Promise<boolean> {
  return setMemberChannelPermission(botConfig, channelId, userId, 0, SEND_MESSAGES)
}

// ---------- 环节权限白名单切换 ----------

/**
 * 环节切换时，自动调整频道发言权限
 * 当前发言的身份组 → 允许发言，其他身份组 → 禁止发言
 *
 * @param targetSide 允许发言的阵营：'affirmative' | 'negative' | 'judge' | 'audience'
 * @param channelId 子频道 ID
 */
export async function switchRoundWhitelist(
  prisma: PrismaClient,
  botConfig: BotConfig,
  teamId: string,
  guildId: string,
  channelId: string,
  targetSide: string,
  operator: string = 'system',
): Promise<{ success: boolean; message: string; allowed: string[]; denied: string[] }> {
  const arena = await getActiveArena(prisma, teamId)

  if (!arena) {
    return { success: false, message: '当前没有活跃的赛场', allowed: [], denied: [] }
  }

  const allowed: string[] = []
  const denied: string[] = []

  for (const role of arena.roles) {
    // 跳过没有 QQ 身份组 ID 的角色
    if (!role.qqRoleId) continue

    // 跳过观众（观众不需要发言权限控制）
    if (role.side === 'audience') continue

    if (role.side === targetSide) {
      // 允许发言
      const ok = await allowRoleSpeak(botConfig, channelId, role.qqRoleId)
      if (ok) {
        allowed.push(role.label)
        await logPermissionChange(prisma, {
          teamId,
          guildId,
          channelId,
          action: 'ROUND_SWITCH_ALLOW',
          targetType: 'role',
          targetId: role.qqRoleId,
          targetName: role.label,
          operator,
          detail: `环节切换：允许「${role.label}」发言`,
        })
      }
    } else {
      // 禁止发言
      const ok = await denyRoleSpeak(botConfig, channelId, role.qqRoleId)
      if (ok) {
        denied.push(role.label)
        await logPermissionChange(prisma, {
          teamId,
          guildId,
          channelId,
          action: 'ROUND_SWITCH_DENY',
          targetType: 'role',
          targetId: role.qqRoleId,
          targetName: role.label,
          operator,
          detail: `环节切换：禁止「${role.label}」发言`,
        })
      }
    }
  }

  return {
    success: true,
    message: `环节切换完成：允许 ${allowed.length} 个身份组，禁止 ${denied.length} 个身份组`,
    allowed,
    denied,
  }
}

/**
 * 重置所有身份组发言权限（取消环节限制）
 */
export async function resetAllSpeakPermissions(
  prisma: PrismaClient,
  botConfig: BotConfig,
  teamId: string,
  guildId: string,
  channelId: string,
  operator: string = 'system',
): Promise<{ success: boolean; message: string }> {
  const arena = await getActiveArena(prisma, teamId)

  if (!arena) {
    return { success: false, message: '当前没有活跃的赛场' }
  }

  let count = 0
  for (const role of arena.roles) {
    if (!role.qqRoleId || role.side === 'audience') continue
    const ok = await allowRoleSpeak(botConfig, channelId, role.qqRoleId)
    if (ok) count++
  }

  await logPermissionChange(prisma, {
    teamId,
    guildId,
    channelId,
    action: 'RESET_ALL',
    targetType: 'role',
    targetId: '-',
    targetName: '所有身份组',
    operator,
    detail: `重置所有发言权限，${count} 个身份组恢复发言`,
  })

  return { success: true, message: `已重置 ${count} 个身份组的发言权限` }
}

// ---------- 观众临时发言授权 ----------

/**
 * 授权观众临时发言（5 分钟自动撤销）
 */
export async function grantAudienceSpeak(
  prisma: PrismaClient,
  botConfig: BotConfig,
  teamId: string,
  guildId: string,
  channelId: string,
  userId: string,
  username: string,
  operator: string = 'system',
  durationMs: number = 5 * 60 * 1000, // 默认 5 分钟
): Promise<{ success: boolean; message: string }> {
  const ok = await allowUserSpeak(botConfig, channelId, userId)

  if (!ok) {
    return { success: false, message: '授权失败，请检查 Bot 权限' }
  }

  await logPermissionChange(prisma, {
    teamId,
    guildId,
    channelId,
    action: 'AUDIENCE_SPEAK_GRANT',
    targetType: 'user',
    targetId: userId,
    targetName: username,
    operator,
    detail: `观众临时发言授权，${durationMs / 1000} 秒后自动撤销`,
  })

  // 自动撤销（定时器）
  setTimeout(async () => {
    await denyUserSpeak(botConfig, channelId, userId)
    await logPermissionChange(prisma, {
      teamId,
      guildId,
      channelId,
      action: 'AUDIENCE_SPEAK_REVOKE',
      targetType: 'user',
      targetId: userId,
      targetName: username,
      operator: 'auto_timer',
      detail: '观众临时发言自动撤销',
    })
    console.log(`[BotPermissions] 观众「${username}」临时发言已自动撤销`)
  }, durationMs)

  return { success: true, message: `已授权「${username}」临时发言（${durationMs / 1000} 秒）` }
}

/**
 * 手动撤销观众临时发言
 */
export async function revokeAudienceSpeak(
  prisma: PrismaClient,
  botConfig: BotConfig,
  teamId: string,
  guildId: string,
  channelId: string,
  userId: string,
  username: string,
  operator: string = 'system',
): Promise<{ success: boolean; message: string }> {
  const ok = await denyUserSpeak(botConfig, channelId, userId)

  if (!ok) {
    return { success: false, message: '撤销失败，请检查 Bot 权限' }
  }

  await logPermissionChange(prisma, {
    teamId,
    guildId,
    channelId,
    action: 'AUDIENCE_SPEAK_REVOKE',
    targetType: 'user',
    targetId: userId,
    targetName: username,
    operator,
    detail: '手动撤销观众临时发言',
  })

  return { success: true, message: `已撤销「${username}」的临时发言权限` }
}