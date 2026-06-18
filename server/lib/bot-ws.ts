// ════════════════════════════════════════════════════
// QQ Bot WebSocket 核心模块
// 从数据库读取 Bot 配置，建立 WebSocket 长连接
// ════════════════════════════════════════════════════

import WebSocket from 'ws'
import type { PrismaClient } from './generated/client'
import { handleMessage } from './bot-handlers'

// ---------- 类型定义 ----------

export interface BotConfig {
  appId: string
  appSecret: string
  teamId: string
  teamName: string
  channelId?: string | null
  intents?: string[]
  sandbox?: boolean
}

interface AccessTokenResponse {
  access_token: string
  expires_in: number
}

interface GatewayResponse {
  url: string
}

interface WebSocketPayload {
  op: number
  d: any
  s?: number
  t?: string
  id?: string
}

export interface BotInstance {
  config: BotConfig
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  /** Bot 用户名（READY 事件返回） */
  botUsername?: string
  /** Bot ID（READY 事件返回） */
  botId?: string
  /** WebSocket Session ID */
  sessionId?: string
  /** 心跳间隔（毫秒） */
  heartbeatInterval?: number
  /** 最近一次连接成功时间 */
  connectedAt?: number
  sendMessage: (channelId: string, content: string, msgId?: string) => Promise<any>
  sendGroupMessage: (groupId: string, content: string) => Promise<any>
  sendPrivateMessage: (userId: string, content: string) => Promise<any>
}

// ---------- 常量 ----------

const API_BASE_URL = 'https://api.sgroup.qq.com'
const TOKEN_URL = 'https://bots.qq.com/app/getAppAccessToken'
const GATEWAY_URL = 'https://api.sgroup.qq.com/gateway'

// ---------- 实例管理 ----------

const botInstances = new Map<string, BotInstance>()

// Gateway URL 全局缓存（QQ 官方 Gateway URL 短时间内稳定不变）
// 缓存 1 小时，避免频繁请求触发频率限制
let cachedGatewayUrl: string | null = null
let gatewayUrlExpiresAt = 0
const GATEWAY_CACHE_TTL = 60 * 60 * 1000 // 1 小时

// 每个 bot 实例的私有状态
const stateMap = new Map<string, {
  accessToken: string | null
  tokenExpiresAt: number
  ws: WebSocket | null
  sessionId: string | null
  lastSequence: number
  heartbeatInterval: ReturnType<typeof setInterval> | null
  // 重连退避状态：失败次数越多，间隔越长
  retryCount: number
  backoffTimer: ReturnType<typeof setTimeout> | null
}>()

function getState(teamId: string) {
  if (!stateMap.has(teamId)) {
    stateMap.set(teamId, {
      accessToken: null,
      tokenExpiresAt: 0,
      ws: null,
      sessionId: null,
      lastSequence: 0,
      heartbeatInterval: null,
      retryCount: 0,
      backoffTimer: null,
    })
  }
  return stateMap.get(teamId)!
}

/**
 * 计算指数退避间隔（毫秒）
 * 规则：5s → 10s → 20s → 40s → 80s → 120s（封顶）
 * 频率限制时额外延长到 180s
 */
function getBackoffMs(retryCount: number, rateLimited = false): number {
  const base = 5000
  const multiplier = Math.pow(2, Math.min(retryCount, 5)) // 2^0 到 2^5
  const ms = base * multiplier
  // 基础值 + 0-3 秒随机抖动，避免多 Bot 同时重连
  const jitter = Math.floor(Math.random() * 3000)
  return Math.min(ms + jitter, rateLimited ? 180000 : 120000)
}

// ---------- Token 管理 ----------

async function getAccessToken(config: BotConfig): Promise<string> {
  const state = getState(config.teamId)

  // 检查缓存
  if (state.accessToken && Date.now() < state.tokenExpiresAt - 60000) {
    return state.accessToken
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appId: config.appId,
      clientSecret: config.appSecret,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`获取 Access Token 失败: ${response.status} - ${text}`)
  }

  const json = (await response.json()) as AccessTokenResponse
  state.accessToken = json.access_token
  state.tokenExpiresAt = Date.now() + json.expires_in * 1000

  console.log(`[Bot][${config.teamName}] Access Token 已更新，有效期: ${json.expires_in} 秒`)
  return state.accessToken
}

// ---------- Gateway ----------

