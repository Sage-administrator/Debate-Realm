// ════════════════════════════════════════════════════
// Nitro 插件 — Bot 初始化（按需启动模式）
// ════════════════════════════════════════════════════
// 设计变更：
//   旧设计：服务启动时自动加载并启动 ALL 已配置的团队 Bot
//   新设计：Bot 仅在「该团队的管理员用户登录并访问机器人管理页面」时按需启动
// 目的：
//   1. 避免不属于当前登录用户的团队 Bot 产生不必要的网络请求
//   2. 减少 API 调用频率，避免触发第三方服务（如 QQ 频道）的频率限制
//   3. Bot 生命周期与用户会话对齐，提升可管理性
// ════════════════════════════════════════════════════

import { prisma as prismaInstance } from '../lib/prisma'

export default defineNitroPlugin(async () => {
  try {
    // 仅查询已配置 Bot 的团队数量，用于启动日志（不创建任何 Bot 实例）
    const botTeams = await prismaInstance.team.count({
      where: {
        mode: 'qq_bot',
        botAppId: { not: null },
        botAppSecret: { not: null },
      },
    })

    if (botTeams > 0) {
      console.log(
        `[Bot] 检测到 ${botTeams} 个已配置 Bot 的团队，${botTeams === 1 ? '它' : '它们'}将在团队管理员登录并访问机器人管理页面时按需启动。`,
      )
    } else {
      console.log('[Bot] 暂无已配置 Bot 的团队。')
    }
  } catch (err) {
    console.error('[Bot] 初始化检查失败:', err)
  }
})
