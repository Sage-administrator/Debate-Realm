/**
 * 生成短 ID：8位小写字母+数字
 * 碰撞概率极低（36^8 ≈ 2.8万亿），实际使用中先查重再生成
 * 字母不分大小写（统一小写存储），不允许符号
 */
export function generateShortId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return id
}
