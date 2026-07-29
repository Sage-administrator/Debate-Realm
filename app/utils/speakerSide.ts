// 环节发言方推导 —— 发言权限联动的单一真相来源（前端侧）
// 把任意环节推导为一个"发言方案"，供 SpeechPermissionPanel 联动使用。
// 关键修正：发言权限按「发言方（具体角色，可多选）」处理，而非按阵营。
import { isSpeech, isQuestion, isBilateral, isNoTimer, isPpt } from './stageType'

// ═══════════ 反向/排除模式标记 ═══════════
// mode=0：正常模式，选中值即发言方（如 "正方·一辩"）
// mode=1：反向模式，选中值为被排除的辩手（如选中 "正方·一辩" → 实际发言方=正方除一辩外的其余辩手）
// DB 列：speakerMode / questionerMode / respondersMode（Int, 默认 0）

/** 根据选中值和 mode 标记，格式化为展示字符串 */
export function formatSpeakerDisplay(value: string | null | undefined, mode: number | null | undefined): string {
  if (!value) return ''
  if (mode === 1) return formatReverseDisplay(value)
  // 正常模式：直接展示
  return value.replace(/·/g, ' · ')
}

/** 反向展示：根据选中的辩手值，生成 "正方除一辩外任意辩手" 文本 */
export function formatReverseDisplay(raw: string): string {
  // 从选中值中提取阵营和被排除辩手
  const values = raw.split(/[、，/]/).map(s => s.trim()).filter(Boolean)
  if (!values.length) return raw
  // 取第一条确定阵营
  const first = values[0]!.replace(/[·\s]/g, '')
  const side = first.startsWith('正方') ? '正方' : first.startsWith('反方') ? '反方' : null
  if (!side) return raw
  // 提取被排除的辩手位（如一辩、二辩）
  const excludedLabels = values.map(v => {
    const cleaned = v.replace(/[·\s]/g, '')
    if (cleaned.startsWith('正方')) return cleaned.slice(2)
    if (cleaned.startsWith('反方')) return cleaned.slice(2)
    return cleaned
  }).join('')
  return `${side}除${excludedLabels}外任意辩手`
}

// 辩手 label → id（如 "一辩" → "de1"）
function debaterIdFromLabel(label: string): string | null {
  const map: Record<string, string> = { '一辩': 'de1', '二辩': 'de2', '三辩': 'de3', '四辩': 'de4' }
  return map[label] || null
}

// 辩手 id → label（如 "de1" → "一辩"）
export function debaterLabelFromId(id: string): string {
  const map: Record<string, string> = { de1: '一辩', de2: '二辩', de3: '三辩', de4: '四辩' }
  return map[id] || id
}

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

export function expandReverseSpeaker(_raw: string | null | undefined, _mode: number | null | undefined): null { return null }

// 解析"发言方"字段为角色 label 列表（供 getStageSpeakerPlan 使用）
// mode 不影响实际发言方（只影响前端展示），故始终按选中值解析
export function parseSpeakerRoles(raw: any, _mode?: number | null): string[] {
  const items: string[] = []
  if (Array.isArray(raw)) items.push(...raw.map(String))
  else if (typeof raw === 'string' && raw) {
    items.push(...raw.split(/[、，/]/).map(s => s.trim()).filter(Boolean))
  }
  if (!items.length) return []
  return items.map(normRoleName)
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
    const spRoles = parseSpeakerRoles(stage.speaker, stage.speakerMode)
    return spRoles.length ? { mode: 'roles', roles: spRoles } : { mode: 'default' }
  }

  if (isSpeech(t)) {
    const roles = parseSpeakerRoles(stage.speaker, stage.speakerMode)
    return roles.length ? { mode: 'roles', roles } : { mode: 'default' }
  }
  if (isQuestion(t)) {
    const qRoles = parseSpeakerRoles(stage.questioner, stage.questionerMode)
    // 接受人：优先用 responders（数组），fallback 到 responder（单值），传入 respondersMode
    const rRaw = Array.isArray(stage.responders) && stage.responders.length
      ? stage.responders.join('、')
      : stage.responder || ''
    const rRoles = parseSpeakerRoles(rRaw, stage.respondersMode)
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
