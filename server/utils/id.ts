/**
 * 生成短 ID：7位小写字母+数字
 * 碰撞概率极低（36^7 ≈ 780亿），实际使用中先查重再生成
 */
export function generateShortId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  for (let i = 0; i < 7; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return id
}
