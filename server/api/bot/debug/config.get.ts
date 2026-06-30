// GET /api/bot/debug/config — 读取数据库中的 Bot 配置
import { defineEventHandler } from 'h3'
import { prisma } from '../../../lib/prisma'

export default defineEventHandler(async () => {
  try {
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

    return {
      success: true,
      count: teams.length,
      teams: teams.map((t) => ({
        id: t.id,
        name: t.name,
        botAppId: t.botAppId,
        botAppSecret: t.botAppSecret,
        botAppSecretLength: t.botAppSecret?.length,
        botChannelId: t.botChannelId,
      })),
    }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})
