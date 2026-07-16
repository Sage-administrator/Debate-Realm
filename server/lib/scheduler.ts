// ════════════════════════════════════════════════════
// 定时发布调度器 — 扫描到期任务并向 QQ 论坛子频道发帖
// 设计取舍（ponytail）：
//   - 不引入 cron 第三方库；用原生 Intl + Date 实现 once/daily/weekly 的时区安全计算
//   - 调度扫描为 in-process setInterval（与 bot 保活同生命周期），serverless scale-to-zero 下需外部 cron ping 唤醒
//   - 论坛发帖仅私域机器人可用；公域机器人调用会被平台拒绝并记为 failed（不静默降级）
//   - 管理员「发布失败通知」：除落库+日志外，主动调 sendChannelMessage 推到团队 botChannelId（频道消息，公域/私域均支持）
// ════════════════════════════════════════════════════
import type { PrismaClient } from './generated/client'
import { createError } from 'h3'
import { postForumThread, sendChannelMessage, type BotConfig } from './bot-ws'

type ScheduleTask = {
  scheduleType: string
  runAt?: Date | string | null
  timeHHMM?: string | null
  weekday?: number | null
  timezone?: string | null
}

// ── 时区工具 ──

// 返回某时刻在指定时区下的「墙钟偏移」(ms)：墙钟当成 UTC 的毫秒数 - 实际 UTC 毫秒数
function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const m: Record<string, string> = {}
  for (const p of dtf.formatToParts(date)) if (p.type !== 'literal') m[p.type] = p.value
  const asUTC = Date.UTC(+m.year, +m.month - 1, +m.day, +m.hour, +m.minute, +m.second)
  return asUTC - date.getTime()
}

// 取某时刻在指定时区的墙钟年月日与星期（0=周日）
function wallParts(date: Date, tz: string): { year: number; month: number; day: number; weekday: number } {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false, weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const m: Record<string, string> = {}
  for (const p of dtf.formatToParts(date)) if (p.type !== 'literal') m[p.type] = p.value
  const wkMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return { year: +m.year, month: +m.month, day: +m.day, weekday: wkMap[m.weekday] ?? 0 }
}

// 将「某时区的墙钟 Y-M-D H:M」还原为真实 UTC 瞬间（refDate 用于取该时刻附近的偏移，DST 近似）
function wallToUtc(year: number, month: number, day: number, hh: number, mm: number, tz: string, refDate?: Date): Date {
  const ref = refDate || new Date(Date.UTC(year, month - 1, day, hh, mm, 0))
  const offset = tzOffsetMs(ref, tz)
  return new Date(Date.UTC(year, month - 1, day, hh, mm, 0) - offset)
}

// 将本地「YYYY-MM-DDTHH:mm」字符串（无时区）按指定时区转 UTC 瞬间
export function localToUtc(localStr: string, tz: string): Date {
  const [datePart, timePart] = localStr.split('T')
  const [y, mo, d] = datePart.split('-').map(Number)
  const [hh, mm] = timePart.split(':').map(Number)
  const ref = new Date(Date.UTC(y, mo - 1, d, hh, mm, 0))
  const offset = tzOffsetMs(ref, tz)
  return new Date(Date.UTC(y, mo - 1, d, hh, mm, 0) - offset)
}

// 计算任务的下一次触发时间（UTC）。返回 null 表示无下次（如一次性已过期）
export function computeNextRun(task: ScheduleTask, from: Date = new Date()): Date | null {
  if (task.scheduleType === 'once') {
    return task.runAt ? new Date(task.runAt) : null
  }
  const tz = task.timezone || 'Asia/Shanghai'
  const [hh, mm] = (task.timeHHMM || '09:00').split(':').map(Number)
  const wantWeekday = task.scheduleType === 'weekly' ? (task.weekday ?? -1) : undefined
  let cur = new Date(from)
  // ponytail: 最多向前看 14 天（覆盖 weekly 任意星期 + 跨月），足够；量大时无需更久
  for (let i = 0; i < 14; i++) {
    const w = wallParts(cur, tz)
    if (wantWeekday === undefined || w.weekday === wantWeekday) {
      const cand = wallToUtc(w.year, w.month, w.day, hh, mm, tz, cur)
      if (cand.getTime() > from.getTime()) return cand
    }
    cur = new Date(cur.getTime() + 24 * 3600 * 1000)
  }
  return null
}

