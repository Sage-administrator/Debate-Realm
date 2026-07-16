// ════════════════════════════════════════════════════
// POST /api/bot/forum/post — 测试发帖（UI「测试发帖」卡片调用）
// 功能：
//   1. 校验用户权限（仅团队管理员/system_admin 可访问）
//   2. 读取请求体 { channelId, title, content }
//   3. 调用 postForumThreadForTeam(teamId, channelId, title, content)
//      → 内部用真实验证过的 multipart 格式 PUT /channels/{id}/threads
// 权限：role === 'admin' 或 role === 'system_admin'
// ════════════════════════════════════════════════════
import { readBody, createError } from 'h3'
import { prisma } from '../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../utils/auth'
import { postForumThreadForTeam } from '../../../lib/bot-ws'

export default defineEventHandler(async (event) => {
  try {
    const currentUser = await getUserFromEventWithSession(event, prisma)

    if (currentUser.role !== 'admin' && currentUser.role !== 'system_admin') {
      throw createError({ statusCode: 403, message: '权限不足' })
    }

    const teamId = currentUser.teamId
    if (!teamId) {
      throw createError({ statusCode: 400, message: '用户不属于任何团队' })
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { mode: true, botAppId: true, botIsPrivate: true },
    })

    if (!team || team.mode !== 'qq_bot') {
      throw createError({ statusCode: 400, message: '仅 QQ 频道模式团队可使用机器人功能' })
    }
    if (!team.botAppId) {
      throw createError({ statusCode: 400, message: 'Bot 未配置' })
    }

    const body = await readBody<{
      channelId?: string
      title?: string
      content?: string
    }>(event)

    const { channelId, title, content } = body
    if (!channelId || !title?.trim() || !content?.trim()) {
      throw createError({ statusCode: 400, message: 'channelId / title / content 均为必填' })
    }

    const result = await postForumThreadForTeam(teamId, channelId, title.trim(), content)
    if (result.error) {
      throw createError({ statusCode: 502, message: result.error })
    }

    return { success: true, threadId: result.threadId, taskId: result.taskId }
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode) throw error
    console.error('[Bot Forum Post] 发帖失败:', error)
    throw createError({ statusCode: 500, message: '发帖失败' })
  }
})
