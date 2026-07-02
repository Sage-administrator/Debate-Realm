// ════════════════════════════════════════════════════
// QQ Bot WebSocket 核心模块
// 从数据库读取 Bot 配置，建立 WebSocket 长连接
// ════════════════════════════════════════════════════

import WebSocket from 'ws'
import type { PrismaClient } from './generated/client'
import { prisma } from './prisma'
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
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'
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
const SANDBOX_API_BASE_URL = 'https://sandbox.api.sgroup.qq.com'
const TOKEN_URL = 'https://bots.qq.com/app/getAppAccessToken'
const GATEWAY_URL = 'https://api.sgroup.qq.com/gateway'
const SANDBOX_GATEWAY_URL = 'https://sandbox.api.sgroup.qq.com/gateway'

// 沙箱模式：通过环境变量 BOT_SANDBOX=true 启用（沙箱 Bot 的 token 仅在沙箱网关有效）
const isSandboxMode = process.env.BOT_SANDBOX === 'true'
if (isSandboxMode) {
  console.log('[Bot] ⚠ 沙箱模式已启用，将使用 QQ Bot 沙箱环境（sandbox.api.sgroup.qq.com）')
}

// ---------- 实例管理 ----------

const botInstances = new Map<string, BotInstance>()

// 已关闭/解绑的 Bot 团队集合：放入后不再允许自动重连
// 仅 createBotInstance 手动调用时会清除此标志
const shutDownTeams = new Set<string>()

// 消息去重：记录最近处理的消息 ID，防止 QQ 平台重复推送
// 使用 Set + 数组实现 FIFO，容量上限 200 条
const MAX_DEDUP_SIZE = 200
const processedMessageIds = new Set<string>()
const processedMessageQueue: string[] = []

/** 检查并记录消息是否已处理（去重） */
function checkAndMarkMessage(msgId: string): boolean {
  if (!msgId) return false // 无消息 ID 时不做去重
  if (processedMessageIds.has(msgId)) {
    return true // 已处理过
  }
  // 加入队列
  processedMessageIds.add(msgId)
  processedMessageQueue.push(msgId)
  // FIFO 淘汰：超出容量时移除最旧条目
  if (processedMessageQueue.length > MAX_DEDUP_SIZE) {
    const oldest = processedMessageQueue.shift()!
    processedMessageIds.delete(oldest)
  }
  return false // 未处理过
}

// Gateway URL 全局缓存（QQ 官方 Gateway URL 短时间内稳定不变）
// 缓存 1 小时，避免频繁请求触发频率限制
let cachedGatewayUrl: string | null = null
let gatewayUrlExpiresAt = 0
const GATEWAY_CACHE_TTL = 60 * 60 * 1000 // 1 小时

// intents 降级列表：从最常见的权限组合开始，逐步尝试更小的子集
// 当 op=9（Invalid Session）时，自动切换到下一个配置重试
// 注意：QQ 官方测试 Bot 通常只需要 intents=1 (GUILDS)
const FALLBACK_INTENTS: Array<{ name: string; value: number }> = [
  { name: 'GUILDS (1<<0)', value: 1 << 0 },
  { name: 'GUILDS | PUBLIC_GUILD_MESSAGES', value: (1 << 0) | (1 << 30) },
  { name: 'PUBLIC_GUILD_MESSAGES', value: 1 << 30 },
  { name: 'GUILDS | INTERACTION', value: (1 << 0) | (1 << 26) },
  { name: 'GUILDS | PUBLIC_GUILD_MESSAGES | INTERACTION', value: (1 << 0) | (1 << 30) | (1 << 26) },
  { name: 'GUILDS | GUILD_MESSAGES', value: (1 << 0) | (1 << 9) },
  { name: 'GUILDS | GUILD_MEMBERS | PUBLIC_GUILD_MESSAGES', value: (1 << 0) | (1 << 1) | (1 << 30) },
  { name: 'GUILDS | PUBLIC_GUILD_MESSAGES | GROUP_AND_C2C', value: (1 << 0) | (1 << 30) | (1 << 25) },
  { name: 'PUBLIC_GUILD_MESSAGES | GROUP_AND_C2C', value: (1 << 30) | (1 << 25) },
  { name: 'INTERACTION (1<<26)', value: 1 << 26 },
]

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
  // intents 降级索引：当 intents 不匹配时，逐步尝试其他配置
  intentIndex: number
  // intents 降级完整轮次：2 轮后停止重连，避免无限循环
  fullRoundsTried: number
  // 熔断标志：circuitBreaker = true 时，所有重连尝试都被阻止
  circuitBreaker: boolean
}>()

