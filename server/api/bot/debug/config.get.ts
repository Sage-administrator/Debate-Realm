// GET /api/bot/debug/config — 读取数据库中的 Bot 配置（仅 system_admin）
import { getUserFromEventWithSession } from '../../../utils/auth'
import { prisma } from '../../../lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    // 鉴权：仅 system_admin 可查看 Bot 配置
    const user = await getUserFromEventWithSession(event, prisma)
    if (user.role !== 'system_admin') {
      throw createError({ statusCode: 403, message: '权限不足' })
    }

    const teams = await prisma.team.findMany({
      where: {
        mode: 'qq_bot',
        botAppId: { not: null },
        botAppSecret: { not: null },
      },
      select: {
        id: true,
        name: true,
        botAppId: true,
        botAppSecret: true,
        botChannelId: true,
      },
    })

    // 敏感信息脱敏：AppId 和 Secret 只显示前4后4字符
    function mask(s: string | null): string | null {
      if (!s || s.length <= 8) return s ? s.substring(0, 2) + '****' : null
      return s.substring(0, 4) + '****' + s.substring(s.length - 4)
    }

    return {
      success: true,
      count: teams.length,
      teams: teams.map((t) => ({
        id: t.id,
        name: t.name,
        botAppId: t.botAppId,
        botAppSecretHint: mask(t.botAppSecret),
        botChannelId: t.botChannelId,
      })),
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    console.error('[Debug Config]', err.message)
    throw createError({ statusCode: 500, message: '获取调试配置失败' })
  }
})
