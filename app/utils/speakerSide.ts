// 环节发言方推导 —— 发言权限联动的单一真相来源（前端侧）
// 把任意环节推导为一个"发言方案"，供 SpeechPermissionPanel 联动使用。
// 关键修正：发言权限按「发言方（具体角色，可多选）」处理，而非按阵营。
import { isSpeech, isQuestion, isBilateral, isNoTimer, isPpt } from './stageType'

// 标准 10 个角色（与赛场身份组 label 一致），用于 StageForm 的"发言方"多选。
export interface SpeakerRoleOption {
  label: string
  value: string
  side: 'affirmative' | 'negative' | 'judge' | 'audience'
}
export const SPEAKER_ROLE_OPTIONS: SpeakerRoleOption[] = [
  { label: '正方一辩', value: '正方一辩', side: 'affirmative' },
  { label: '正方二辩', value: '正方二辩', side: 'affirmative' },
  { label: '正方三辩', value: '正方三辩', side: 'affirmative' },
  { label: '正方四辩', value: '正方四辩', side: 'affirmative' },
  { label: '反方一辩', value: '反方一辩', side: 'negative' },
  { label: '反方二辩', value: '反方二辩', side: 'negative' },
  { label: '反方三辩', value: '反方三辩', side: 'negative' },
  { label: '反方四辩', value: '反方四辩', side: 'negative' },
  { label: '评委', value: '评委', side: 'judge' },
  { label: '观众', value: '观众', side: 'audience' },
]

// 归一化角色名：去掉"·"与空白，使 "正方 · 一辩" 与 "正方一辩" 等价。
export function normRoleName(name?: string | null): string {
  return (name || '').replace(/[·\s]/g, '')
}

// 反向/排除发言方值展开：
//   归一化后的 "正方除一辩外任意辩手" / "正方除一辩二辩外任意辩手" → 该方其余辩手角色 label 列表
//   （如 ["正方二辩","正方三辩","正方四辩"]）；支持多选排除。兼容旧数据无"任意辩手"后缀。
//   非反向值（或不匹配）返回 null，调用方按原值处理。
export function expandReverseSpeaker(normed: string | null | undefined): string[] | null {
  const v = (normed || '').replace(/[·\/\s\-]/g, '')
  const m = v.match(/^(正方|反方)除(.+?)外(?:任意辩手)?$/)
  if (!m || !m[2]) return null  // 兜底：确保 m[2] 存在
  const sideLabel = m[1]
  const side = sideLabel === '正方' ? 'affirmative' : 'negative'
  const all = SPEAKER_ROLE_OPTIONS.filter(o => o.side === side).map(o => o.value)
  // m[2] 形如 "一辩二辩" 或 "一辩"：按 "辩" 拆分得到各被排除辩手标签
  const excludedSet = new Set<string>()
  for (const part of m[2].split('辩')) {
    if (!part) continue
    excludedSet.add(sideLabel + part + '辩')
  }
  if (excludedSet.size === 0) return null
  const rest = all.filter(r => !excludedSet.has(r))
  return rest // 可能为空数组（排除全部 → 该方无人可发言）
}

// 解析"发言方"字段为角色 label 列表（供 getStageSpeakerPlan 使用）：
//  - 字符串：正常多选以 、，/ 连接（如 "正方·一辩、正方·二辩"）；反向/排除值（"正方·除一辩外"）经 expandReverseSpeaker 展开
//  - 数组：逐个处理（兼容历史数据）
//  - 空值：返回 []
export function parseSpeakerRoles(raw: any): string[] {
  const items: string[] = []
  if (Array.isArray(raw)) items.push(...raw)
  else if (typeof raw === 'string') {
    if (!raw) return []
    items.push(...raw.split(/[、，/]/).map(s => s.trim()).filter(Boolean))
  } else {
    return []
  }
  const roles: string[] = []
  for (const v of items) {
    const n = normRoleName(v)
    const expanded = expandReverseSpeaker(n)
    if (expanded) roles.push(...expanded)
    else if (n) roles.push(n)
  }
  return roles
}

export type SpeakerPlan =
  | { mode: 'roles'; roles: string[] } // 明确指定可发言角色（label 列表）
  | { mode: 'both' } // 双方辩手均可发言（正方 + 反方）
  | { mode: 'default' } // 默认：正方 + 反方 + 评委可发言，观众不可

/**
 * 根据环节推导"发言方案"（targetRoles 的来源）：
 *  - 双边对辩 / 自由辩论          → 以环节选定的参与辩手为准（正方+反方各自选定的辩手）；未指定则双方辩手均可发言(both)
 *  - 无计时器环节                 → 取其 speakers（多选角色）；为空则按默认
 *  - PPT / 纯计时器等无明确发言方 → default
 *  - 单方发言                     → 发言方（stage.speaker 归一化后的 label）
 *  - 单方发问                     → 发问人 + 接受人（二者都需发言，归一化后的 label）
 */
export function getStageSpeakerPlan(stage: any): SpeakerPlan {
  if (!stage) return { mode: 'default' }

  const t = stage.type

  if (isBilateral(t)) {
    // 双边对辩/自由辩论：以环节选定的参与辩手为准；未指定则默认双方辩手均可发言
    const pos = Array.isArray(stage.positiveSpeakers) ? stage.positiveSpeakers : []
    const neg = Array.isArray(stage.negativeSpeakers) ? stage.negativeSpeakers : []
    const speakers = [...pos, ...neg].map(normRoleName).filter(Boolean)
    if (speakers.length) return { mode: 'roles', roles: speakers }
    return { mode: 'both' }
  }

  if (isNoTimer(t)) {
    const speakers: string[] = Array.isArray(stage.speakers)
      ? stage.speakers
      : (typeof stage.speakers === 'string' && stage.speakers ? JSON.parse(stage.speakers) : [])
    if (speakers.length) return { mode: 'roles', roles: speakers }
    return { mode: 'default' }
  }

  if (isPpt(t)) {
    // PPT/图片展示环节：以多选 speakers 联动发言权限（与无计时器环节一致）；兼容旧数据曾用单 speaker 字段
    const speakers: string[] = Array.isArray(stage.speakers)
      ? stage.speakers
      : (typeof stage.speakers === 'string' && stage.speakers ? JSON.parse(stage.speakers) : [])
    if (speakers.length) return { mode: 'roles', roles: speakers.map(normRoleName) }
    const spRoles = parseSpeakerRoles(stage.speaker)
    return spRoles.length ? { mode: 'roles', roles: spRoles } : { mode: 'default' }
  }

  if (isSpeech(t)) {
    const roles = parseSpeakerRoles(stage.speaker)
    return roles.length ? { mode: 'roles', roles } : { mode: 'default' }
  }
  if (isQuestion(t)) {
    // 发问人 + 接受人 都需要发言，二者都纳入可发言角色
    // 字段支持正常多选（"、" 连接，如 "正方·一辩、正方·二辩"）与反向/排除值（"正方·除一辩外"）
    const qRoles = parseSpeakerRoles(stage.questioner)
    const rRoles = parseSpeakerRoles(stage.responder)
    const roles = [...qRoles, ...rRoles]
    return roles.length ? { mode: 'roles', roles } : { mode: 'default' }
  }

  // 纯计时等环节：默认权限
  return { mode: 'default' }
}

// 发言方案 → 中文文案（用于面板提示）
export function speakerPlanText(plan: SpeakerPlan): string {
  switch (plan.mode) {
    case 'roles':
      return plan.roles.join('、') || '（未指定发言方）'
    case 'both':
      return '双方辩手'
    case 'default':
      return '（默认权限）'
  }
}
