// POST /api/scheduled-posts/dispatch-due — 扫描并发布所有到期任务（外部 cron/自动化保活入口）
// 服务令牌鉴权。返回 { triggered: number }
import { prisma } from '../../lib/prisma'
import { requireServiceToken } from '../../utils/auth'
import { scanDueTasks } from '../../lib/scheduler'

export default defineEventHandler(async (event) => {
  // 服务令牌鉴权（与用户会话令牌隔离）
  await requireServiceToken(event, prisma)

  const triggered = await scanDueTasks(prisma)
  return { triggered }
})
