import { randomBytes } from 'node:crypto'

/**
 * 生成短 ID：8位小写字母+数字
 * ponytail: 使用 Array.from 简化循环，逻辑等价
 * 碰撞概率极低（36^8 ≈ 2.8万亿），实际使用中先查重再生成
 */
export function generateShortId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  // ponytail: 直接从 randomBytes 生成 id，简洁且安全
  return Array.from(randomBytes(8), (b) => chars[b % chars.length]).join('')
}
