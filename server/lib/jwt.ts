import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

// JWT 密钥：生产环境必须通过环境变量配置，禁止使用默认值
// 开发环境允许使用默认值便于本地调试，但启动时会打印警告
const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = '7d'

// 启动时校验：生产环境必须设置 JWT_SECRET，否则拒绝启动
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[Security] 生产环境必须设置 JWT_SECRET 环境变量')
    console.error('[Security] 请在 .env 文件或系统环境变量中配置：JWT_SECRET=<至少32字符的随机字符串>')
    process.exit(1)
  } else {
    // 开发环境使用默认值，但打印警告提醒
    console.warn('[Security] ⚠️  JWT_SECRET 未设置，使用开发环境默认值。生产环境部署时务必配置！')
  }
}

// 最终使用的密钥（开发环境回退到默认值）
const effectiveSecret = JWT_SECRET || 'debate-timer-dev-secret-change-in-production'

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
