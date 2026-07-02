// ════════════════════════════════════════════════════
// 内部 API 认证工具
// 供计时程序、Bot 后台等内部模块调用，使用 INTERNAL_API_KEY 验证
// ════════════════════════════════════════════════════

// 内部 API 密钥：生产环境必须通过环境变量配置
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY

// 启动时校验：生产环境必须设置 INTERNAL_API_KEY，否则拒绝启动
if (!INTERNAL_API_KEY) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[Security] 生产环境必须设置 INTERNAL_API_KEY 环境变量')
    console.error('[Security] 请在 .env 文件或系统环境变量中配置：INTERNAL_API_KEY=<随机字符串>')
    process.exit(1)
  } else {
    // 开发环境使用默认值，但打印警告提醒
    console.warn('[Security] ⚠️  INTERNAL_API_KEY 未设置，使用开发环境默认值。生产环境部署时务必配置！')
  }
}

// 最终使用的密钥（开发环境回退到默认值）
const effectiveKey = INTERNAL_API_KEY || 'debate-timer-dev-internal-key'

/**
 * 验证内部 API 密钥
 * 从请求中提取 internalKey（GET 从 query，POST 从 body），与环境变量比对
 * 验证失败时抛出 403 错误
 */
export async function verifyInternalKey(event: any): Promise<void> {
  let internalKey: string | undefined

  if (event.method === 'GET') {
    const query = getQuery(event)
    internalKey = query.internalKey as string | undefined
  } else {
    const body = await readBody(event)
    internalKey = body?.internalKey
  }

  if (!internalKey || internalKey !== effectiveKey) {
    throw createError({ statusCode: 403, statusMessage: '内部 API 密钥无效' })
  }
}

/**
 * 获取当前有效的内部 API 密钥（供需要直接比对的场景）
 */
export function getInternalApiKey(): string {
  return effectiveKey
}