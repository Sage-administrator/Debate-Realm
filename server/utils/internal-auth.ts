// ════════════════════════════════════════════════════
// 内部 API 认证工具
// 供计时程序、Bot 后台等内部模块调用，使用 INTERNAL_API_KEY 验证
// ════════════════════════════════════════════════════

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

  const validKey = process.env.INTERNAL_API_KEY || 'debate-timer-internal-key'
  if (!internalKey || internalKey !== validKey) {
    throw createError({ statusCode: 403, statusMessage: '内部 API 密钥无效' })
  }
}