// ════════════════════════════════════════════════════
// POST /api/bot/schedule — 设置 Bot 启动调度配置
// 请求体：{ teamId, priority, customDelayMs?, enabled }
// ════════════════════════════════════════════════════
import { prisma } from '../../lib/prisma'
import { getUserFromEventWithSession } from '../../utils/auth'
import { setBotSchedule, getScheduleConfigs } from '../../lib/bot-manager'

export default defineEventHandler(async (event) => {
  try {
    // 修复：使用 getUserFromEventWithSession 校验 tokenVersion
    const currentUser = await getUserFromEventWithSession(event, prisma)

    if (currentUser.role !== 'admin' && currentUser.role !== 'system_admin') {
      throw createError({ statusCode: 403, message: '仅团队管理员可设置调度配置' })
    }

    const body = await readBody(event)
    const { teamId, priority, customDelayMs, enabled } = body

    if (!teamId) {
      throw createError({ statusCode: 400, message: '缺少 teamId 参数' })
    }

    // 获取团队信息
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { name: true, mode: true },
    })

    if (!team) {
      throw createError({ statusCode: 404, message: '团队不存在' })
    }

    if (team.mode !== 'qq_bot') {
      throw createError({ statusCode: 400, message: '仅 QQ 频道模式团队可设置调度' })
    }

    setBotSchedule({
      teamId,
      teamName: team.name,
      priority: priority ?? 0,
      customDelayMs: customDelayMs ?? undefined,
      enabled: enabled ?? true,
    })

    return {
      success: true,
      message: `已更新团队「${team.name}」的调度配置`,
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Bot Schedule] 设置失败:', error)
    throw createError({ statusCode: 500, message: '设置调度配置失败' })
  }
})