function getState(teamId: string) {
  // 如果团队已被关闭/解绑，不创建新状态，返回空的只读状态
  if (shutDownTeams.has(teamId)) {
    return {
      accessToken: null,
      tokenExpiresAt: 0,
      ws: null,
      sessionId: null,
      lastSequence: 0,
      heartbeatInterval: null,
      retryCount: 0,
      backoffTimer: null,
      intentIndex: 0,
      fullRoundsTried: 0,
      circuitBreaker: true,
    }
  }
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
      intentIndex: 0,
      fullRoundsTried: 0,
      circuitBreaker: false,
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
    console.error(`[Bot][${config.teamName}] ❌ 获取 Access Token 失败: HTTP ${response.status} - ${text}`)
    console.error(`[Bot][${config.teamName}]    使用的 appId: ${config.appId}`)
    console.error(`[Bot][${config.teamName}]    使用的 secret: ${config.appSecret.substring(0, 8)}...(${config.appSecret.length} 字符)`)
    throw new Error(`获取 Access Token 失败: ${response.status} - ${text}`)
  }

  const json = (await response.json()) as AccessTokenResponse
  state.accessToken = json.access_token
  state.tokenExpiresAt = Date.now() + json.expires_in * 1000

  console.log(`[Bot][${config.teamName}] ✅ Access Token 已更新 (appId=${config.appId})，有效期: ${json.expires_in} 秒`)
  return state.accessToken
}

// ---------- Gateway ----------

/**
 * 获取 Gateway URL（带全局缓存 + 频率限制检测）
 * Gateway URL 在短时间内稳定不变，缓存 1 小时可显著减少 API 请求次数
 * 同时检测频率限制错误（code: 100017），在上层做延长退避处理
 */
