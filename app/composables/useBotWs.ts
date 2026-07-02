// ════════════════════════════════════════════════════
// useBotWs — Bot WebSocket 连接 composable
// 替代原有的 HTTP API 调用（connect/disconnect/status/send/monitor）
// 使用方式：在 bot 管理页面调用 useBotWs()，获得响应式状态和操作方法
// ════════════════════════════════════════════════════

interface BotStatus {
  configured: boolean
  teamName: string
  appId: string | null
  channelId: string | null
  connectionStatus: string
  botUsername?: string
  botId?: string
  sessionId?: string
  heartbeatInterval?: number
  connectedDuration: number
}

interface BotWsState {
  ws: WebSocket | null
  connected: boolean
  authenticated: boolean
  status: BotStatus | null
  lastError: string
  shouldReconnect: boolean  // 修复：控制是否自动重连
  // 待处理请求的回调
  pendingRequests: Map<string, {
    resolve: (data: any) => void
    reject: (err: Error) => void
  }>
}

export function useBotWs() {
  const store = useAuthStore()
  const state = reactive<BotWsState>({
    ws: null,
    connected: false,
    authenticated: false,
    status: null,
    lastError: '',
    shouldReconnect: true,  // 默认开启自动重连
    pendingRequests: new Map(),
  })

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let requestIdCounter = 0

  // 生成唯一请求 ID
  function nextRequestId(): string {
    return `req_${++requestIdCounter}`
  }

  // 发送 WebSocket 消息并等待响应
  function sendAndWait(type: string, payload?: Record<string, unknown>): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket 未连接'))
        return
      }
      const reqId = nextRequestId()
      state.pendingRequests.set(reqId, { resolve, reject })
      state.ws.send(JSON.stringify({ type, requestId: reqId, ...payload }))
      // 超时保护（30 秒）
      setTimeout(() => {
        const pending = state.pendingRequests.get(reqId)
        if (pending) {
          state.pendingRequests.delete(reqId)
          pending.reject(new Error('请求超时'))
        }
      }, 30000)
    })
  }

  // 连接 WebSocket
  function connect() {
    if (state.ws && (state.ws.readyState === WebSocket.OPEN || state.ws.readyState === WebSocket.CONNECTING)) {
      return // 已连接或正在连接
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/bot/ws`
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      state.connected = true
      state.lastError = ''
      // 发送认证
      ws.send(JSON.stringify({ type: 'auth', token: store.token }))
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        handleMessage(data)
      } catch {
        console.warn('[Bot WS] 无法解析消息:', event.data)
      }
    }

    ws.onclose = () => {
      state.connected = false
      state.authenticated = false
      // 修复：根据 shouldReconnect 标志决定是否自动重连
      // auth_error 时会将 shouldReconnect 设为 false，避免认证失败→断开→重连→认证失败的死循环
      if (state.shouldReconnect) {
        if (reconnectTimer) clearTimeout(reconnectTimer)
        reconnectTimer = setTimeout(() => connect(), 3000)
      }
    }

    ws.onerror = () => {
      state.lastError = 'WebSocket 连接错误'
    }

    state.ws = ws
  }

  // 处理服务端消息
  function handleMessage(data: any) {
    switch (data.type) {
      case 'auth_ok':
        state.authenticated = true
        state.lastError = ''
        state.shouldReconnect = true  // 认证成功，开启自动重连
        break

      case 'auth_error':
        state.authenticated = false
        state.lastError = data.message || '认证失败'
        state.shouldReconnect = false  // 修复：认证失败时关闭自动重连，避免死循环
        state.ws?.close()
        break

      case 'status':
        state.status = data.data
        break

      // 带 requestId 的响应
      case 'connect_result':
      case 'disconnect_result':
      case 'send_result':
      case 'monitor_result':
        if (data.requestId) {
          const pending = state.pendingRequests.get(data.requestId)
          if (pending) {
            state.pendingRequests.delete(data.requestId)
            if (data.success) {
              pending.resolve(data)
            } else {
              pending.reject(new Error(data.message || '操作失败'))
            }
          }
        }
        break

      case 'error':
        state.lastError = data.message || '未知错误'
        // 如果有 requestId，也 reject 对应的请求
        if (data.requestId) {
          const pending = state.pendingRequests.get(data.requestId)
          if (pending) {
            state.pendingRequests.delete(data.requestId)
            pending.reject(new Error(data.message || '操作失败'))
          }
        }
        break
    }
  }

  // 断开 WebSocket
  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    state.shouldReconnect = false  // 修复：主动断开时关闭自动重连
    state.ws?.close()
    state.ws = null
    state.connected = false
    state.authenticated = false
  }

  // ── 对外暴露的操作方法 ──

  /** 获取 Bot 状态（通过 WebSocket 请求） */
  async function fetchStatus(): Promise<BotStatus> {
    const result = await sendAndWait('status')
    return result.data
  }

  /** 连接 Bot */
  async function connectBot(): Promise<{ success: boolean; message: string }> {
    return sendAndWait('connect')
  }

  /** 断开 Bot */
  async function disconnectBot(): Promise<{ success: boolean; message: string }> {
    return sendAndWait('disconnect')
  }

  /** 发送测试消息 */
  async function sendMessage(params: {
    targetId: string
    content: string
    messageType?: 'channel' | 'group' | 'private'
  }): Promise<{ success: boolean; message: string; result?: any }> {
    return sendAndWait('send', params)
  }

  /** 获取资源监控 */
  async function fetchMonitor(type?: string): Promise<any> {
    return sendAndWait('monitor', { monitorType: type })
  }

  return {
    state,
    connect,
    disconnect,
    fetchStatus,
    connectBot,
    disconnectBot,
    sendMessage,
    fetchMonitor,
  }
}