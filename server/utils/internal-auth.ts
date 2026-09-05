// ════════════════════════════════════════════════════
// 内部 API 认证工具
// 供计时程序、Bot 后台等内部模块调用，使用 INTERNAL_API_KEY 验证
// ════════════════════════════════════════════════════

import { requireEnvVar } from './common'

// ponytail: 使用 requireEnvVar 统一处理环境变量校验
const effectiveKey = requireEnvVar(
  'INTERNAL_API_KEY',
  'debate-timer-dev-internal-key',
  '请在 .env 文件或系统环境变量中配置：INTERNAL_API_KEY=<随机字符串>',
)

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
    throw createError({ statusCode: 403, message: '内部 API 密钥无效' })
  }
}

/**
 * 获取当前有效的内部 API 密钥（供需要直接比对的场景）
 */
export function getInternalApiKey(): string {
  return effectiveKey
}
