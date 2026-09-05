import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { requireEnvVar } from '../utils/common'

// ponytail: 使用 requireEnvVar 统一处理环境变量校验
const effectiveSecret = requireEnvVar(
  'JWT_SECRET',
  'debate-timer-dev-secret-change-in-production',
  '请在 .env 文件或系统环境变量中配置：JWT_SECRET=<至少32字符的随机字符串>',
)
const JWT_EXPIRES_IN = '7d'

export interface JWTPayload {
  userId: string
  username: string
  role: string
  mode: string
  teamId?: string | null
  tokenVersion: number
  sessionId: string
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, effectiveSecret, { expiresIn: JWT_EXPIRES_IN })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, effectiveSecret) as JWTPayload
  } catch {
    return null
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