// 将标签/投票选项拼进帖子正文（基础论坛 API 无独立投票字段，选项以列表呈现）
export function buildForumContent(task: {
  content?: string
  tags?: string | null
  pollOptions?: string | null
}): string {
  const parts: string[] = [task.content || '']
  if (task.tags) {
    const tagStr = task.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => `#${t}#`)
      .join(' ')
    if (tagStr) parts.push(`\n标签：${tagStr}`)
  }
  if (task.pollOptions) {
    try {
      const opts = JSON.parse(task.pollOptions)
      if (Array.isArray(opts) && opts.length) {
        parts.push('\n投票选项：\n' + opts.map((o: string, i: number) => `${i + 1}. ${o}`).join('\n'))
      }
    } catch {
      // 非法 JSON 忽略，不阻断发布
    }
  }
  return parts.join('\n')
}

// 触发单次发布：取团队 Bot 凭证 → 调论坛发帖
export async function triggerTask(prisma: PrismaClient, task: {
  id: string; teamId: string; channelId: string; title: string
  content?: string; tags?: string | null; pollOptions?: string | null
}): Promise<any> {
  const team = await prisma.team.findUnique({
    where: { id: task.teamId },
    select: { botAppId: true, botAppSecret: true, name: true, botIsPrivate: true },
  })
  if (!team?.botAppId || !team?.botAppSecret) {
    throw new Error('团队未配置 Bot 凭证，无法发布')
  }
  const config: BotConfig = {
    appId: team.botAppId,
    appSecret: team.botAppSecret,
    teamId: task.teamId,
    teamName: team.name,
    isPrivate: team.botIsPrivate ?? false,
  }
  return postForumThread(config, task.channelId, task.title, buildForumContent(task), 3)
}

