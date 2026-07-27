// 辩论计时器模板列表
// 从 timing.vue 抽出，便于后续扩展（用户自建/分享模板）
//
// ⚠️ 数据结构必须与计时器真实的 Stage 字段对齐（见 app/pages/tournaments/[id]/timing.vue 的 Stage 接口
// 与 app/components/StageForm.vue 的 StageFormData）。applyTemplate 会把它整体灌入 fullConfig.stages，
// 缺的字段在计时器标题/角色联动里就显示不出来（例如率先发言方、质询方等）。
//
// 角色字段取值格式（来自 RolePicker，中文「·」两侧带空格）：
//   "正方 · 一辩" / "反方 · 二辩" / "正方 · 全体" 等
// 多选字段（positiveSpeakers / negativeSpeakers / speakers）为上述字符串的数组。

export interface DebateTemplateStage {
  name: string
  duration: number
  type: string
  order: number // 1-based，applyTemplate 会映射到 Stage.orderIndex
  // —— 双计时（自由辩论 / 双边对辩）——
  positiveDuration?: number
  negativeDuration?: number
  // —— 单方发言 / 小结 / 总结陈词（计时环节）：发言方（单选）——
  // 注意：PPT 展示环节属于「无计时器」类，不用此字段，改用下方 speakers（多选，做发言权限联动）
  speaker?: string
  // —— 单方发问：发问人 + 接受人 ——
  questioner?: string
  responder?: string
  // 单方发问：提问/回答拆分时长（不填则整体用 duration）
  questionDuration?: number
  answerDuration?: number
  // —— 双边对辩 / 自由辩论：率先发言方 + 双方参与辩手（多选）——
  firstSpeaker?: string
  positiveSpeakers?: string[]
  negativeSpeakers?: string[]
  // 发问 / 对辩保护时间（秒，0 表示不启用）
  protectionTime?: number
  // —— 无计时器环节（含 PPT 展示环节）：可发言角色（多选），用于 QQ 频道发言权限联动 ——
  speakers?: string[]
  // 备注
  description?: string
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
    id: 'international',
    name: '国际华语辩论邀请赛',
    description: '标准赛制：立论、质询、小结、自由辩论、总结陈词',
    stages: [
      { name: '正方一辩立论', duration: 180, type: 'single_speech', order: 1, speaker: '正方 · 一辩' },
      { name: '反方四辩质询正方一辩', duration: 120, type: 'single_question', order: 2, questioner: '反方 · 四辩', responder: '正方 · 一辩' },
      { name: '反方一辩立论', duration: 180, type: 'single_speech', order: 3, speaker: '反方 · 一辩' },
      { name: '正方四辩质询反方一辩', duration: 120, type: 'single_question', order: 4, questioner: '正方 · 四辩', responder: '反方 · 一辩' },
      { name: '正方二辩申论', duration: 180, type: 'single_speech', order: 5, speaker: '正方 · 二辩' },
      { name: '反方三辩质询正方二辩', duration: 120, type: 'single_question', order: 6, questioner: '反方 · 三辩', responder: '正方 · 二辩' },
      { name: '反方二辩申论', duration: 180, type: 'single_speech', order: 7, speaker: '反方 · 二辩' },
      { name: '正方三辩质询反方二辩', duration: 120, type: 'single_question', order: 8, questioner: '正方 · 三辩', responder: '反方 · 二辩' },
      { name: '正方三辩小结', duration: 120, type: 'summary', order: 9, speaker: '正方 · 三辩' },
      { name: '反方三辩小结', duration: 120, type: 'summary', order: 10, speaker: '反方 · 三辩' },
      {
        name: '自由辩论', duration: 240, type: 'free_debate', order: 11,
        positiveDuration: 120, negativeDuration: 120,
        firstSpeaker: '正方 · 一辩', positiveSpeakers: [...POS_ALL], negativeSpeakers: [...NEG_ALL],
        protectionTime: 0,
      },
      { name: '反方四辩总结陈词', duration: 240, type: 'summary', order: 12, speaker: '反方 · 四辩' },
      { name: '正方四辩总结陈词', duration: 240, type: 'summary', order: 13, speaker: '正方 · 四辩' },
    ]
  },
  {
    id: 'worldcup2024',
    name: '华语辩论世界杯[2024]',
    description: '简化赛制：立论、质询、自由辩论、总结陈词',
    stages: [
      { name: '立论', duration: 210, type: 'single_speech', order: 1, speaker: '正方 · 一辩' },
      { name: '质询', duration: 150, type: 'single_question', order: 2, questioner: '反方 · 二辩', responder: '正方 · 一辩' },
      { name: '立论', duration: 210, type: 'single_speech', order: 3, speaker: '反方 · 一辩' },
      { name: '质询', duration: 150, type: 'single_question', order: 2, questioner: '正方 · 二辩', responder: '反方 · 一辩' },
      { name: '质询小结', duration: 180, type: 'single_speech', order: 5, speaker: '反方 · 二辩' },
      { name: '质询小结', duration: 180, type: 'single_speech', order: 5, speaker: '正方 · 二辩' },
      {
        name: '双方四辩对辩', duration: 240, type: 'free_debate', order: 7,
        positiveDuration: 120, negativeDuration: 120,
        firstSpeaker: '正方 · 四辩', positiveSpeakers: [...POS_ALL], negativeSpeakers: [...NEG_ALL],
        protectionTime: 0,
      },
      { name: '反方三辩总结陈词', duration: 210, type: 'summary', order: 8, speaker: '反方 · 三辩' },
      { name: '正方三辩总结陈词', duration: 210, type: 'summary', order: 9, speaker: '正方 · 三辩' },
    ]
  },
  {
    id: 'simple',
    name: '简单标准赛制',
    description: '四环节：立论、攻辩、自由辩论、总结陈词',
    stages: [
      { name: '开篇立论', duration: 180, type: 'single_speech', order: 1, speaker: '正方 · 一辩' },
      { name: '攻辩', duration: 120, type: 'single_speech', order: 2, speaker: '反方 · 二辩' },
      {
        name: '自由辩论', duration: 240, type: 'free_debate', order: 3,
        positiveDuration: 120, negativeDuration: 120,
        firstSpeaker: '正方 · 一辩', positiveSpeakers: [...POS_ALL], negativeSpeakers: [...NEG_ALL],
        protectionTime: 0,
      },
      { name: '总结陈词', duration: 180, type: 'summary', order: 4, speaker: '反方 · 四辩' },
    ]
  },
  {
    id: 'englishbp',
    name: '英国议会制辩论赛',
    description: 'BP赛制：四位首相/反对党发言（映射为正方/反方 一~四辩）',
    stages: [
      { name: '首相', duration: 420, type: 'single_speech', order: 1, speaker: '正方 · 一辩' },
      { name: '反对党领袖', duration: 420, type: 'single_speech', order: 2, speaker: '反方 · 一辩' },
      { name: '副首相', duration: 420, type: 'single_speech', order: 3, speaker: '正方 · 二辩' },
      { name: '反对党副领袖', duration: 420, type: 'single_speech', order: 4, speaker: '反方 · 二辩' },
      { name: '政府成员', duration: 420, type: 'single_speech', order: 5, speaker: '正方 · 三辩' },
      { name: '反对党成员', duration: 420, type: 'single_speech', order: 6, speaker: '反方 · 三辩' },
      { name: '政府党鞭', duration: 420, type: 'single_speech', order: 7, speaker: '正方 · 四辩' },
      { name: '反对党党鞭', duration: 420, type: 'single_speech', order: 8, speaker: '反方 · 四辩' },
    ]
  },
]
