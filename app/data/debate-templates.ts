// 辩论计时器模板列表
// 从 timing.vue 抽出，便于后续扩展（用户自建/分享模板）
//
// ⚠️ 数据结构严格遵循 app/data/debate-template.schema.json（JSON Schema），
//    以对齐后端「正式」环节结构：prisma/schema.prisma 的 DebateTimerStage 模型
//    + server/utils/syncStages.ts 的 buildStageData()/serializeStage()。
//    运行 `npm run validate:templates` 可校验本文件是否与 schema 对齐（字段名/类型漂移会报错）。
//
// 字段名必须与正式结构一致：
//   - 排序字段是 `orderIndex`（不是 `order`）
//   - 角色取值格式（来自 RolePicker，中文「·」两侧带空格）："正方 · 一辩" / "反方 · 二辩"
//   - 多选字段（positiveSpeakers / negativeSpeakers / speakers / allowedRoles）为字符串数组
//   - 模板是蓝图，不含 id / projectId（applyTemplate 套用时生成）

export interface DebateTemplateStage {
  name: string
  duration: number
  type: string
  orderIndex: number // 1-based，对应 DebateTimerStage.orderIndex（正式字段名）
  description?: string | null
  // —— 双计时（自由辩论 / 双边对辩）——
  positiveDuration?: number | null
  negativeDuration?: number | null
  // —— 单方发言 / 小结 / 总结陈词：发言方 ——
  speaker?: string | null
  // —— 单方发问：发问人 + 接受人 ——
  questioner?: string | null
  responder?: string | null // [已废弃] 单值，保留向后兼容
  responders?: string[] | null // 接受人（多选），如 ["正方 · 一辩","反方 · 二辩"]
  // 单方发问：提问/回答拆分时长（不填则整体用 duration）
  questionDuration?: number | null
  answerDuration?: number | null
  // —— 双边对辩 / 自由辩论：率先发言方 + 双方参与辩手（多选）——
  firstSpeaker?: string | null
  positiveSpeakers?: string[] | null
  negativeSpeakers?: string[] | null
  // 发问 / 对辩保护时间（秒，0/null 表示不启用）
  protectionTime?: number | null
  // 允许发言的角色 label 列表（用于发言权限联动），如 ["正方一辩","反方二辩"]
  allowedRoles?: string[] | null
  // 无计时器环节：可发言角色（多选，角色 label）
  speakers?: string[] | null
  // 环节启用开关（默认 true）
  enabled?: boolean
  // PPT/图片展示环节的图片路径（/uploads/images/...），纯播报不计时
  pptImage?: string | null
}

export interface DebateTemplate {
  id: string
  name: string
  description: string
  stages: DebateTemplateStage[]
}

// 便捷常量：四名辩手 roster，减少重复书写
const POS_ALL = ['正方 · 一辩', '正方 · 二辩', '正方 · 三辩', '正方 · 四辩']
const NEG_ALL = ['反方 · 一辩', '反方 · 二辩', '反方 · 三辩', '反方 · 四辩']

export const debateTemplates: DebateTemplate[] = [
  {
    id: 'worldcup2024',
    name: '华语辩论世界杯[2024]',
    description: '赛制：立论、质询、自由辩论、总结陈词',
    stages: [
      { name: '立论', duration: 210, type: 'single_speech', orderIndex: 1, speaker: '正方 · 一辩' },
      { name: '质询', duration: 120, type: 'single_question', orderIndex: 2, questioner: '反方 · 二辩', responders: ['正方 · 一辩'] },
      { name: '立论', duration: 210, type: 'single_speech', orderIndex: 3, speaker: '反方 · 一辩' },
      { name: '质询', duration: 120, type: 'single_question', orderIndex: 4, questioner: '正方 · 二辩', responders: ['反方 · 一辩'] },
      { name: '质询小结', duration: 90, type: 'single_speech', orderIndex: 5, speaker: '反方 · 二辩' },
      { name: '质询小结', duration: 90, type: 'single_speech', orderIndex: 6, speaker: '正方 · 二辩' },
      {
        name: '双方四辩对辩', duration: 180, type: 'bilateral_debate', orderIndex: 7,
        positiveDuration: 90, negativeDuration: 90,
        firstSpeaker: '正方 · 四辩', positiveSpeakers: ["正方 · 四辩"], negativeSpeakers: ["反方 · 四辩"],
        protectionTime: 0,
      },
      { name: '质询', duration: 90, type: 'single_question', orderIndex: 8, questioner: '正方 · 三辩', responders: ['反方 · 一辩','反方 · 二辩','反方 · 四辩'] },
      { name: '质询', duration: 90, type: 'single_question', orderIndex: 9, questioner: '反方 · 三辩', responders: ['正方 · 一辩','正方 · 二辩','正方 · 四辩'] },
      { name: '质询小结', duration: 90, type: 'single_speech', orderIndex: 10, speaker: '正方 · 三辩' },
      { name: '质询小结', duration: 90, type: 'single_speech', orderIndex: 11, speaker: '反方 · 三辩' },
      {
        name: '自由辩论', duration: 480, type: 'free_debate', orderIndex: 12,
        positiveDuration: 240, negativeDuration: 240,
        firstSpeaker: '正方 · 一辩', positiveSpeakers: [...POS_ALL], negativeSpeakers: [...NEG_ALL],
        protectionTime: 0,
      },
      { name: '总结陈词', duration: 210, type: 'summary', orderIndex: 13, speaker: '反方 · 四辩' },
      { name: '总结陈词', duration: 210, type: 'summary', orderIndex: 14, speaker: '正方 · 四辩' },
    ]
  },
]