async function getGatewayUrl(config: BotConfig): Promise<string> {
  // 沙箱模式使用沙箱网关
  const gatewayUrl = isSandboxMode ? SANDBOX_GATEWAY_URL : GATEWAY_URL

  // 优先使用全局缓存（所有 Bot 共用同一个 Gateway URL）
  if (cachedGatewayUrl && Date.now() < gatewayUrlExpiresAt) {
    return cachedGatewayUrl
  }

  const token = await getAccessToken(config)
  const response = await fetch(gatewayUrl, {
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
  const baseUrl = isSandboxMode ? SANDBOX_API_BASE_URL : API_BASE_URL
  const url = `${baseUrl}${path}`

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
    GUILDS: 1 << 0,                  // 频道
    GUILD_MEMBERS: 1 << 1,          // 频道成员
    GUILD_MESSAGES: 1 << 9,         // 私域消息（官方文档: 1 << 9）
    GUILD_MESSAGE_REACTIONS: 1 << 10, // 消息表态
    DIRECT_MESSAGE: 1 << 12,        // 私聊消息
    INTERACTION: 1 << 26,           // 互动事件
    MESSAGE_AUDIT: 1 << 27,         // 消息审核
    FORUMS_EVENT: 1 << 28,          // 论坛事件
    AUDIO_ACTION: 1 << 29,          // 音频动作
    PUBLIC_GUILD_MESSAGES: 1 << 30, // 公域消息（AITalent等）
    GROUP_AND_C2C_EVENT: 1 << 25,   // 群聊 + 私聊
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

  // 🔄 重置熔断标志：每次主动连接都重置，允许新的尝试
  state.circuitBreaker = false

  // 清理旧连接和待执行的重连定时器（防止旧 close 事件触发的定时器与新连接竞争）
  if (state.backoffTimer) {
    clearTimeout(state.backoffTimer)
    state.backoffTimer = null
  }
  if (state.ws) {
    // 移除旧 close 监听，防止旧连接 close 事件触发新一轮重连
    state.ws.removeAllListeners('close')
    state.ws.close()
    state.ws = null
  }

  const instance = botInstances.get(config.teamId)
  if (instance) instance.status = 'connecting'

  state.ws = new WebSocket(gatewayUrl)
  // 捕获当前 WebSocket 引用，防止后续重连覆盖 state.ws 导致回调中使用错误的连接
  const ws = state.ws

  ws.on('open', () => {
    console.log(`[Bot][${config.teamName}] WebSocket 连接已建立`)
    if (instance) instance.status = 'connected'
  })

  ws.on('message', (data: WebSocket.Data) => {
    try {
      const payload: WebSocketPayload = JSON.parse(data.toString())
      handleWebSocketMessage(config, payload, ws)
    } catch (err) {
      console.error(`[Bot][${config.teamName}] 解析消息失败:`, err)
    }
  })

  ws.on('close', (code: number, reason: Buffer) => {
    console.log(`[Bot][${config.teamName}] WebSocket 连接关闭: ${code}`)
    // 🔴 熔断检查：熔断已触发，不做任何重连
    if (state.circuitBreaker) {
      console.log(`[Bot][${config.teamName}] 🔴 熔断已激活，停止所有自动重连（close 事件）`)
      return
    }
    // 停止心跳，但注意：如果 op=9 已经调用了 scheduleReconnect，backoffTimer 已被设置
    if (state.heartbeatInterval) {
      clearInterval(state.heartbeatInterval)
      state.heartbeatInterval = null
    }

    // ⚠️ 关键：先判断是否已有重连任务排队，再设置状态
    // - 有 backoffTimer → 状态是 reconnecting（保持重连中，避免 getBotRuntimeStatus 又创建新实例）
    // - 无 backoffTimer → 真正 disconnected，需要调度新的重连
    if (state.backoffTimer) {
      // scheduleReconnect 已设置过 status = 'reconnecting'，保持不动
      console.log(`[Bot][${config.teamName}] 已有重连任务排队中，跳过 close 事件的重连`)
      return
    }

    // 没有重连任务 → 状态置为 disconnected，然后统一走退避调度
    if (instance) instance.status = 'disconnected'
    scheduleReconnect(config, `WebSocket 关闭（code=${code}）`)
  })

  ws.on('error', (err: Error) => {
    console.error(`[Bot][${config.teamName}] WebSocket 错误:`, err.message)
    if (instance) instance.status = 'error'
  })
}

function handleWebSocketMessage(config: BotConfig, payload: WebSocketPayload, ws: WebSocket): void {
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
      startHeartbeat(config, d.heartbeat_interval, ws)
      sendIdentify(config, ws)
      break

    case 11: // Heartbeat ACK
      // 静默处理心跳确认
      break

    case 0: // Dispatch
      handleDispatchEvent(config, t, d)
      break

    case 7: // Reconnect — 服务端要求重连，走退避流程而非立即重连
      console.log(`[Bot][${config.teamName}] 服务端要求重连`)
      scheduleReconnect(config, '服务端要求重连（op=7）')
      break

    case 9: // Invalid Session — 切换 intents 后重试，2 轮失败后停止
      // 自修复：尝试下一个 intents 配置（权限不匹配是 op=9 的常见原因）
      state.intentIndex = (state.intentIndex + 1) % FALLBACK_INTENTS.length
      const nextIntent = FALLBACK_INTENTS[state.intentIndex]

      // 熔断机制：当 intentIndex 回到 0 时表示完成 1 轮所有配置
      if (state.intentIndex === 0) {
        state.fullRoundsTried += 1
        console.log(`[Bot][${config.teamName}] ⚠️ 已完成第 ${state.fullRoundsTried} 轮 intents 尝试`)
        if (state.fullRoundsTried >= 2) {
          console.log(`[Bot][${config.teamName}] 🔴 熔断：所有 ${FALLBACK_INTENTS.length} 个 intents 已尝试 2 轮，全部失败。`)
          console.log(`[Bot][${config.teamName}]    这通常意味着：1) Bot 在 QQ 开放平台未配置权限  2) Bot 处于沙盒环境  3) Bot 凭据无效`)
          console.log(`[Bot][${config.teamName}]    停止自动重连。可通过前端页面重新启动。`)
          const inst2 = botInstances.get(config.teamId)
          if (inst2) inst2.status = 'disconnected'
          state.sessionId = null
          // 设置熔断标志：阻止所有后续重连
          state.circuitBreaker = true
          break
        }
      }

      console.log(`[Bot][${config.teamName}] ❌ Session 无效，切换 intents 后重试 → 下一个: ${nextIntent.name} (value=${nextIntent.value})`)
      if (d) {
        console.log(`[Bot][${config.teamName}] → 服务端 op=9 详情:`, JSON.stringify(d))
      }
      state.sessionId = null
      scheduleReconnect(config, `Session 无效（op=9），切换 intents 重试 [第${state.fullRoundsTried + 1}轮]`)
      break

    default:
      console.log(`[Bot][${config.teamName}] 收到 OpCode: ${op}`)
  }
}

function startHeartbeat(config: BotConfig, intervalMs: number, ws: WebSocket): void {
  const state = getState(config.teamId)

  if (state.heartbeatInterval) {
    clearInterval(state.heartbeatInterval)
  }

  state.heartbeatInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ op: 1, d: state.lastSequence }))
    }
  }, intervalMs)
}

