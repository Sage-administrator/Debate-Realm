// 环节同步模块：diff + update + create + delete，替代原来的 deleteMany + create 策略
// 用于 4 套 timer-config PUT API，保证 stage.id 稳定（不再每次保存全变）
//
// 前端 stage.id 策略：
// - 新建的用 'tmp_' + crypto.randomUUID() 前缀
// - DB 已有的用真实 uuid（GET 返回的）
// - syncStages 识别 'tmp_' 前缀走 create 分支，其余走 update 分支

import type { PrismaClient } from '../lib/generated/client'
import { normalizeStageType } from './stageType'

// 构造 stage 的 data 对象（含 normalizeStageType + 全部新字段）
// 用于 create 和 update
function buildStageData(stage: any, projectId: string, orderIndex: number) {
  return {
    projectId,
    name: stage.name || '未命名环节',
    duration: typeof stage.duration === 'number' ? stage.duration : 0,
    type: normalizeStageType(stage.type),
    description: stage.description || null,
    orderIndex,
    positiveDuration: stage.positiveDuration ?? null,
    negativeDuration: stage.negativeDuration ?? null,
    allowedRoles: stage.allowedRoles ? JSON.stringify(stage.allowedRoles) : null,
    // 角色字段
    speaker: stage.speaker || null,
    questioner: stage.questioner || null,
    responder: stage.responder || null,
    firstSpeaker: stage.firstSpeaker || null,
    protectionTime: stage.protectionTime ?? null,
    // 对辩双方参与辩手（JSON 数组）
    positiveSpeakers: stage.positiveSpeakers ? JSON.stringify(stage.positiveSpeakers) : null,
    negativeSpeakers: stage.negativeSpeakers ? JSON.stringify(stage.negativeSpeakers) : null,
    // 单方发问拆分时长
    questionDuration: stage.questionDuration ?? null,
    answerDuration: stage.answerDuration ?? null,
    // 启用开关
    enabled: stage.enabled !== false, // 默认 true
    // 无计时器环节的可发言角色（multi-select，JSON 数组字符串）
    speakers: stage.speakers && stage.speakers.length ? JSON.stringify(stage.speakers) : null,
    // PPT/图片展示环节：上传到 /uploads/images/ 的相对路径（纯播报不计时）
    pptImage: stage.pptImage || null,
  }
}

// 同步环节：diff + update + create + delete
// 必须在 prisma.$transaction 内调用，tx 是事务客户端
export async function syncStages(
  tx: any,
  projectId: string,
  incoming: any[]
): Promise<any[]> {
  // 1. 查询现有环节
  const existing = await tx.debateTimerStage.findMany({
    where: { projectId },
  })
  const existingIds = new Set(existing.map((s: any) => s.id))

  // 2. 区分 incoming 中的持久 id（DB 已有）和临时 id（新建）
  const incomingPersistentIds = new Set(
    incoming
      .filter((s: any) => s.id && !String(s.id).startsWith('tmp_'))
      .map((s: any) => s.id)
  )

  // 3. 删除被移除的环节（existing 中不在 incomingPersistentIds 里的）
  const toDeleteIds = existing
    .filter((s: any) => !incomingPersistentIds.has(s.id))
    .map((s: any) => s.id)
  if (toDeleteIds.length > 0) {
    await tx.debateTimerStage.deleteMany({
      where: { id: { in: toDeleteIds } },
    })
  }

  // 4. 按 incoming 顺序 update + create（保证 orderIndex 正确）
  const returnedStages: any[] = []
  for (let i = 0; i < incoming.length; i++) {
    const s = incoming[i]
    const data = buildStageData(s, projectId, i)
    const isPersistent =
      s.id &&
      !String(s.id).startsWith('tmp_') &&
      existingIds.has(s.id)

    if (isPersistent) {
      returnedStages.push(
        await tx.debateTimerStage.update({
          where: { id: s.id },
          data,
        })
      )
    } else {
      returnedStages.push(
        await tx.debateTimerStage.create({ data })
      )
    }
  }

  return returnedStages
}

// 将 DB 返回的 stage 对象序列化为 API 响应格式
// 解析 JSON 字段，供 GET/PUT 返回时使用
export function serializeStage(s: any) {
  return {
    id: s.id,
    name: s.name,
    duration: s.duration,
    type: s.type,
    description: s.description,
    orderIndex: s.orderIndex,
    positiveDuration: s.positiveDuration,
    negativeDuration: s.negativeDuration,
    allowedRoles: s.allowedRoles ? JSON.parse(s.allowedRoles) : null,
    // 角色字段
    speaker: s.speaker,
    questioner: s.questioner,
    responder: s.responder,
    firstSpeaker: s.firstSpeaker,
    protectionTime: s.protectionTime,
    // 对辩双方参与辩手
    positiveSpeakers: s.positiveSpeakers ? JSON.parse(s.positiveSpeakers) : null,
    negativeSpeakers: s.negativeSpeakers ? JSON.parse(s.negativeSpeakers) : null,
    // 单方发问拆分时长
    questionDuration: s.questionDuration,
    answerDuration: s.answerDuration,
    // 启用开关
    enabled: s.enabled,
    // 无计时器环节的可发言角色（JSON 数组字符串 → 数组）
    speakers: s.speakers ? JSON.parse(s.speakers) : null,
    // PPT/图片展示环节：上传到 /uploads/images/ 的相对路径（纯播报不计时）
    pptImage: s.pptImage || null,
  }
}
