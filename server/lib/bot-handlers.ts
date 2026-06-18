// ════════════════════════════════════════════════════
// Bot 消息处理器 — 处理 /ping /help /timer 等命令
// ════════════════════════════════════════════════════

export interface MessageContext {
  channelId: string
  userId: string
  content: string
}

export interface HandleResult {
  handled: boolean
  reply?: string
}

/**
 * 处理消息命令
 */
export function handleMessage(ctx: MessageContext): HandleResult {
  const { content } = ctx

  // 忽略空消息
  if (!content || !content.trim()) {
    return { handled: false }
  }

  const trimmed = content.trim()

  // /ping — 测试连接
  if (trimmed === '/ping' || trimmed === 'ping') {
    return { handled: true, reply: 'pong! 🏓 辩论计时器 Bot 运行正常' }
  }

  // /help — 帮助信息
  if (trimmed === '/help' || trimmed === '帮助' || trimmed === 'help') {
    return {
      handled: true,
      reply: `📋 **辩论计时器 Bot 命令列表**

` +
        '`/ping` - 测试 Bot 是否在线\n' +
        '`/help` - 显示此帮助信息\n' +
        '`/timer [秒数]` - 开始计时（例：/timer 180）\n' +
        '`/speak [分钟]` - 开始发言计时（例：/speak 3）\n' +
        '`/stop` - 停止计时\n' +
        '`/status` - 查看当前状态',
    }
  }

  // /timer [秒数] — 开始计时（基础版，后续对接数据库赛程）
  const timerMatch = trimmed.match(/^\/timer\s+(\d+)$/)
  if (timerMatch) {
    const seconds = parseInt(timerMatch[1]!, 10)
    if (seconds <= 0 || seconds > 3600) {
      return { handled: true, reply: '时间范围应为 1-3600 秒' }
    }
    const min = Math.floor(seconds / 60)
    const sec = seconds % 60
    const display = min > 0 ? `${min}分${sec}秒` : `${sec}秒`
    return { handled: true, reply: `⏱️ 计时已开始：${display}（${seconds}秒）\n功能完善中，敬请期待！` }
  }

  // /speak [分钟] — 发言计时
  const speakMatch = trimmed.match(/^\/speak\s+(\d+)$/)
  if (speakMatch) {
    const minutes = parseInt(speakMatch[1]!, 10)
    if (minutes <= 0 || minutes > 60) {
      return { handled: true, reply: '发言时间范围应为 1-60 分钟' }
    }
    return { handled: true, reply: `🎤 发言计时已开始：${minutes} 分钟\n功能完善中，敬请期待！` }
  }

  // /stop — 停止计时
  if (trimmed === '/stop' || trimmed === 'stop') {
    return { handled: true, reply: '⏹️ 计时已停止' }
  }

  // /status — 状态
  if (trimmed === '/status' || trimmed === '状态') {
    return { handled: true, reply: '📊 Bot 运行中 | 辩论计时器 V3\n当前暂无进行中的赛事' }
  }

  return { handled: false }
}
