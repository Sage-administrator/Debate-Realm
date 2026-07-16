// POST /api/scheduled-posts/publish — WorkBuddy 自动化主链路：生成内容后直接发帖（服务令牌鉴权）
// 不经过 ScheduledPost 记录，立即发到指定 QQ 频道；最小实现，暂不写历史。
import { readBody, createError } from 'h3'
import { prisma } from '../../lib/prisma'
import { requireServiceToken } from '../../utils/auth'
import { postForumThread, sendChannelMessage, type BotConfig } from '../../lib/bot-ws'
import { buildForumContent } from '../../lib/scheduler'

export default defineEventHandler(async (event) => {
  // 服务令牌鉴权（与用户会话令牌隔离）
  const team = await requireServiceToken(event, prisma)

  const body = await readBody<{
    channelId?: string
    title?: string
    content?: string
    type?: string
    tags?: string | null
    pollOptions?: string | null
  }>(event)

  const { channelId, title, content, tags, pollOptions } = body

  // 基础字段校验
  if (!channelId || !title || !content) {
    throw createError({ statusCode: 400, message: 'channelId/title/content 必填' })
  }

  // Bot 凭证校验（论坛发帖仅私域机器人可用）
  if (!team.botAppId || !team.botAppSecret) {
    throw createError({ statusCode: 400, message: '团队未配置 Bot 凭证，无法发布' })
  }

  const config: BotConfig = {
    appId: team.botAppId,
    appSecret: team.botAppSecret,
    teamId: team.id,
    teamName: team.name,
    isPrivate: team.botIsPrivate ?? false,
  }

  try {
    const postTaskId = await postForumThread(
      config,
      channelId,
      title,
      buildForumContent({ content, tags, pollOptions }),
      3,
    )
    return { success: true, postTaskId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)

    // 失败告警：推到团队消息频道（不影响主流程，异常仅记录）
    try {
      if (team.botChannelId) {
        await sendChannelMessage(
          config,
          team.botChannelId,
          `⚠️ 定时发布失败：「${title}」\n原因：${msg}\n时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
        )
        console.log(`[Publish] 已推送失败告警到频道 ${team.botChannelId}`)
      } else {
        console.warn('[Publish] 团队未配置 botChannelId，跳过主动告警')
      }
    } catch (notifyErr) {
      const nmsg = notifyErr instanceof Error ? notifyErr.message : String(notifyErr)
      console.error(`[Publish] 发送失败告警本身出错: ${nmsg}`)
    }

    return { success: false, message: msg }
  }
})
