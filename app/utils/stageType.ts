// 环节类型统一判断模块
// 解决历史问题：stage.type 字段在 schema(5种)/前端(13种)/Cascader(8种)/typeLabel 多处定义不一致
// 本模块为唯一真相来源，所有 type 判断必须 import 自此处

// 老值 → 新值映射（summary 保留独立类型）
const TYPE_MAP: Record<string, string> = {
  'speech': 'single_speech',
  'question': 'single_question',
  'dual-timer': 'bilateral_debate',
  'special': 'no_timer',
  // summary / 新值原样返回
}

// 标准化环节类型：把老枚举值映射到新枚举值
// 调用位置：loadConfig、API 入库前、读取 phases JSON 后
export function normalizeStageType(old: string | null | undefined): string {
  if (!old) return 'single_speech'
  return TYPE_MAP[old] || old
}

// 单方发言类：single_speech / speech / summary
// summary（小结/总结陈词）也是单方发言，计时行为相同
export function isSpeech(t: string | null | undefined): boolean {
  const n = normalizeStageType(t)
  return n === 'single_speech' || n === 'summary'
}

// 单方发问类：single_question / question
export function isQuestion(t: string | null | undefined): boolean {
  return normalizeStageType(t) === 'single_question'
}

// 小结/总结陈词（语义独立，但计时行为同单方发言）
export function isSummary(t: string | null | undefined): boolean {
  return normalizeStageType(t) === 'summary'
}

// 双边对辩类：bilateral_debate / free_debate / dual-timer
export function isBilateral(t: string | null | undefined): boolean {
  const n = normalizeStageType(t)
  return n === 'bilateral_debate' || n === 'free_debate'
}

// 双计时器类：bilateral_debate / free_debate / double_timer / dual-timer
// 比 isBilateral 多包含 double_timer（纯基类双计时器，无对辩语义）
export function isDualTimer(t: string | null | undefined): boolean {
  const n = normalizeStageType(t)
  return n === 'bilateral_debate' || n === 'free_debate' || n === 'double_timer'
}

// 需要计时器的类型（所有发言/发问/对辩 + 单/双计时器基类）
export function isTimerType(t: string | null | undefined): boolean {
  if (isSpeech(t) || isQuestion(t) || isBilateral(t)) return true
  const n = normalizeStageType(t)
  return n === 'single_timer' || n === 'double_timer'
}

// 无计时器环节
export function isNoTimer(t: string | null | undefined): boolean {
  return normalizeStageType(t) === 'no_timer'
}

// PPT/图片展示环节
export function isPpt(t: string | null | undefined): boolean {
  return normalizeStageType(t) === 'ppt_replace'
}

// 是否有计时功能（排除无计时器和 PPT）
export function hasTimer(t: string | null | undefined): boolean {
  return !isNoTimer(t) && !isPpt(t)
}

// 环节类型中文标签（用于卡片头显示）
export function typeLabel(t: string | null | undefined): string {
  const n = normalizeStageType(t)
  const map: Record<string, string> = {
    'single_speech': '单方发言',
    'single_question': '单方发问',
    'summary': '小结/总结',
    'bilateral_debate': '双边对辩',
    'free_debate': '自由辩论',
    'single_timer': '单计时器',
    'double_timer': '双计时器',
    'no_timer': '无计时器',
    'ppt_replace': 'PPT图片',
  }
  return map[n] || n
}