async function sendIdentify(config: BotConfig, ws: WebSocket): Promise<void> {
  const state = getState(config.teamId)
  try {
    const token = await getAccessToken(config)
    // 从降级列表中选取当前 intents（由 intentIndex 决定）— 避免权限不匹配导致连接失败
    const currentIntent = FALLBACK_INTENTS[state.intentIndex % FALLBACK_INTENTS.length]
    const intentsValue = currentIntent.value

    const identifyPayload = {
      op: 2,
      d: {
        token: `QQBot ${token}`,
        intents: intentsValue,
        shard: [0, 1],
        // QQ Bot Gateway 协议要求使用 $ 前缀（与 Discord 一致）
        properties: {
          $os: 'windows',
          $browser: 'nodejs',
          $device: 'nodejs',
        },
      },
    }

    const payloadStr = JSON.stringify(identifyPayload)
    const tokenDebug = `${token.substring(0, 10)}...${token.substring(token.length - 10)}`
    console.log(`[Bot][${config.teamName}] 已发送 Identify: token=QQBot ${tokenDebug}, intents=${intentsValue} (${currentIntent.name}, 尝试 #${state.intentIndex + 1})`)
    ws.send(payloadStr)
  } catch (err) {
    console.error(`[Bot][${config.teamName}] ❌ sendIdentify 失败:`, (err as Error).message)
  }
}

// ---------- 事件分发 ----------

