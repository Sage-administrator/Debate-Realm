// ════════════════════════════════════════════════════
// Bot 身份组管理模块
// 处理 QQ 频道身份组创建、赛场管理、身份认领
// ════════════════════════════════════════════════════

import type { PrismaClient } from './generated/client'
import { callBotApi, renameChannel } from './bot-ws'
import type { BotConfig } from './bot-ws'

/**
 * 根据团队已存在的赛场数量，生成下一个字母序号（A、B、C... G、H... Z、AA、AB...）
 * 用于无显式名字时自动命名「赛场A」「赛场B」...
 */
export async function getNextArenaLetter(prisma: PrismaClient, teamId: string): Promise<string> {
  const count = await prisma.botArena.count({ where: { teamId } })
  let n = count
  let result = ''
  do {
    result = String.fromCharCode(65 + (n % 26)) + result
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return result
}

// ---------- 赛场可创建子频道类型限制 ----------
// 经真实 QQ API 实调（用户服务器「辩论社」/ guild 124748394594966514）：
//   - type=2     = 语音/赛场子频道（唯一可发言的非文字频道，如「测试赛场」736724967，挂在「语音房」分组下）
//   - type=0     = 文字子频道（不可建赛场）
//   - type=4     = 分组父级（容器，不可建赛场）
//   - type=10007 = 帖子/论坛（不可建赛场）
//   - type=10011 = 日程（不可建赛场）
// 说明：QQ 官方文档将 type=2 标为「直播」，但本服务器实测 type=2 即语音/赛场频道；全频道无 type=1。
const ARENA_ALLOWED_CHANNEL_TYPES = new Set<number>([2])

// 赛场名长度上限（按「字/码点」计，不多于 8 个字）
const ARENA_NAME_MAX_LEN = 8

// ---------- 比赛形式定义 ----------

/** 不同比赛形式对应的身份组配置 */
const FORMAT_ROLES: Record<string, Array<{ label: string; side: string; orderIndex: number; maxCount: number }>> = {
  '4v4': [
    { label: '正方一辩', side: 'affirmative', orderIndex: 1, maxCount: 1 },
    { label: '正方二辩', side: 'affirmative', orderIndex: 2, maxCount: 1 },
    { label: '正方三辩', side: 'affirmative', orderIndex: 3, maxCount: 1 },
    { label: '正方四辩', side: 'affirmative', orderIndex: 4, maxCount: 1 },
    { label: '反方一辩', side: 'negative', orderIndex: 5, maxCount: 1 },
    { label: '反方二辩', side: 'negative', orderIndex: 6, maxCount: 1 },
    { label: '反方三辩', side: 'negative', orderIndex: 7, maxCount: 1 },
    { label: '反方四辩', side: 'negative', orderIndex: 8, maxCount: 1 },
    { label: '评委', side: 'judge', orderIndex: 9, maxCount: 5 },
    { label: '观众', side: 'audience', orderIndex: 10, maxCount: 999 },
  ],
  '3v3': [
    { label: '正方一辩', side: 'affirmative', orderIndex: 1, maxCount: 1 },
    { label: '正方二辩', side: 'affirmative', orderIndex: 2, maxCount: 1 },
    { label: '正方三辩', side: 'affirmative', orderIndex: 3, maxCount: 1 },
    { label: '反方一辩', side: 'negative', orderIndex: 4, maxCount: 1 },
    { label: '反方二辩', side: 'negative', orderIndex: 5, maxCount: 1 },
    { label: '反方三辩', side: 'negative', orderIndex: 6, maxCount: 1 },
    { label: '评委', side: 'judge', orderIndex: 7, maxCount: 5 },
    { label: '观众', side: 'audience', orderIndex: 8, maxCount: 999 },
  ],
  '2v2': [
    { label: '正方一辩', side: 'affirmative', orderIndex: 1, maxCount: 1 },
    { label: '正方二辩', side: 'affirmative', orderIndex: 2, maxCount: 1 },
    { label: '反方一辩', side: 'negative', orderIndex: 3, maxCount: 1 },
    { label: '反方二辩', side: 'negative', orderIndex: 4, maxCount: 1 },
    { label: '评委', side: 'judge', orderIndex: 5, maxCount: 5 },
    { label: '观众', side: 'audience', orderIndex: 6, maxCount: 999 },
  ],
}

/** 获取支持的比赛形式列表 */
export function getSupportedFormats(): string[] {
  return Object.keys(FORMAT_ROLES)
}

/** 获取指定比赛形式的身份组配置 */
export function getFormatRoles(format: string) {
  return FORMAT_ROLES[format] || null
}

// ---------- QQ 频道身份组 API ----------

/**
 * 创建 QQ 频道身份组
 * POST /guilds/{guild_id}/roles
 */
export async function createQQRole(
  botConfig: BotConfig,
  guildId: string,
  name: string,
  color: number = 0,
  hoist: number = 0, // 0=不单独展示, 1=单独展示
): Promise<{ role_id: string }> {
  const result = await callBotApi(botConfig, `/guilds/${guildId}/roles`, 'POST', {
    name,
    color,
    hoist,
  })
  return result as { role_id: string }
}

/**
 * 删除 QQ 频道身份组
 * DELETE /guilds/{guild_id}/roles/{role_id}
 */
export async function deleteQQRole(
  botConfig: BotConfig,
  guildId: string,
  roleId: string,
): Promise<void> {
  await callBotApi(botConfig, `/guilds/${guildId}/roles/${roleId}`, 'DELETE')
}

/**
 * 将成员添加到身份组
 * PUT /guilds/{guild_id}/members/{user_id}/roles/{role_id}
 */
export async function addMemberToRole(
  botConfig: BotConfig,
  guildId: string,
  userId: string,
  roleId: string,
): Promise<void> {
  await callBotApi(botConfig, `/guilds/${guildId}/members/${userId}/roles/${roleId}`, 'PUT')
}

/**
 * 将成员从身份组移除
 * DELETE /guilds/{guild_id}/members/{user_id}/roles/{role_id}
 */
export async function removeMemberFromRole(
  botConfig: BotConfig,
  guildId: string,
  userId: string,
  roleId: string,
): Promise<void> {
  await callBotApi(botConfig, `/guilds/${guildId}/members/${userId}/roles/${roleId}`, 'DELETE')
}

/**
 * 获取频道所有身份组
 * GET /guilds/{guild_id}/roles
 */
export async function getQQRoles(
  botConfig: BotConfig,
  guildId: string,
): Promise<Array<{ id: string; name: string; color: number; hoist: number; number: number; member_limit: number }>> {
  const result = await callBotApi(botConfig, `/guilds/${guildId}/roles`, 'GET')
  const data = result as any
  return Array.isArray(data) ? data : (data.roles || data.data || [])
}

// ---------- 赛场管理 ----------

// 并发创建锁：防止同一子频道被多个并发请求同时创建赛场（QQ 重复推送 / 快速连点等场景）
// key = channelId, value = 正在执行的创建 Promise（后续请求复用同一 Promise）
const pendingArenaCreates = new Map<string, Promise<{
  success: boolean
  message: string
  arenaId?: string
  roles?: Array<{ label: string; qqRoleId: string }>
}>>()

/**
 * 创建赛场（在 QQ 频道子频道中创建对应身份组）
 *
 * 术语约定：
 *   - guild（频道） = QQ 的服务器，是身份组的容器（QQ API 要求 guild_id）
 *   - channel（子频道） = 赛场主阵地，一个频道下可有多个子频道，每个子频道可设一个赛场
 *
 * @param arenaName 赛场名称（如"赛场A"），用于 QQ 身份组前缀
 * @param channelId 子频道 ID（赛场主阵地，必填，用于查重与定位）
 * @param guildId 频道 ID（仅用于调用 QQ 身份组 API，不参与查重）
 * @returns 创建的赛场和身份组信息
 */
export async function createArena(
  prisma: PrismaClient,
  botConfig: BotConfig,
  teamId: string,
  matchFormat: string,
  guildId: string,
  arenaName: string,
  channelId: string, // 现在是必填：channel 是赛场主阵地
): Promise<{
  success: boolean
  message: string
  arenaId?: string
  roles?: Array<{ label: string; qqRoleId: string }>
}> {
  // ── 并发保护：同一 channel 的创建请求合并为一次执行 ──
  // 如果该频道已有正在执行的创建请求，直接复用其 Promise，避免重复创建
  const existing = pendingArenaCreates.get(channelId)
  if (existing) {
    console.log(`[BotRoles] 子频道 ${channelId} 有正在进行的赛场创建，复用已有请求`)
    return existing
  }

  // 创建新的 Promise 并注册到锁中（finally 中清理）
  const creationPromise = createArenaInner(prisma, botConfig, teamId, matchFormat, guildId, arenaName, channelId)
  pendingArenaCreates.set(channelId, creationPromise)

  try {
    return await creationPromise
  } finally {
    // 无论成功失败都清理锁（允许后续重试）
    pendingArenaCreates.delete(channelId)
  }
}

/** 创建赛场的实际实现（内部函数，被 createArena 的并发锁包裹） */
async function createArenaInner(
  prisma: PrismaClient,
  botConfig: BotConfig,
  teamId: string,
  matchFormat: string,
  guildId: string,
  arenaName: string,
  channelId: string,
): Promise<{
  success: boolean
  message: string
  arenaId?: string
  roles?: Array<{ label: string; qqRoleId: string }>
}> {
  // 校验赛场名：必填，且不多于 ARENA_NAME_MAX_LEN 个字
  const finalName = (arenaName || '').trim()
  if (!finalName) {
    return { success: false, message: `赛场名不能为空，请使用「/设置赛场 赛场名 ${matchFormat}」创建（赛场名不多于 ${ARENA_NAME_MAX_LEN} 个字）` }
  }
  if ([...finalName].length > ARENA_NAME_MAX_LEN) {
    return { success: false, message: `赛场名不能超过 ${ARENA_NAME_MAX_LEN} 个字（当前：${[...finalName].length} 字「${finalName}」）` }
  }

  // 校验比赛形式
  const formatRoles = FORMAT_ROLES[matchFormat]
  if (!formatRoles) {
    return { success: false, message: `不支持的比赛形式：${matchFormat}。支持：${Object.keys(FORMAT_ROLES).join('、')}` }
  }

  // ── 子频道类型校验：赛场只能建在语音子频道（type=2，经实调确认）──
  let channelInfo: any
  try {
    channelInfo = await callBotApi(botConfig, `/channels/${channelId}`, 'GET')
  } catch {
    return { success: false, message: '无法获取子频道信息（QQ 接口调用失败），请稍后重试' }
  }
  const channelType = typeof channelInfo?.type === 'number' ? channelInfo.type : undefined
  if (channelType === undefined) {
    return { success: false, message: '无法确认子频道类型，请稍后重试' }
  }
  if (!ARENA_ALLOWED_CHANNEL_TYPES.has(channelType)) {
    return {
      success: false,
      message: `赛场只能创建在语音子频道（当前子频道类型 ${channelType} 不是语音子频道）。请切换到语音子频道后，再使用 /设置赛场 创建赛场`,
    }
  }

  // 记录原语音子频道名，并把频道改名为「赛场名 比赛形式辩论」（如「我的赛场 4v4辩论」）
  const originalChannelName: string = typeof channelInfo?.name === 'string' ? channelInfo.name : ''
  const arenaChannelName = `${finalName} ${matchFormat}辩论`
  try {
    await renameChannel(botConfig, channelId, arenaChannelName)
  } catch (err) {
    console.error('[BotRoles] 重命名语音子频道失败（赛场仍会创建）：', err)
  }

  // 检查该子频道（channelId）是否已有活跃赛场
  // 同一子频道不能重复创建；同一频道下不同子频道可以各有赛场
  const existingArena = await prisma.botArena.findFirst({
    where: { channelId, status: 'active' },
  })
  if (existingArena) {
    return { success: false, message: `当前子频道已有活跃赛场「${existingArena.name}」（ID: ${existingArena.id}），请先结束再创建新的` }
  }

  try {
    // 创建赛场记录（channelId 为主键字段，guildId 仅用于 QQ API 调用）
    const arena = await prisma.botArena.create({
      data: {
        teamId,
        name: finalName,
        matchFormat,
        guildId: guildId || null,
        channelId,
        status: 'active',
      },
    })

    // 持久化原语音子频道名（用于赛场结束后还原频道名）。
    // 用 raw SQL 写入，避免依赖 Prisma client 重新生成（originalChannelName 为运行时新增列）。
    if (originalChannelName) {
      try {
        await prisma.$executeRawUnsafe('UPDATE "BotArena" SET "originalChannelName" = ? WHERE "id" = ?', originalChannelName, arena.id)
      } catch (err) {
        console.error('[BotRoles] 记录原频道名失败（不影响赛场创建）：', err)
      }
    }

    // 在 QQ 频道中创建身份组并回填（身份组名加赛场前缀）
    // 注意：QQ API 仍需要 guildId 来创建/管理身份组
    const actualGuildId = guildId || channelId // 兼容：如果未传 guildId，尝试用 channelId 替代
    const createdRoles: Array<{ label: string; qqRoleId: string }> = []
    const sideColors: Record<string, number> = {
      affirmative: 0x3498DB, // 蓝色
      negative: 0xE74C3C,    // 红色
      judge: 0xF39C12,       // 橙色
      audience: 0x95A5A6,    // 灰色
    }

    for (const roleDef of formatRoles) {
      const color = sideColors[roleDef.side] || 0
      // QQ 身份组名称：赛场名 · 角色名（如"我的赛场 · 正方一辩"）
      const qqRoleName = `${finalName} · ${roleDef.label}`
      try {
        const qqRole = await createQQRole(botConfig, actualGuildId, qqRoleName, color, 1)
        await prisma.botArenaRole.create({
          data: {
            arenaId: arena.id,
            label: roleDef.label,
            side: roleDef.side,
            orderIndex: roleDef.orderIndex,
            qqRoleId: qqRole.role_id,
            maxCount: roleDef.maxCount,
          },
        })
        createdRoles.push({ label: roleDef.label, qqRoleId: qqRole.role_id })
        console.log(`[BotRoles] 身份组「${roleDef.label}」已创建，QQ ID: ${qqRole.role_id}`)
      } catch (err) {
        console.error(`[BotRoles] 创建身份组「${roleDef.label}」失败:`, err)
        // 回滚已创建的 QQ 身份组
        for (const r of createdRoles) {
          try { await deleteQQRole(botConfig, actualGuildId, r.qqRoleId) } catch { /* 忽略 */ }
        }
        // 删除赛场记录
        await prisma.botArena.delete({ where: { id: arena.id } })
        return { success: false, message: `创建身份组「${roleDef.label}」失败，已回滚所有操作` }
      }
    }

    return { success: true, message: `赛场「${finalName}」已创建（${matchFormat}），语音子频道已重命名为「${arenaChannelName}」，共 ${createdRoles.length} 个身份组`, arenaId: arena.id, roles: createdRoles }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误'
    return { success: false, message: `创建赛场失败：${msg}` }
  }
} // end createArenaInner

/**
 * 关闭赛场（删除 QQ 频道身份组，物理删除赛场及关联的身份组/认领记录）
 * 根据消息来源的 channelId（子频道）定位赛场
 * 注：采用硬删除而非软标记，关闭后赛场即从管理列表消失（BotArena -> BotArenaRole -> BotArenaClaim 级联删除）
 */
export async function closeArena(
  prisma: PrismaClient,
  botConfig: BotConfig,
  channelId: string, // 子频道 ID（赛场主阵地）
  guildId?: string,  // 频道 ID（仅用于 QQ API 调用）
  teamId?: string,   // 限制只能关闭当前团队的赛场
): Promise<{ success: boolean; message: string }> {
  // 查找活跃赛场（按 channelId 定位，同时可限定团队）
  const arenaWhere: any = { channelId, status: 'active' }
  if (teamId) {
    arenaWhere.teamId = teamId
  }
  const arena = await prisma.botArena.findFirst({
    where: arenaWhere,
    include: { roles: true },
  })

  if (!arena) {
    return { success: false, message: '当前子频道没有活跃的赛场需要关闭' }
  }

  // 读取原语音子频道名，赛场结束后把频道名还原回去
  let originalChannelName = ''
  try {
    const rows: any = await prisma.$queryRawUnsafe(
      'SELECT "originalChannelName" FROM "BotArena" WHERE "id" = ?', arena.id,
    )
    originalChannelName = rows?.[0]?.originalChannelName || ''
  } catch { /* 列可能不存在，忽略 */ }

  // 删除 QQ 频道中的身份组（需要 guildId，兼容用 arena 记录的 guildId）
  const actualGuildId = guildId || arena.guildId || channelId
  let deletedCount = 0
  for (const role of arena.roles) {
    if (role.qqRoleId) {
      try {
        await deleteQQRole(botConfig, actualGuildId, role.qqRoleId)
        deletedCount++
        console.log(`[BotRoles] 身份组「${role.label}」已删除`)
      } catch (err) {
        console.error(`[BotRoles] 删除身份组「${role.label}」失败:`, err)
      }
    }
  }

  // 还原语音子频道名为原名（比赛期间被改为「赛场名 比赛形式辩论」）
  if (originalChannelName) {
    try {
      await renameChannel(botConfig, arena.channelId, originalChannelName)
    } catch (err) {
      console.error('[BotRoles] 还原语音子频道名失败（赛场仍会关闭）：', err)
    }
  }

  // 物理删除赛场：BotArenaRole / BotArenaClaim 配置了 onDelete: Cascade，
  // Prisma 会级联删除关联的身份组与认领记录，channelId(@unique) 随即释放可复用
  await prisma.botArena.delete({
    where: { id: arena.id },
  })

  return { success: true, message: `赛场「${arena.name}」已删除，共清理 ${deletedCount} 个 QQ 身份组${originalChannelName ? '，语音子频道已恢复原名称' : ''}` }
}

/**
 * 获取指定子频道的活跃赛场信息（按 channelId 定位）
 */
export async function getActiveArena(prisma: PrismaClient, channelId: string) {
  return prisma.botArena.findFirst({
    where: { channelId, status: 'active' },
    include: {
      roles: {
        orderBy: { orderIndex: 'asc' },
        include: { claims: true },
      },
    },
  })
}

// ---------- 身份认领 ----------

/**
 * 认领身份
 * @param channelId 子频道 ID（赛场主阵地）
 * @param guildId 频道 ID（仅用于 QQ API 调用）
 * @param userId QQ 用户 ID
 * @param username QQ 用户名
 * @param roleLabel 身份标签（如"正方一辩"）
 */
export async function claimRole(
  prisma: PrismaClient,
  botConfig: BotConfig,
  teamId: string,
  channelId: string, // 子频道 ID（赛场主阵地）
  guildId: string,   // 频道 ID（仅用于 QQ API）
  userId: string,
  username: string,
  roleLabel: string,
): Promise<{ success: boolean; message: string }> {
  // 根据消息来源的 channelId（子频道）查找活跃赛场
  const arena = await prisma.botArena.findFirst({
    where: { channelId, status: 'active' },
    include: {
      roles: {
        include: { claims: true },
      },
    },
  })

  if (!arena) {
    return { success: false, message: '当前子频道没有活跃的赛场，请先由管理员创建赛场' }
  }

  // 查找目标身份组
  const targetRole = arena.roles.find(r => r.label === roleLabel)
  if (!targetRole) {
    return { success: false, message: `未找到身份「${roleLabel}」。可用身份：${arena.roles.map(r => r.label).join('、')}` }
  }

  // 检查是否已满
  if (targetRole.claims.length >= targetRole.maxCount) {
    return { success: false, message: `身份「${roleLabel}」已被认领完毕（${targetRole.claims.length}/${targetRole.maxCount}）` }
  }

  // 检查用户是否已认领过（同一赛场）
  const existingClaim = targetRole.claims.find(c => c.userId === userId)
  if (existingClaim) {
    return { success: false, message: `你已经认领了「${roleLabel}」` }
  }

  // 检查用户是否已认领其他身份（需要先取消旧身份）
  let userOtherRoleLabel = ''
  for (const role of arena.roles) {
    const claim = role.claims.find(c => c.userId === userId)
    if (claim) {
      userOtherRoleLabel = role.label
      break
    }
  }
  if (userOtherRoleLabel) {
    return { success: false, message: `你已经认领了「${userOtherRoleLabel}」，请先取消旧身份再认领新身份` }
  }

  // 如果有 QQ 身份组 ID，将用户加入（需要 guildId 调用 QQ API）
  if (targetRole.qqRoleId && guildId) {
    try {
      await addMemberToRole(botConfig, guildId, userId, targetRole.qqRoleId)
      console.log(`[BotRoles] 用户「${username}」已加入身份组「${roleLabel}」`)
    } catch (err) {
      console.error(`[BotRoles] 添加用户到身份组失败:`, err)
      return { success: false, message: 'QQ 频道操作失败，请稍后重试' }
    }
  }

  // 创建认领记录
  await prisma.botArenaClaim.create({
    data: {
      arenaId: arena.id,
      roleId: targetRole.id,
      userId,
      username,
      guildId,
    },
  })

  return { success: true, message: `「${username}」已成功认领「${roleLabel}」` }
}

/**
 * 取消身份认领
 */
export async function unclaimRole(
  prisma: PrismaClient,
  botConfig: BotConfig,
  channelId: string, // 子频道 ID（赛场主阵地）
  guildId: string,   // 频道 ID（仅用于 QQ API）
  userId: string,
): Promise<{ success: boolean; message: string }> {
  // 查找用户在该子频道赛场的认领记录
  const claim = await prisma.botArenaClaim.findFirst({
    where: { userId },
    include: { role: { include: { arena: true } } },
    orderBy: { createdAt: 'desc' },
  })

  if (!claim) {
    return { success: false, message: '你没有认领任何身份' }
  }

  // 验证认领所属赛场是否仍在当前子频道且活跃
  if (claim.role.arena.channelId !== channelId || claim.role.arena.status !== 'active') {
    return { success: false, message: '你的认领信息已过期，请重新在目标子频道操作' }
  }

  // 从 QQ 身份组移除
  if (claim.role.qqRoleId && guildId) {
    try {
      await removeMemberFromRole(botConfig, guildId, userId, claim.role.qqRoleId)
    } catch (err) {
      console.error(`[BotRoles] 移除用户身份组失败:`, err)
    }
  }

  const label = claim.role.label
  await prisma.botArenaClaim.delete({ where: { id: claim.id } })

  return { success: true, message: `已取消「${label}」的认领` }
}

/**
 * 查看赛场状态（按 channelId 定位子频道）
 */
export async function getArenaStatus(
  prisma: PrismaClient,
  channelId: string,
): Promise<string> {
  const arena = await getActiveArena(prisma, channelId)

  if (!arena) {
    return '当前子频道没有活跃的赛场。管理员可使用 设置赛场 赛场名 4v4 创建赛场'
  }

  const lines: string[] = [
    `赛场「${arena.name}」：${arena.matchFormat} 比赛`,
    `━━━━━━━━━━━━━━━━`,
  ]

  // 按阵营分组显示
  const groups: Record<string, string[]> = {
    affirmative: ['── 正方 ──'],
    negative: ['── 反方 ──'],
    judge: ['── 评委 ──'],
    audience: ['── 观众 ──'],
  }

  for (const role of arena.roles) {
    const claimed = role.claims.map(c => c.username).join('、') || '（空）'
    const group = groups[role.side]
    if (group) {
      group.push(`${role.label}: ${claimed} [${role.claims.length}/${role.maxCount}]`)
    }
  }

  for (const group of Object.values(groups)) {
    lines.push(...group)
  }

  lines.push(`━━━━━━━━━━━━━━━━`)
  lines.push('使用 认领 身份名称 来认领身份')

  return lines.join('\n')
}