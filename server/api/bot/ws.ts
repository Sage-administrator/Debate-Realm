// ════════════════════════════════════════════════════
// WebSocket /api/bot/ws — Bot 控制指令统一入口
// 替代原有的 connect.post / disconnect.post / status.get / send.post / monitor.get
// 所有指令通过同一 WebSocket 连接发送，服务端实时推送状态更新
//
// 协议：
//   客户端 → 服务端（JSON）：
//     { type: "auth", token: "..." }              // 首次认证
//     { type: "connect" }                          // 连接 Bot
//     { type: "disconnect" }                       // 断开 Bot
//     { type: "status" }                           // 获取状态
//     { type: "send", targetId: "", content: "", messageType?: "channel"|"group"|"private" }
//     { type: "monitor", monitorType?: "summary"|"health"|"detail"|"alert" }
//
//   服务端 → 客户端（JSON）：
//     { type: "auth_ok", team: { id, name, mode } }
//     { type: "auth_error", message: "..." }
//     { type: "status", data: BotRuntimeStatus }
//     { type: "connect_result", success: true, message: "..." }
//     { type: "disconnect_result", success: true, message: "..." }
//     { type: "send_result", success: true, message: "...", result: any }
//     { type: "monitor_result", success: true, ...data }
//     { type: "error", message: "..." }
// ════════════════════════════════════════════════════
import { defineWebSocketHandler } from 'h3'
import { verifyToken, type JWTPayload } from '../../lib/jwt'
import { prisma } from '../../lib/prisma'
import { connectBot, disconnectBot, readBotRuntimeStatus, getBotInstance } from '../../lib/bot-ws'
import { sendChannelMessage, sendGroupMessage, sendPrivateMessage } from '../../lib/bot-http'
import { getResourceSummary, getAllResourceSnapshots, getResourceAlert, getBotHealth } from '../../lib/bot-manager'

// 每个 WebSocket 连接的状态
interface PeerState {
  user: JWTPayload
  team: {
    id: string
    name: string
    mode: string
    botAppId: string | null
    botAppSecret: string | null
    botChannelId: string | null
  }
  authenticated: boolean
}

// 向客户端发送 JSON 消息（自动回传 requestId）
function send(peer: any, data: Record<string, unknown>): void {
  const reqId = (peer as any)._botReqId
  if (reqId) {
    data.requestId = reqId
    ;(peer as any)._botReqId = undefined // 单次使用后清除
  }
  peer.send(JSON.stringify(data))
}

// 向客户端发送错误
function sendError(peer: any, message: string): void {
  send(peer, { type: 'error', message })
}

// 鉴权：验证 token 并校验用户属于目标团队
async function authenticate(peer: any, token: string): Promise<PeerState | null> {
  const payload = verifyToken(token)
  if (!payload) {
    send(peer, { type: 'auth_error', message: '无效或过期的认证令牌' })
    return null
  }

  // 校验用户存在且 token 版本一致
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { tokenVersion: true },
  })
  if (!user || user.tokenVersion !== payload.tokenVersion) {
    send(peer, { type: 'auth_error', message: '账号已在其他设备登录，请重新登录' })
    return null
  }

  // 仅管理员可用
  if (payload.role !== 'admin' && payload.role !== 'system_admin') {
    send(peer, { type: 'auth_error', message: '权限不足，仅团队管理员可操作' })
    return null
  }

  const teamId = payload.teamId
  if (!teamId) {
    send(peer, { type: 'auth_error', message: '用户不属于任何团队' })
    return null
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      mode: true,
      botAppId: true,
      botAppSecret: true,
      botChannelId: true,
      botIsPrivate: true,
    },
  })

  if (!team) {
    send(peer, { type: 'auth_error', message: '团队不存在' })
    return null
  }

  if (team.mode !== 'qq_bot') {
    send(peer, { type: 'auth_error', message: '仅 QQ 频道模式团队可使用机器人功能' })
    return null
  }

  send(peer, { type: 'auth_ok', team: { id: team.id, name: team.name, mode: team.mode } })
  return { user: payload, team, authenticated: true }
}

// 获取实时状态并推送
function pushStatus(peer: any, state: PeerState): void {
  const runtimeStatus = readBotRuntimeStatus(state.team.id, {
    name: state.team.name,
    mode: state.team.mode,
    botAppId: state.team.botAppId,
    botAppSecret: state.team.botAppSecret,
    botChannelId: state.team.botChannelId,
    botIsPrivate: state.team.botIsPrivate,
  })
  send(peer, { type: 'status', data: runtimeStatus })
}

// 监听 Bot 实例状态变化，自动推送给客户端
function watchBotStatus(peer: any, state: PeerState): void {
  const instance = getBotInstance(state.team.id)
  if (!instance) return

  // 仅在状态发生变化时推送（已连接/断开/重连中...）
  // 每次推送后更新基准值，避免状态一旦变化就每秒重复推送
  let baseline = instance.status
  const interval = setInterval(() => {
    const inst = getBotInstance(state.team.id)
    if (!inst) {
      clearInterval(interval)
      ;(peer as any)._botStatusInterval = undefined
      return
    }
    if (inst.status !== baseline) {
      baseline = inst.status
      pushStatus(peer, state)
    }
  }, 1000)
  // 记录到 peer 上，close() 时才清得掉，避免连接关闭后定时器泄漏
  ;(peer as any)._botStatusInterval = interval
}