function handleDispatchEvent(config: BotConfig, eventType: string | undefined, data: any): void {
  if (!eventType) return

  switch (eventType) {
    case 'READY':
      const readyState = getState(config.teamId)
      readyState.sessionId = data.session_id
      // 连接成功：重置重连计数、intents 降级轮次、熔断标志
      readyState.retryCount = 0
      readyState.fullRoundsTried = 0
      readyState.circuitBreaker = false
      const intentInfo = FALLBACK_INTENTS[readyState.intentIndex % FALLBACK_INTENTS.length]
      console.log(`[Bot][${config.teamName}] 🎉 READY（intents=${intentInfo.value} - ${intentInfo.name}）Session: ${data.session_id}`)
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

async function handleChannelMessage(config: BotConfig, data: any): Promise<void> {
  const msg = data
  if (!msg || !msg.channel_id) return

  // 消息去重：防止 QQ 平台重复推送
  if (checkAndMarkMessage(msg.id)) {
    console.log(`[Bot][${config.teamName}] 跳过重复消息: ${msg.id}`)
    return
  }

  // 去掉 @机器人 标记
  let content = (msg.content || '').replace(/<@!\d+>/g, '').trim()
  if (!content) return

  console.log(`[Bot][${config.teamName}] 频道消息: ${msg.author?.username || '?'}: ${content}`)

  const result = await handleMessage({
    channelId: msg.channel_id,
    userId: msg.author?.id,
    content,
    username: msg.author?.username || msg.member?.nick || '未知用户',
    prisma,
    botConfig: config,
    guildId: msg.guild_id,
    teamId: config.teamId,
  })

  if (result.handled && result.reply) {
    const instance = botInstances.get(config.teamId)
    instance?.sendMessage(msg.channel_id, result.reply, msg.id).catch((err) => {
      console.error(`[Bot][${config.teamName}] 回复失败:`, err)
    })
  }
}

async function handlePrivateMessage(config: BotConfig, data: any): Promise<void> {
  const msg = data?.d || data
  if (!msg) return

  // 消息去重
  if (checkAndMarkMessage(msg.id)) {
    console.log(`[Bot][${config.teamName}] 跳过重复私聊消息: ${msg.id}`)
    return
  }

  console.log(`[Bot][${config.teamName}] 私聊消息: ${msg.author?.id}: ${msg.content}`)

  const result = await handleMessage({
    channelId: msg.author?.id,
    userId: msg.author?.id,
    content: msg.content || '',
    username: msg.author?.username || '未知用户',
    prisma,
    botConfig: config,
    guildId: msg.guild_id,
    teamId: config.teamId,
  })

  if (result.handled && result.reply) {
    const instance = botInstances.get(config.teamId)
    instance?.sendPrivateMessage(msg.author?.id, result.reply).catch((err) => {
      console.error(`[Bot][${config.teamName}] 私聊回复失败:`, err)
    })
  }
}

async function handleGroupMessage(config: BotConfig, data: any): Promise<void> {
  const msg = data?.d || data
  if (!msg) return

  // 消息去重
  if (checkAndMarkMessage(msg.id)) {
    console.log(`[Bot][${config.teamName}] 跳过重复群消息: ${msg.id}`)
    return
  }

  console.log(`[Bot][${config.teamName}] 群消息: ${msg.group_openid}: ${msg.content}`)

  const result = await handleMessage({
    channelId: msg.group_openid,
    userId: msg.author?.member_openid,
    content: msg.content || '',
    username: msg.author?.username || '未知用户',
    prisma,
    botConfig: config,
    guildId: msg.guild_id,
    teamId: config.teamId,
  })

  if (result.handled && result.reply) {
    const instance = botInstances.get(config.teamId)
    instance?.sendGroupMessage(msg.group_openid, result.reply).catch((err) => {
      console.error(`[Bot][${config.teamName}] 群回复失败:`, err)
    })
  }
}

// ---------- 重连 ----------

/**
 * 统一的重连调度入口：取消旧定时器，按退避策略排队重连
 * 所有路径（close 事件、op=7、op=9）都走此函数，保证同一时刻只有一条重连链路
 */
function scheduleReconnect(config: BotConfig, reason: string): void {
  const state = getState(config.teamId)
  const instance = botInstances.get(config.teamId)

  // 🔴 熔断检查：如果 circuitBreaker 已触发，阻止任何自动重连
  if (state.circuitBreaker) {
    console.log(`[Bot][${config.teamName}] 🔴 熔断已激活，忽略重连请求（${reason}）`)
    return
  }

  // ⚠️ 关键：立即设为 reconnecting，防止 getBotRuntimeStatus 在退避期间重复创建实例
  if (instance) instance.status = 'reconnecting'

  // 取消已有重连定时器，避免多路排队
  if (state.backoffTimer) {
    clearTimeout(state.backoffTimer)
    state.backoffTimer = null
  }

  const backoffMs = getBackoffMs(state.retryCount)
  state.retryCount += 1
  console.log(`[Bot][${config.teamName}] ${Math.round(backoffMs / 1000)} 秒后重连（${reason}，第 ${state.retryCount} 次）`)
  state.backoffTimer = setTimeout(() => {
    reconnectWebSocket(config)
  }, backoffMs)
}

// 最小重连间隔（毫秒）：防止极端情况下退避计算值过小导致瞬间重连
const MIN_RECONNECT_MS = 3000
let lastReconnectAttempt = 0

async function reconnectWebSocket(config: BotConfig): Promise<void> {
  const state = getState(config.teamId)

  // 取消任何待执行的重连定时器，防止重复重连
  if (state.backoffTimer) {
    clearTimeout(state.backoffTimer)
    state.backoffTimer = null
  }

  // 最小间隔保护：如果距离上次重连尝试不足 3 秒，强制等待
  const elapsed = Date.now() - lastReconnectAttempt
  if (elapsed < MIN_RECONNECT_MS) {
    const waitMs = MIN_RECONNECT_MS - elapsed
    console.log(`[Bot][${config.teamName}] 距上次重连仅 ${Math.round(elapsed / 1000)} 秒，强制等待 ${Math.round(waitMs / 1000)} 秒`)
    await new Promise(resolve => setTimeout(resolve, waitMs))
  }
  lastReconnectAttempt = Date.now()

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
 * 根据 BotConfig 启动一个 Bot 实例（幂等：已存在则复用）
 * - 完全不存在 → 新建并连接
 * - 已存在且状态不是「已连接」→ 复用实例，重新触发 WebSocket 连接
 * - 已存在且已连接 → 直接返回
 */
export function createBotInstance(config: BotConfig): BotInstance {
  // 手动调用 createBotInstance 说明是主动重启：清除关闭标志，允许新连接
  shutDownTeams.delete(config.teamId)

  // 1) 已存在实例？根据当前状态决定下一步
  const existing = botInstances.get(config.teamId)
  if (existing) {
    const state = getState(config.teamId)
    // a) 正在连接 / 已连接 / 正在重连 → 什么都不做，直接返回
    if (existing.status === 'connected' || existing.status === 'connecting' || existing.status === 'reconnecting') {
      console.log(`[Bot][${config.teamName}] 实例已存在（状态=${existing.status}），复用`)
      return existing
    }
    // b) 已断开 / 错误 → 复用实例，只重新发起连接（除非熔断已激活）
    if (state.circuitBreaker) {
      console.log(`[Bot][${config.teamName}] 🔴 熔断已激活，拒绝自动重连（需要前端手动重启）`)
      return existing
    }
    console.log(`[Bot][${config.teamName}] 实例已存在但状态=${existing.status}，重新触发连接...`)
    existing.status = 'connecting'
    // 重置重连计数，让退避从最短间隔开始
    state.retryCount = 0
    getGatewayUrl(config)
      .then((gatewayUrl) => connectWebSocket(config, gatewayUrl))
      .catch((err) => console.error(`[Bot][${config.teamName}] 重新连接失败:`, err))
    return existing
  }

  // 2) 全新实例
  // 立即设为 connecting，防止 getBotRuntimeStatus 在异步间隙重复创建实例
  const instance: BotInstance = {
    config,
    status: 'connecting',
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

  console.log(`[Bot][${config.teamName}] Bot 实例已创建 (appId=${config.appId}, intents=[${config.intents?.join(',') || 'DEFAULT'}])`)
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
    // 修复：先 removeAllListeners 再 close，防止 close 事件触发 scheduleReconnect
    // connectWebSocket 中也做了同样的处理（第348-353行），这里保持一致
    if (state.ws) {
      state.ws.removeAllListeners()
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
    intents: ['PUBLIC_GUILD_MESSAGES'],
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
  // 标记团队为已关闭：阻止任何自动重连（包括 close 事件、退避定时器回调等）
  shutDownTeams.add(teamId)

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
    if (state.backoffTimer) {
      clearTimeout(state.backoffTimer)
      state.backoffTimer = null
    }
    stateMap.delete(teamId)
  }
  botInstances.delete(teamId)
  console.log(`[Bot][${teamId}] 🔴 Bot 实例已完全停止，禁用自动重连（可通过前端页面重新启动）`)
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
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'not_configured'
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

  // ── 按需启动：已配置但未运行（disconnected/error）→ 自动启动 Bot ──
  // 注意：connecting/reconnecting/connected 状态下不重复创建，由内部重连逻辑处理
  // 关键限制：如果团队已被 stopBotInstance 关闭（解绑），则不自动启动
  if (
    hasConfig &&
    !shutDownTeams.has(teamId) &&
    (!instance || instance.status === 'disconnected' || instance.status === 'error')
  ) {
    console.log(`[Bot] 按需启动团队「${teamInfo.name}」的 Bot 实例...`)
    createBotInstance({
      appId: teamInfo.botAppId!,
      appSecret: teamInfo.botAppSecret!,
      teamId,
      teamName: teamInfo.name,
      channelId: teamInfo.botChannelId,
      intents: ['PUBLIC_GUILD_MESSAGES'],
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
          intents: ['PUBLIC_GUILD_MESSAGES'],
        })
      }, delayMs)
    }

    console.log(`[Bot] 已调度 ${teams.length} 个 Bot 错峰启动（间隔约 2 秒）`)
  } catch (err) {
    console.error('[Bot] 从数据库加载 Bot 配置失败:', err)
  }
}
