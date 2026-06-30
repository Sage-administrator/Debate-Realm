// ════════════════════════════════════════════════════
// QQ Bot HTTP API 辅助模块
// 处理 Bot Access Token 获取和消息发送，不依赖 WebSocket
// ════════════════════════════════════════════════════

interface BotCredentials {
  appId: string
  appSecret: string
}

interface AccessTokenResponse {
  access_token: string
  expires_in: number
}

// Token 缓存（按凭证隔离，避免多团队互相覆盖）
// key: appId + ':' + appSecret 前 8 位（用于区分不同 Bot 凭证）
const tokenCache = new Map<string, { token: string; expiresAt: number }>()

const TOKEN_URL = 'https://bots.qq.com/app/getAppAccessToken'
const API_BASE_URL = 'https://api.sgroup.qq.com'

/**
 * 获取 QQ Bot Access Token（按凭证隔离缓存）
 */
async function getAccessToken(credentials: BotCredentials): Promise<string> {
  // 生成缓存 key：appId + secret 前 8 位
  const cacheKey = `${credentials.appId}:${credentials.appSecret.slice(0, 8)}`
  const cached = tokenCache.get(cacheKey)

  // 检查缓存是否有效（提前 60 秒刷新）
  if (cached && Date.now() < cached.expiresAt - 60000) {
    return cached.token
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appId: credentials.appId,
      clientSecret: credentials.appSecret,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`获取 Access Token 失败: ${response.status} - ${text}`)
  }

  const json = (await response.json()) as AccessTokenResponse
  tokenCache.set(cacheKey, {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  })
  return json.access_token
}

/**
 * 调用 QQ Bot HTTP API
 */
async function callBotApi(
  credentials: BotCredentials,
  path: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  const token = await getAccessToken(credentials)
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

/**
 * 发送频道消息
 */
export async function sendChannelMessage(
  credentials: BotCredentials,
  channelId: string,
  content: string,
  msgId?: string,
): Promise<unknown> {
  const body: Record<string, unknown> = { content }
  if (msgId) {
    body.msg_id = msgId
    body.message_reference = { message_id: msgId }
  }
  return callBotApi(credentials, `/channels/${channelId}/messages`, 'POST', body)
}

/**
 * 发送群消息
 */
export async function sendGroupMessage(
  credentials: BotCredentials,
  groupId: string,
  content: string,
): Promise<unknown> {
  return callBotApi(credentials, `/v2/groups/${groupId}/messages`, 'POST', {
    content,
    msg_type: 0,
  })
}

/**
 * 发送私聊消息
 */
export async function sendPrivateMessage(
  credentials: BotCredentials,
  userId: string,
  content: string,
): Promise<unknown> {
  return callBotApi(credentials, `/v2/users/${userId}/messages`, 'POST', {
    content,
    msg_type: 0,
  })
}

/**
 * 测试 Bot 凭证是否有效（获取 Token 验证）
 */
export async function testBotCredentials(credentials: BotCredentials): Promise<{
  valid: boolean
  message: string
}> {
  try {
    // 清除该凭证的缓存以强制重新验证
    const cacheKey = `${credentials.appId}:${credentials.appSecret.slice(0, 8)}`
    tokenCache.delete(cacheKey)
    await getAccessToken(credentials)
    return { valid: true, message: 'Bot 凭证有效，Access Token 获取成功' }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '未知错误'
    return { valid: false, message: msg }
  }
}