export default defineWebSocketHandler({
  open(peer) {
    console.log('[Bot WS] 客户端已连接')
    // 等待客户端发送 auth 消息
  },

  async message(peer, message) {
    try {
      // crossws 中 message.text 是方法，需调用 message.text() 获取文本内容
      const data = JSON.parse(message.text())

      // 存储本次请求的 requestId，后续 send() 会自动回传
      if (data.requestId) {
        (peer as any)._botReqId = data.requestId
      }

      // 获取已认证的状态（存储在 peer 上）
      const state = (peer as any)._botState as PeerState | undefined

      // ── 未认证时只接受 auth 消息 ──
      if (data.type === 'auth') {
        if (!data.token) {
          send(peer, { type: 'auth_error', message: '缺少认证令牌' })
          return
        }
        const newState = await authenticate(peer, data.token)
        if (newState) {
          (peer as any)._botState = newState
          // 认证成功后立即推送当前状态
          pushStatus(peer, newState)
          // 启动状态监控
          watchBotStatus(peer, newState)
        }
        return
      }

      if (!state || !state.authenticated) {
        sendError(peer, '请先认证：发送 { type: "auth", token: "..." }')
        return
      }

      // ── 已认证：处理各类指令 ──
      switch (data.type) {
        // ── 连接 Bot ──
        case 'connect': {
          if (!state.team.botAppId || !state.team.botAppSecret) {
            send(peer, { type: 'connect_result', success: false, message: 'Bot 未配置，请先完成配置' })
            return
          }
          connectBot(state.team.id, state.team.botAppId, state.team.botAppSecret, state.team.name, state.team.botChannelId, state.team.botIsPrivate ?? false)
          send(peer, { type: 'connect_result', success: true, message: 'Bot 正在连接...' })
          // 延迟推送最新状态（等连接建立）
          setTimeout(() => pushStatus(peer, state), 2000)
          break
        }

        // ── 断开 Bot ──
        case 'disconnect': {
          disconnectBot(state.team.id)
          send(peer, { type: 'disconnect_result', success: true, message: 'Bot 连接已断开' })
          setTimeout(() => pushStatus(peer, state), 500)
          break
        }

        // ── 获取状态 ──
        case 'status': {
          pushStatus(peer, state)
          break
        }

        // ── 发送测试消息 ──
        case 'send': {
          if (!data.targetId || !data.targetId.trim()) {
            send(peer, { type: 'send_result', success: false, message: '目标 ID 不能为空' })
            return
          }
          if (!data.content || !data.content.trim()) {
            send(peer, { type: 'send_result', success: false, message: '消息内容不能为空' })
            return
          }
          if (!state.team.botAppId || !state.team.botAppSecret) {
            send(peer, { type: 'send_result', success: false, message: 'Bot 未配置' })
            return
          }

          const credentials = { appId: state.team.botAppId, appSecret: state.team.botAppSecret }
          const messageType = data.messageType || 'channel'

          try {
            let result: unknown
            switch (messageType) {
              case 'group':
                result = await sendGroupMessage(credentials, data.targetId.trim(), data.content.trim())
                break
              case 'private':
                result = await sendPrivateMessage(credentials, data.targetId.trim(), data.content.trim())
                break
              case 'channel':
              default:
                result = await sendChannelMessage(credentials, data.targetId.trim(), data.content.trim())
                break
            }
            send(peer, { type: 'send_result', success: true, message: '消息发送成功', result })
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : '发送消息失败'
            send(peer, { type: 'send_result', success: false, message: msg })
          }
          break
        }

        // ── 资源监控 ──
        case 'monitor': {
          const monitorType = data.monitorType || 'summary'

          switch (monitorType) {
            case 'health': {
              if (!state.team.id) {
                send(peer, { type: 'monitor_result', success: false, message: '缺少 teamId' })
                return
              }
              const health = getBotHealth(state.team.id)
              send(peer, { type: 'monitor_result', success: true, teamId: state.team.id, ...health })
              break
            }
            case 'detail': {
              const snapshots = getAllResourceSnapshots()
              const summary = getResourceSummary()
              send(peer, { type: 'monitor_result', success: true, summary, bots: snapshots })
              break
            }
            case 'alert': {
              const alert = getResourceAlert()
              send(peer, { type: 'monitor_result', success: true, ...alert })
              break
            }
            default: {
              const summary = getResourceSummary()
              send(peer, { type: 'monitor_result', success: true, ...summary })
              break
            }
          }
          break
        }

        default:
          sendError(peer, `未知指令类型: ${data.type}`)
      }
    } catch (err: unknown) {
      console.error('[Bot WS] 消息处理异常:', err)
      const msg = err instanceof Error ? err.message : '处理消息时发生未知错误'
      sendError(peer, msg)
    }
  },

  close(peer) {
    console.log('[Bot WS] 客户端已断开')
    // 清理状态监控定时器
    const interval = (peer as any)._botStatusInterval
    if (interval) clearInterval(interval)
  },

  error(peer, error) {
    console.error('[Bot WS] WebSocket 错误:', error)
  },
})