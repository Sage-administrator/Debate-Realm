// ════════════════════════════════════════════════════
// Nitro 插件 — Bot 初始化与保活
// 默认行为（BOT_AUTO_RESTART 不再为 'false' 时）：
//   服务启动即从数据库拉起所有已配置的 QQ 频道 Bot，
//   不依赖「读状态」或「管理员打开页面」才启动。
//   并注册定时保活，拉起「配置存在但本进程无实例」的 Bot（覆盖重启/意外清除/冷启）。
// 关闭自动启动：设置环境变量 BOT_AUTO_RESTART=false（仅手动/显式启动）。
// 保活间隔：环境变量 BOT_RESYNC_INTERVAL_MS（默认 5 分钟）。
// ════════════════════════════════════════════════════

import { prisma as prismaInstance } from '../lib/prisma'
import { loadBotsFromDatabase, resyncConfiguredBots } from '../lib/bot-ws'
import { startScheduler, stopScheduler } from '../lib/scheduler'

export default defineNitroPlugin((nitroApp) => {
  // 默认开启自动启动；设置 BOT_AUTO_RESTART=false 才关闭
  const autoStart = process.env.BOT_AUTO_RESTART !== 'false'

  // 启动阶段数据库可能尚未就绪：失败则指数退避重试（上限 5 次）
  async function bootLoad(attempt = 1): Promise<void> {
    try {
      const n = await loadBotsFromDatabase(prismaInstance)
      if (n > 0) console.log(`[Bot] 已调度 ${n} 个 Bot 启动`)
    } catch (err) {
      if (attempt < 5) {
        const waitMs = attempt * 2000
        console.warn(`[Bot] 启动查询失败（第 ${attempt} 次），${waitMs / 1000}s 后重试:`, err)
        setTimeout(() => void bootLoad(attempt + 1), waitMs)
      } else {
        console.error('[Bot] Bot 启动查询多次失败，放弃自动启动:', err)
      }
    }
  }

  if (!autoStart) {
    console.log('[Bot] 自动启动已关闭（BOT_AUTO_RESTART=false），Bot 需手动或显式启动。')
    return
  }

  void bootLoad()

  // ── 定时保活 ──
  // 拉起「配置存在但本进程无实例」的 Bot，不动已有实例（含手动断开/熔断）。
  // 覆盖：进程重启错过启动、实例被意外清除、serverless 冷启后重新激活。
  // 注：真·按请求伸缩（scale-to-zero）下无常驻进程，需外部定时器 ping 保活端点才能真正唤醒；
  //     此 in-process 定时器负责常驻/长生命周期部署下的自愈。
  const intervalMs = Number(process.env.BOT_RESYNC_INTERVAL_MS || 5 * 60 * 1000)
  let resyncTimer: ReturnType<typeof setInterval> | null = null
  if (Number.isFinite(intervalMs) && intervalMs > 0) {
    resyncTimer = setInterval(() => {
      resyncConfiguredBots(prismaInstance).catch((e) => console.error('[Bot] 保活检查失败:', e))
    }, intervalMs)
    console.log(`[Bot] 已注册 Bot 保活检查（每 ${Math.round(intervalMs / 1000)} 秒一次）`)
  }

  // ── 定时发布调度器 ──
  // 与 Bot 保活同生命周期：常驻/长生命周期部署下扫描到期任务并发帖。
  // serverless scale-to-zero 下需外部 cron 定时唤醒（类似保活）。
  startScheduler(prismaInstance)

  // 进程关闭时清理定时器
  nitroApp.hooks.hook('close', () => {
    if (resyncTimer) clearInterval(resyncTimer)
    stopScheduler()
  })
})
