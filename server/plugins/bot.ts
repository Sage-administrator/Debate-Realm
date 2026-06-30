// ════════════════════════════════════════════════════
// Nitro 插件 — Bot 初始化
// 支持两种模式：
//   1. 按需启动（默认）：Bot 仅在团队管理员访问 /bot 页面时启动
//   2. 自动恢复：设置 BOT_AUTO_RESTART=true 后，服务重启时错峰恢复所有 Bot
// ════════════════════════════════════════════════════

import { prisma as prismaInstance } from '../lib/prisma'

export default defineNitroPlugin(async () => {
  try {
    // 查询已配置 Bot 的团队
    const botTeams = await prismaInstance.team.findMany({
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

    if (botTeams.length === 0) {
      console.log('[Bot] 暂无已配置 Bot 的团队。')
      return
    }

    // 检查是否启用自动恢复（环境变量 BOT_AUTO_RESTART=true）
    // 默认关闭自动恢复：Bot 只在团队管理员访问 /bot 页面时按需启动
    // 如需服务重启后自动恢复，设置环境变量 BOT_AUTO_RESTART=true
    const autoRestart = process.env.BOT_AUTO_RESTART === 'true'

    if (!autoRestart) {
      console.log(
        `[Bot] 检测到 ${botTeams.length} 个已配置 Bot 的团队，${botTeams.length === 1 ? '它' : '它们'}将在团队管理员访问机器人管理页面时按需启动。`,
      )
      return
    }

    // 自动恢复模式：错峰启动所有 Bot（仅在环境变量启用时）
    console.log(`[Bot] 自动恢复模式：检测到 ${botTeams.length} 个已配置 Bot 的团队，开始错峰启动...`)

    // 按团队名称排序，确保启动顺序一致
    const sorted = botTeams.sort((a, b) => a.name.localeCompare(b.name))

    // 错峰间隔：每个 Bot 之间 3-5 秒随机延迟
    const STAGGER_BASE_MS = 3000
    const STAGGER_JITTER_MS = 2000

    sorted.forEach((team, index) => {
      const delayMs = index * STAGGER_BASE_MS + Math.floor(Math.random() * STAGGER_JITTER_MS)

      setTimeout(() => {
        console.log(`[Bot] 错峰启动「${team.name}」（第 ${index + 1}/${sorted.length} 个，延迟 ${delayMs}ms）`)

        // 动态导入避免循环依赖
        import('../lib/bot-ws').then(({ createBotInstance }) => {
          createBotInstance({
            appId: team.botAppId!,
            appSecret: team.botAppSecret!,
            teamId: team.id,
            teamName: team.name,
            channelId: team.botChannelId ?? null,
            intents: ['PUBLIC_GUILD_MESSAGES'],
          })
        }).catch((err) => {
          console.error(`[Bot] 启动「${team.name}」失败:`, err)
        })
      }, delayMs)
    })

    const totalDelayS = Math.round((sorted.length * (STAGGER_BASE_MS + STAGGER_JITTER_MS / 2)) / 1000)
    console.log(`[Bot] 已调度 ${sorted.length} 个 Bot 错峰启动，预计 ${totalDelayS} 秒内完成`)
  } catch (err) {
    console.error('[Bot] 初始化检查失败:', err)
  }
})