/**
 * 获取 Gateway URL（带全局缓存 + 频率限制检测）
 * Gateway URL 在短时间内稳定不变，缓存 1 小时可显著减少 API 请求次数
 * 同时检测频率限制错误（code: 100017），在上层做延长退避处理
 */
async function getGatewayUrl(config: BotConfig): Promise<string> {
  // 优先使用全局缓存（所有 Bot 共用同一个 Gateway URL）
  if (cachedGatewayUrl && Date.now() < gatewayUrlExpiresAt) {
    return cachedGatewayUrl
  }

  const token = await getAccessToken(config)
  const response = await fetch(GATEWAY_URL, {
    headers: {
      Authorization: `QQBot ${token}`,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    // 检测是否为频率限制（code: 100017），以便上层调用方做退避延长
    let isRateLimited = false
    try {
      const json = JSON.parse(text)
      if (json.code === 100017 || json.err_code === 40023001) {
        isRateLimited = true
      }
    } catch {
      // 解析失败保持 false
    }
    const err = new Error(`获取 Gateway URL 失败: ${response.status} - ${text}`)
    // 将频率限制信息附加到错误对象（通过 message 传递，reconnect 层解析）
    if (isRateLimited) {
      err.message = `[RATE_LIMITED] ${err.message}`
    }
    throw err
  }

  const json = (await response.json()) as GatewayResponse
  // 缓存 Gateway URL
  cachedGatewayUrl = json.url
  gatewayUrlExpiresAt = Date.now() + GATEWAY_CACHE_TTL
  console.log(`[Bot][${config.teamName}] Gateway URL 已获取并缓存（1 小时）`)
  return json.url
}

// ---------- HTTP API 调用 ----------

export async function callBotApi(
  config: BotConfig,
  path: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<any> {
  const token = await getAccessToken(config)
  const url = `${API_BASE_URL}${path}`

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `QQBot ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const responseText = await response.text()

  if (!response.ok) {
    throw new Error(`Bot API 调用失败: ${response.status} - ${responseText}`)
  }

  return responseText ? JSON.parse(responseText) : {}
}

// ---------- Intents 计算 ----------

function calculateIntentsValue(intents: string[]): number {
  const intentMap: Record<string, number> = {
    GUILDS: 1 << 0,
    GUILD_MEMBERS: 1 << 1,
    GUILD_MESSAGES: 1 << 2,           // 私域消息
    GUILD_MESSAGE_REACTIONS: 1 << 4,
    DIRECT_MESSAGE: 1 << 5,
    INTERACTION: 1 << 6,
    MESSAGE_AUDIT: 1 << 7,
    FORUMS_EVENT: 1 << 8,
    AUDIO_ACTION: 1 << 9,
    PUBLIC_GUILD_MESSAGES: 1 << 30,   // 公域消息（AITalent等）
    GROUP_AND_C2C_EVENT: 1 << 25,     // 群聊 + 私聊
  }

  let value = 0
  for (const intent of intents) {
    if (intentMap[intent]) {
      value |= intentMap[intent]
    }
  }
  return value
}

// ---------- WebSocket 连接 ----------

function connectWebSocket(config: BotConfig, gatewayUrl: string): void {
  const state = getState(config.teamId)

  // 关闭旧连接
  if (state.ws) {
    state.ws.close()
    state.ws = null
  }

  const instance = botInstances.get(config.teamId)
  if (instance) instance.status = 'connecting'

  state.ws = new WebSocket(gatewayUrl)

  state.ws.on('open', () => {
    console.log(`[Bot][${config.teamName}] WebSocket 连接已建立`)
    if (instance) instance.status = 'connected'
  })

  state.ws.on('message', (data: WebSocket.Data) => {
    try {
      const payload: WebSocketPayload = JSON.parse(data.toString())
      handleWebSocketMessage(config, payload)
    } catch (err) {
      console.error(`[Bot][${config.teamName}] 解析消息失败:`, err)
    }
  })

  state.ws.on('close', (code: number, reason: Buffer) => {
    console.log(`[Bot][${config.teamName}] WebSocket 连接关闭: ${code}`)
    if (instance) instance.status = 'disconnected'

    if (state.heartbeatInterval) {
      clearInterval(state.heartbeatInterval)
      state.heartbeatInterval = null
    }

    // 自动重连（使用指数退避，避免频繁重连触发频率限制）
    const backoffMs = getBackoffMs(state.retryCount)
    state.retryCount += 1
    console.log(`[Bot][${config.teamName}] ${Math.round(backoffMs / 1000)} 秒后尝试重连（第 ${state.retryCount} 次）`)
    state.backoffTimer = setTimeout(() => {
      reconnectWebSocket(config)
    }, backoffMs)
  })

  state.ws.on('error', (err: Error) => {
    console.error(`[Bot][${config.teamName}] WebSocket 错误:`, err.message)
    if (instance) instance.status = 'error'
  })
}

function handleWebSocketMessage(config: BotConfig, payload: WebSocketPayload): void {
  const state = getState(config.teamId)
  const { op, d, s, t } = payload

  if (s !== undefined) {
    state.lastSequence = s
  }

  switch (op) {
    case 10: // Hello
      console.log(`[Bot][${config.teamName}] 收到 Hello, 心跳间隔: ${d.heartbeat_interval}ms`)
      // 记录心跳间隔到 Bot 实例
      const inst = botInstances.get(config.teamId)
      if (inst) inst.heartbeatInterval = d.heartbeat_interval
      startHeartbeat(config, d.heartbeat_interval)
      sendIdentify(config)
      break

    case 11: // Heartbeat ACK
      // 静默处理心跳确认
      break

    case 0: // Dispatch
      handleDispatchEvent(config, t, d)
      break

    case 7: // Reconnect
      console.log(`[Bot][${config.teamName}] 服务端要求重连`)
      reconnectWebSocket(config)
      break

    case 9: // Invalid Session
      console.log(`[Bot][${config.teamName}] Session 无效，重新连接`)
      state.sessionId = null
      reconnectWebSocket(config)
      break

    default:
      console.log(`[Bot][${config.teamName}] 收到 OpCode: ${op}`)
  }
}

function startHeartbeat(config: BotConfig, intervalMs: number): void {
  const state = getState(config.teamId)

  if (state.heartbeatInterval) {
    clearInterval(state.heartbeatInterval)
  }

  state.heartbeatInterval = setInterval(() => {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify({ op: 1, d: state.lastSequence }))
    }
  }, intervalMs)
}

async function sendIdentify(config: BotConfig): Promise<void> {
  const state = getState(config.teamId)
  const token = await getAccessToken(config)
  const intents = config.intents || ['PUBLIC_GUILD_MESSAGES', 'GROUP_AND_C2C_EVENT']
  const intentsValue = calculateIntentsValue(intents)

  const identifyPayload = {
    op: 2,
    d: {
      token: `QQBot ${token}`,
      intents: intentsValue,
      shard: [0, 1],
      properties: {
        $os: 'windows',
        $browser: 'nodejs',
        $device: 'nodejs',
      },
    },
  }

  state.ws?.send(JSON.stringify(identifyPayload))
  console.log(`[Bot][${config.teamName}] 已发送 Identify`)
}

// ---------- 事件分发 ----------

function handleDispatchEvent(config: BotConfig, eventType: string | undefined, data: any): void {
  if (!eventType) return

  switch (eventType) {
    case 'READY':
      getState(config.teamId).sessionId = data.session_id
      console.log(`[Bot][${config.teamName}] READY，Session: ${data.session_id}`)
      // 记录 Bot 运行时信息
      const inst2 = botInstances.get(config.teamId)
      if (inst2) {
        inst2.botUsername = data.user?.username
        inst2.botId = data.user?.id
        inst2.sessionId = data.session_id
        inst2.connectedAt = Date.now()
      }
      break

    case 'RESUMED':
      console.log(`[Bot][${config.teamName}] 连接已恢复`)
      break

    case 'PUBLIC_GUILD_MESSAGES':
    case 'GUILD_MESSAGES':
    case 'AT_MESSAGE_CREATE':
      handleChannelMessage(config, data)
      break

    case 'C2C_MESSAGE_CREATE':
      handlePrivateMessage(config, data)
      break

    case 'GROUP_AT_MESSAGE_CREATE':
      handleGroupMessage(config, data)
      break

    default:
      // 仅打印非高频事件
      if (eventType !== 'GUILD_CREATE' && eventType !== 'GUILD_UPDATE') {
        console.log(`[Bot][${config.teamName}] 事件: ${eventType}`)
      }
  }
}

// ---------- 消息处理 ----------

function handleChannelMessage(config: BotConfig, data: any): void {
  const msg = data
  if (!msg || !msg.channel_id) return

  // 去掉 @机器人 标记
  let content = (msg.content || '').replace(/<@!\d+>/g, '').trim()
  if (!content) return

  console.log(`[Bot][${config.teamName}] 频道消息: ${msg.author?.username || '?'}: ${content}`)

  const result = handleMessage({
    channelId: msg.channel_id,
    userId: msg.author?.id,
    content,
  })

  if (result.handled && result.reply) {
    const instance = botInstances.get(config.teamId)
    instance?.sendMessage(msg.channel_id, result.reply, msg.id).catch((err) => {
      console.error(`[Bot][${config.teamName}] 回复失败:`, err)
    })
  }
}

function handlePrivateMessage(config: BotConfig, data: any): void {
  const msg = data?.d || data
  if (!msg) return

  console.log(`[Bot][${config.teamName}] 私聊消息: ${msg.author?.id}: ${msg.content}`)

  const result = handleMessage({
    channelId: msg.author?.id,
    userId: msg.author?.id,
    content: msg.content || '',
  })

  if (result.handled && result.reply) {
    const instance = botInstances.get(config.teamId)
    instance?.sendPrivateMessage(msg.author?.id, result.reply).catch((err) => {
      console.error(`[Bot][${config.teamName}] 私聊回复失败:`, err)
    })
  }
}

function handleGroupMessage(config: BotConfig, data: any): void {
  const msg = data?.d || data
  if (!msg) return

  console.log(`[Bot][${config.teamName}] 群消息: ${msg.group_openid}: ${msg.content}`)

  const result = handleMessage({
    channelId: msg.group_openid,
    userId: msg.author?.member_openid,
    content: msg.content || '',
  })

  if (result.handled && result.reply) {
    const instance = botInstances.get(config.teamId)
    instance?.sendGroupMessage(msg.group_openid, result.reply).catch((err) => {
      console.error(`[Bot][${config.teamName}] 群回复失败:`, err)
    })
  }
}

// ---------- 重连 ----------

async function reconnectWebSocket(config: BotConfig): Promise<void> {
  const state = getState(config.teamId)
  try {
    const gatewayUrl = await getGatewayUrl(config)
    // 成功连接后，重置重连计数器（下次失败重新从 5s 开始）
    state.retryCount = 0
    connectWebSocket(config, gatewayUrl)
  } catch (err) {
    // 解析是否为频率限制错误
    const errMsg = err instanceof Error ? err.message : String(err)
    const isRateLimited = errMsg.includes('RATE_LIMITED') || errMsg.includes('100017') || errMsg.includes('40023001')

    if (isRateLimited) {
      // 频率限制：延长退避并记录
      const backoffMs = getBackoffMs(state.retryCount, true)
      state.retryCount += 1
      console.warn(`[Bot][${config.teamName}] API 频率限制（code: 100017），${Math.round(backoffMs / 1000)} 秒后再试`)
      state.backoffTimer = setTimeout(() => reconnectWebSocket(config), backoffMs)
    } else {
      // 其他错误：正常指数退避
      const backoffMs = getBackoffMs(state.retryCount)
      state.retryCount += 1
      console.error(`[Bot][${config.teamName}] 重连失败（${state.retryCount} 次），${Math.round(backoffMs / 1000)} 秒后再试:`, errMsg)
      state.backoffTimer = setTimeout(() => reconnectWebSocket(config), backoffMs)
    }
  }
}

// ---------- 公共 API ----------

/**
 * 根据 BotConfig 启动一个 Bot 实例
 */
export function createBotInstance(config: BotConfig): BotInstance {
  const instance: BotInstance = {
    config,
    status: 'disconnected',
    sendMessage: async (channelId, content, msgId) => {
      const body: Record<string, unknown> = { content }
      if (msgId) {
        body.msg_id = msgId
        body.message_reference = { message_id: msgId }
      }
      return callBotApi(config, `/channels/${channelId}/messages`, 'POST', body)
    },
    sendGroupMessage: async (groupId, content) => {
      return callBotApi(config, `/v2/groups/${groupId}/messages`, 'POST', { content, msg_type: 0 })
    },
    sendPrivateMessage: async (userId, content) => {
      return callBotApi(config, `/v2/users/${userId}/messages`, 'POST', { content, msg_type: 0 })
    },
  }

  botInstances.set(config.teamId, instance)

  // 启动 WebSocket 连接
  if (config.appId && config.appSecret) {
    getGatewayUrl(config)
      .then((gatewayUrl) => connectWebSocket(config, gatewayUrl))
      .catch((err) => console.error(`[Bot][${config.teamName}] 启动失败:`, err))
  }

  console.log(`[Bot][${config.teamName}] Bot 实例已创建`)
  return instance
}

/**
 * 获取指定团队的 Bot 实例
 */
export function getBotInstance(teamId: string): BotInstance | undefined {
  return botInstances.get(teamId)
}

/**
 * 获取所有 Bot 实例
 */
export function getAllBotInstances(): Map<string, BotInstance> {
  return botInstances
}

/**
 * 停止指定团队的 Bot（保留配置，仅断 WebSocket）
 */
export function disconnectBot(teamId: string): void {
  const state = stateMap.get(teamId)
  if (state) {
    if (state.ws) {
      state.ws.close()
      state.ws = null
    }
    if (state.heartbeatInterval) {
      clearInterval(state.heartbeatInterval)
      state.heartbeatInterval = null
    }
    // 清理退避重连计时器
    if (state.backoffTimer) {
      clearTimeout(state.backoffTimer)
      state.backoffTimer = null
    }
    state.retryCount = 0
  }
  const instance = botInstances.get(teamId)
  if (instance) {
    instance.status = 'disconnected'
    instance.sessionId = undefined
    instance.connectedAt = undefined
  }
  console.log(`[Bot] 已断开团队 Bot WebSocket`)
}

/**
 * 重新连接已配置的 Bot
 */
export function connectBot(teamId: string, botAppId: string, botAppSecret: string, teamName: string, channelId?: string | null): void {
  // 先断开旧连接
  disconnectBot(teamId)

  const config: BotConfig = {
    appId: botAppId,
    appSecret: botAppSecret,
    teamId,
    teamName,
    channelId,
    intents: ['PUBLIC_GUILD_MESSAGES', 'GROUP_AND_C2C_EVENT'],
  }

  // 确保实例存在
  let instance = botInstances.get(teamId)
  if (!instance) {
    instance = {
      config,
      status: 'connecting',
      sendMessage: async (chId, content, msgId) => {
        const b: Record<string, unknown> = { content }
        if (msgId) { b.msg_id = msgId; b.message_reference = { message_id: msgId } }
        return callBotApi(config, `/channels/${chId}/messages`, 'POST', b)
      },
      sendGroupMessage: async (gId, content) => {
        return callBotApi(config, `/v2/groups/${gId}/messages`, 'POST', { content, msg_type: 0 })
      },
      sendPrivateMessage: async (uId, content) => {
        return callBotApi(config, `/v2/users/${uId}/messages`, 'POST', { content, msg_type: 0 })
      },
    }
    botInstances.set(teamId, instance)
  } else {
    instance.status = 'connecting'
  }

  // 启动 WebSocket
  getGatewayUrl(config)
    .then((url) => connectWebSocket(config, url))
    .catch((err) => console.error(`[Bot][${teamName}] 重新连接失败:`, err))

  console.log(`[Bot][${teamName}] 正在重新连接...`)
}

/**
 * 获取 Bot 所在的频道列表（需要已连接且 Token 有效）
 */
export async function fetchBotGuilds(teamId: string): Promise<{
  guilds: Array<{ id: string; name: string; ownerId?: string; joinedAt?: string }>
  error?: string
}> {
  const instance = botInstances.get(teamId)
  if (!instance) {
    return { guilds: [], error: 'Bot 未配置或未启动' }
  }

  try {
    const data = await callBotApi(instance.config, '/users/@me/guilds', 'GET')
    // QQ Bot API 返回的可能是数组，也可能包裹在 { data: [...] } 中
    const guilds = Array.isArray(data) ? data : (data.data || [])
    return {
      guilds: guilds.map((g: any) => ({
        id: g.id,
        name: g.name,
        ownerId: g.owner_id,
        joinedAt: g.joined_at,
      })),
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '获取频道列表失败'
    return { guilds: [], error: msg }
  }
}

/**
 * 停止并删除指定团队的 Bot（全清除）
 */
export function stopBotInstance(teamId: string): void {
  const state = getState(teamId)
  if (state.ws) {
    state.ws.close()
    state.ws = null
  }
  if (state.heartbeatInterval) {
    clearInterval(state.heartbeatInterval)
    state.heartbeatInterval = null
  }
  if (state.backoffTimer) {
    clearTimeout(state.backoffTimer)
    state.backoffTimer = null
  }
  stateMap.delete(teamId)
  botInstances.delete(teamId)
}

// ---------- 运行时状态查询 ----------

export interface BotRuntimeStatus {
  /** 是否已配置 Bot 凭证 */
  configured: boolean
  /** 团队名称 */
  teamName: string
  /** 团队模式 */
  teamMode: string
  /** 脱敏 App ID */
  appId: string | null
  /** 频道 ID */
  channelId: string | null
  /** WebSocket 连接状态 */
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' | 'not_configured'
  /** Bot 用户名 */
  botUsername?: string
  /** Bot ID */
  botId?: string
  /** Session ID */
  sessionId?: string
  /** 心跳间隔（毫秒） */
  heartbeatInterval?: number
  /** 已连接时长（秒），-1 表示未连接 */
  connectedDuration: number
}

/**
 * 获取指定团队的 Bot 运行时状态
 * 【按需启动】如果已配置 Bot 但实例未运行，则自动创建并启动实例
 */
export function getBotRuntimeStatus(teamId: string, teamInfo: {
  name: string
  mode: string
  botAppId?: string | null
  botAppSecret?: string | null
  botChannelId?: string | null
}): BotRuntimeStatus {
  const instance = botInstances.get(teamId)
  const hasConfig = !!(teamInfo.botAppId && teamInfo.botAppSecret)

  // ── 按需启动：已配置但未运行 → 自动启动 Bot ──
  if (
    hasConfig &&
    (!instance || instance.status === 'disconnected')
  ) {
    console.log(`[Bot] 按需启动团队「${teamInfo.name}」的 Bot 实例...`)
    createBotInstance({
      appId: teamInfo.botAppId!,
      appSecret: teamInfo.botAppSecret!,
      teamId,
      teamName: teamInfo.name,
      channelId: teamInfo.botChannelId,
      intents: ['PUBLIC_GUILD_MESSAGES', 'GROUP_AND_C2C_EVENT'],
    })
  }

  // 重新获取实例（可能刚创建）
  const activeInstance = botInstances.get(teamId)
  const isConfigured = !!(teamInfo.botAppId && activeInstance)

  const status: BotRuntimeStatus = {
    configured: isConfigured,
    teamName: teamInfo.name,
    teamMode: teamInfo.mode,
    appId: teamInfo.botAppId
      ? teamInfo.botAppId.length > 10
        ? teamInfo.botAppId.slice(0, 6) + '****' + teamInfo.botAppId.slice(-4)
        : teamInfo.botAppId
      : null,
    channelId: teamInfo.botChannelId || null,
    connectionStatus: 'not_configured',
    connectedDuration: -1,
  }

  if (activeInstance) {
    status.connectionStatus = activeInstance.status
    status.botUsername = activeInstance.botUsername
    status.botId = activeInstance.botId
    status.sessionId = activeInstance.sessionId
    status.heartbeatInterval = activeInstance.heartbeatInterval
    if (activeInstance.connectedAt && activeInstance.status === 'connected') {
      status.connectedDuration = Math.floor(
        (Date.now() - activeInstance.connectedAt) / 1000,
      )
    }
  }

  return status
}

/**
 * 从数据库加载所有 QQ 频道团队并启动 Bot
 */
export async function loadBotsFromDatabase(prisma: PrismaClient): Promise<void> {
  try {
    const teams = await prisma.team.findMany({
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

    if (teams.length === 0) {
      console.log('[Bot] 暂无已配置 Bot 的 QQ 频道团队')
      return
    }

    // 多个 Bot 错峰启动（每个 Bot 延迟 0-2 秒，避免同时请求 Gateway URL 触发频率限制）
    // 且第一个 Bot 会先获取并缓存 Gateway URL，后续 Bot 可直接使用缓存
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i]
      if (!team) continue
      const botAppId = team.botAppId
      const botAppSecret = team.botAppSecret
      if (!botAppId || !botAppSecret) continue

      // 每个 Bot 延迟 i * 2000 + 0-2000ms 随机抖动后启动
      const delayMs = i * 2000 + Math.floor(Math.random() * 2000)
      const teamName = team.name

      setTimeout(() => {
        console.log(`[Bot] 正在为团队「${teamName}」启动 Bot...`)
        createBotInstance({
          appId: botAppId,
          appSecret: botAppSecret,
          teamId: team.id,
          teamName: team.name,
          channelId: team.botChannelId ?? null,
          intents: ['PUBLIC_GUILD_MESSAGES', 'GROUP_AND_C2C_EVENT'],
        })
      }, delayMs)
    }

    console.log(`[Bot] 已调度 ${teams.length} 个 Bot 错峰启动（间隔约 2 秒）`)
  } catch (err) {
    console.error('[Bot] 从数据库加载 Bot 配置失败:', err)
  }
}