// 扫描并触发所有到期（pending 且 nextRunAt<=now）的任务
export async function scanDueTasks(prisma: PrismaClient): Promise<number> {
  const now = new Date()
  const due = await prisma.scheduledPost.findMany({
    where: { status: 'pending', nextRunAt: { lte: now } },
  })
  if (due.length === 0) return 0

  let triggered = 0
  for (const task of due) {
    try {
      const res = await triggerTask(prisma, task)
      const isOnce = task.scheduleType === 'once'
      const next = isOnce ? null : computeNextRun(task, new Date())
      await prisma.scheduledPost.update({
        where: { id: task.id },
        data: {
          lastRunAt: new Date(),
          lastResult: '发布成功',
          status: isOnce ? 'published' : 'pending',
          nextRunAt: next,
        },
      })
      await prisma.scheduledPostRun.create({
        data: {
          scheduledPostId: task.id,
          status: 'success',
          message: '发布成功',
          postTaskId: res?.task_id,
        },
      })
      triggered++
      console.log(`[Scheduler] ✅ 定时发布成功: 「${task.title}」 (task_id=${res?.task_id})`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await prisma.scheduledPost.update({
        where: { id: task.id },
        data: { lastRunAt: new Date(), lastResult: msg, status: 'failed' },
      })
      await prisma.scheduledPostRun.create({
        data: { scheduledPostId: task.id, status: 'failed', message: msg },
      })
      console.error(`[Scheduler] 🔴 定时发布失败: 「${task.title}」 - ${msg}`)

      // ponytail: 主动推送失败告警到团队消息频道（复用 botChannelId）；频道消息公域/私域均支持，
      // 比仅私域可用的论坛发帖更适合做运维告警。通知本身失败不影响主流程，仅记录。
      try {
        const team = await prisma.team.findUnique({
          where: { id: task.teamId },
          select: { botAppId: true, botAppSecret: true, name: true, botIsPrivate: true, botChannelId: true },
        })
        if (team?.botChannelId && team.botAppId && team.botAppSecret) {
          const cfg: BotConfig = {
            appId: team.botAppId,
            appSecret: team.botAppSecret,
            teamId: task.teamId,
            teamName: team.name,
            isPrivate: team.botIsPrivate ?? false,
          }
          await sendChannelMessage(
            cfg,
            team.botChannelId,
            `⚠️ 定时发布失败：「${task.title}」\n原因：${msg}\n时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
          )
          console.log(`[Scheduler] 已推送失败告警到频道 ${team.botChannelId}`)
        } else {
          console.warn('[Scheduler] 团队未配置 botChannelId 或 Bot 凭证，跳过主动告警')
        }
      } catch (notifyErr) {
        const nmsg = notifyErr instanceof Error ? notifyErr.message : String(notifyErr)
        console.error(`[Scheduler] 发送失败告警本身出错: ${nmsg}`)
      }
    }
  }
  return triggered
}

// 立即发布指定任务（WorkBuddy 自动化触发入口）：不依赖 nextRunAt，直接对单条任务执行一次发布
export async function dispatchPostById(
  prisma: PrismaClient,
  id: string,
): Promise<{ success: boolean; run?: any; message?: string }> {
  const task = await prisma.scheduledPost.findUnique({ where: { id } })
  if (!task) {
    throw createError({ statusCode: 404, message: '任务不存在' })
  }

  try {
    const res = await triggerTask(prisma, task)
    // 写成功执行历史
    const run = await prisma.scheduledPostRun.create({
      data: {
        scheduledPostId: id,
        status: 'success',
        message: 'ok',
        postTaskId: res?.task_id,
      },
    })
    if (task.scheduleType === 'once') {
      // 一次性任务：标记已发布
      await prisma.scheduledPost.update({
        where: { id },
        data: {
          status: 'published',
          lastRunAt: new Date(),
          lastResult: 'ok',
        },
      })
    } else {
      // 周期任务：保持 pending 并重新计算下次触发时间
      const next = computeNextRun(task, new Date())
      await prisma.scheduledPost.update({
        where: { id },
        data: {
          status: 'pending',
          lastRunAt: new Date(),
          lastResult: 'ok',
          nextRunAt: next,
        },
      })
    }
    return { success: true, run }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // 写失败执行历史
    await prisma.scheduledPostRun.create({
      data: { scheduledPostId: id, status: 'failed', message: msg },
    })
    await prisma.scheduledPost.update({
      where: { id },
      data: { status: 'failed', lastRunAt: new Date(), lastResult: msg },
    })

    // 复用 scanDueTasks 的失败告警逻辑：主动推送告警到团队消息频道（不影响主流程）
    try {
      const team = await prisma.team.findUnique({
        where: { id: task.teamId },
        select: { botAppId: true, botAppSecret: true, name: true, botIsPrivate: true, botChannelId: true },
      })
      if (team?.botChannelId && team.botAppId && team.botAppSecret) {
        const cfg: BotConfig = {
          appId: team.botAppId,
          appSecret: team.botAppSecret,
          teamId: task.teamId,
          teamName: team.name,
          isPrivate: team.botIsPrivate ?? false,
        }
        await sendChannelMessage(
          cfg,
          team.botChannelId,
          `⚠️ 定时发布失败：「${task.title}」\n原因：${msg}\n时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
        )
        console.log(`[Scheduler] 已推送失败告警到频道 ${team.botChannelId}`)
      } else {
        console.warn('[Scheduler] 团队未配置 botChannelId 或 Bot 凭证，跳过主动告警')
      }
    } catch (notifyErr) {
      const nmsg = notifyErr instanceof Error ? notifyErr.message : String(notifyErr)
      console.error(`[Scheduler] 发送失败告警本身出错: ${nmsg}`)
    }

    return { success: false, message: msg }
  }
}

// ── 生命周期 ──

let timer: ReturnType<typeof setInterval> | null = null

export function startScheduler(prisma: PrismaClient, intervalMs = 30 * 1000): void {
  if (timer) return
  // 启动时先扫一次，避免空等一个周期
  void scanDueTasks(prisma).catch((e) => console.error('[Scheduler] 初始扫描失败:', e))
  timer = setInterval(() => {
    void scanDueTasks(prisma).catch((e) => console.error('[Scheduler] 扫描失败:', e))
  }, intervalMs)
  console.log(`[Scheduler] 已启动定时发布扫描（每 ${Math.round(intervalMs / 1000)} 秒）`)
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
