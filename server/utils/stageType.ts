// server 端环节类型 normalize 模块
// 与 app/utils/stageType.ts 保持同步（server 不能直接 import app/utils）
// 修改时请两处同步更新

// 老值 → 新值映射（summary 保留独立类型）
const TYPE_MAP: Record<string, string> = {
  'speech': 'single_speech',
  'question': 'single_question',
  'dual-timer': 'bilateral_debate',
  'special': 'no_timer',
}

// 标准化环节类型：把老枚举值映射到新枚举值
export function normalizeStageType(old: string | null | undefined): string {
  if (!old) return 'single_speech'
  return TYPE_MAP[old] || old
}
