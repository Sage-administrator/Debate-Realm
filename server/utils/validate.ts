/**
 * server/utils/validate.ts — 请求体验证工具
 *
 * 使用共享 Zod Schema 对 API 请求体做运行时校验，
 * 确保前后端使用同一份类型定义。
 *
 * 用法：
 *   const body = await validateBody(event, SubmitResultRequest)
 *   // body 现在是类型安全的 SubmitResultRequest
 */
import { readBody } from 'h3'
import type { ZodType } from 'zod'

export async function validateBody<T>(event: any, schema: ZodType<T>): Promise<T> {
  const raw = await readBody(event)
  const result = schema.safeParse(raw)
  if (!result.success) {
    const details = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw createError({
      statusCode: 400,
      message: `请求参数校验失败: ${details}`,
    })
  }
  return result.data
}

export function validateQuery<T>(event: any, schema: ZodType<T>): T {
  const raw = getQuery(event)
  const result = schema.safeParse(raw)
  if (!result.success) {
    const details = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw createError({
      statusCode: 400,
      message: `查询参数校验失败: ${details}`,
    })
  }
  return result.data
}
