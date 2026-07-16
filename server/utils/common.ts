/**
 * 通用工具函数
 * 包含：字符串处理、数组去重、设备信息解析等常用工具
 */

import { getHeader, type H3Event, type EventHandlerRequest } from 'h3'

/**
 * 清理并去重字符串数组（去除空白项，去除前后空格，去重，保持原有顺序）
 * ponytail: 使用 filter + Set 一行实现，保持顺序
 */
export function dedupeTrimmedStrings(items: string[]): string[] {
  const seen = new Set<string>()
  return items
    .map(s => (s || '').trim())
    .filter(s => s && !seen.has(s) && seen.add(s))
}

/**
 * 从 User-Agent 解析设备信息（浏览器 + 操作系统）
 * @param userAgent User-Agent 字符串
 * @returns 格式化的设备信息字符串
 */
export function formatDeviceInfo(userAgent: string | null | undefined): string {
  if (!userAgent) return '未知设备'
  const ua = userAgent.toLowerCase()
  let browser = '未知浏览器'
  let os = '未知系统'

  if (ua.includes('edg')) browser = 'Edge'
  else if (ua.includes('chrome')) browser = 'Chrome'
  else if (ua.includes('firefox')) browser = 'Firefox'
  else if (ua.includes('safari')) browser = 'Safari'
  else if (ua.includes('opera') || ua.includes('opr')) browser = 'Opera'

  if (ua.includes('windows')) os = 'Windows'
  else if (ua.includes('mac')) os = 'macOS'
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS'
  else if (ua.includes('android')) os = 'Android'
  else if (ua.includes('linux')) os = 'Linux'

  return `${browser} on ${os}`
}

/**
 * 从 H3 请求事件中获取客户端 IP 地址
 * 优先读取 X-Forwarded-For，然后 X-Real-IP，最后默认 127.0.0.1
 */
export function getClientIp(event: H3Event<EventHandlerRequest>): string {
  const xForwardedFor = getHeader(event, 'x-forwarded-for')
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0]!.trim()
  }
  const xRealIp = getHeader(event, 'x-real-ip')
  if (xRealIp) {
    return xRealIp
  }
  return '127.0.0.1'
}

/**
 * 安全解析 JSON 字符串，解析失败时返回默认值
 * @param value 待解析的字符串
 * @param fallback 解析失败时的默认值
 */
export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

/**
 * 安全序列化 JSON，undefined 值会被转换为 null
 */
export function safeJsonStringify(value: any): string {
  return JSON.stringify(value ?? null)
}

/**
 * 环境变量校验工具
 * ponytail: 统一处理生产/开发环境的环境变量校验逻辑，消除 jwt.ts 和 internal-auth.ts 中的重复代码
 * @param name 环境变量名称
 * @param defaultValue 开发环境下的默认值
 * @param errorMessage 生产环境下的错误提示消息
 * @returns 环境变量值（生产环境必须设置，开发环境可使用默认值）
 */
export function requireEnvVar(name: string, defaultValue: string, errorMessage?: string): string {
  const value = process.env[name]
  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Security] 生产环境必须设置', name, '环境变量')
      console.error('[Security]', errorMessage || `请在 .env 文件或系统环境变量中配置：${name}=<值>`)
      process.exit(1)
    } else {
      console.warn('[Security] ⚠️', name, '未设置，使用开发环境默认值。生产环境部署时务必配置！')
      return defaultValue
    }
  }
  return value
}
