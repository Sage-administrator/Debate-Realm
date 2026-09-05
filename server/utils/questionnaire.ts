/**
 * 通用问卷系统工具函数
 *
 * 设计目标：
 * - 报名、投票等业务表继续保留，避免破坏既有流程
 * - 额外同步到 Questionnaire / QuestionnaireQuestion / QuestionnaireSubmission
 * - 后续签到、反馈等功能可以直接接入这套统一问卷底座
 */

import { parseTopics, parseAllowedVoters, topicDisplayText } from './topic-vote'
import { safeJsonStringify, safeJsonParse } from './common'

// Prisma 事务客户端和普通客户端都支持这里用到的方法，因此使用结构宽松的 any 类型。
// 注意：Prisma 事务客户端类型与普通客户端类型不完全兼容，使用 any 避免类型错误。
type PrismaLike = any

// 使用公共 JSON 工具函数
const toJson = safeJsonStringify
const fromJson = <T>(value: string | null | undefined, fallback: T) =>
  safeJsonParse<T>(value, fallback)

// 根据来源查找问卷。
async function findQuestionnaire(
  client: PrismaLike,
  tournamentId: string,
  sourceType: string,
  sourceId: string,
) {
  return await client.questionnaire.findFirst({
    where: { tournamentId, sourceType, sourceId },
  })
}

/**
 * 同步报名问卷定义。
 * registration 的 sourceId 使用 tournamentId，表示“该赛事的报名问卷”。
 */
export async function syncRegistrationQuestionnaire(
  client: PrismaLike,
  tournamentId: string,
  createdBy?: string | null,
) {
  const tournament = await client.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      regFields: { orderBy: { sortOrder: 'asc' } },
    },
  })
  if (!tournament) return null

  const status = tournament.registrationOpen ? 'open' : 'closed'
  const title = `${tournament.name} 报名问卷`
  const settings = {
    registrationOpen: tournament.registrationOpen,
    registrationDeadline: tournament.registrationDeadline,
    isPublic: tournament.isPublic,
    registrationType: tournament.registrationType,
    teamSize: tournament.teamSize,
    source: 'registration',
  }

  const existing = await findQuestionnaire(client, tournamentId, 'registration', tournamentId)
  const questionnaire = existing
    ? await client.questionnaire.update({
        where: { id: existing.id },
        data: {
          title,
          description: tournament.registrationInfo,
          status,
          settings: toJson(settings),
          createdBy: existing.createdBy || createdBy || null,
        },
      })
    : await client.questionnaire.create({
        data: {
          tournamentId,
          sourceType: 'registration',
          sourceId: tournamentId,
          title,
          description: tournament.registrationInfo,
          status,
          settings: toJson(settings),
          createdBy: createdBy || null,
        },
      })

  // 整体重建题目，保证顺序和字段配置完全一致。
  await client.questionnaireQuestion.deleteMany({
    where: { questionnaireId: questionnaire.id },
  })

  if (tournament.regFields.length > 0) {
    await client.questionnaireQuestion.createMany({
      data: tournament.regFields.map((field: any, index: number) => ({
        questionnaireId: questionnaire.id,
        fieldKey: field.fieldKey,
        title: field.fieldName,
        questionType: field.fieldType,
        options: field.fieldOptions,
        required: !!field.required,
        sortOrder: typeof field.sortOrder === 'number' ? field.sortOrder : index,
        visibilityRule: toJson({ appliesTo: field.appliesTo }),
        meta: toJson({
          placeholder: field.placeholder,
          description: field.description,
          width: field.width,
          systemField: field.systemField,
        }),
      })),
    })
  }

  return questionnaire
}

/**
 * 同步辩题投票问卷定义。
 * topic_vote 的 sourceId 使用 TopicVote.id，表示“某一份投票问卷”。
 */
export async function syncTopicVoteQuestionnaire(
  client: PrismaLike,
  tournamentId: string,
  voteId: string,
  createdBy?: string | null,
) {
  const vote = await client.topicVote.findFirst({
    where: { id: voteId, tournamentId },
  })
  if (!vote) return null

  const topics = parseTopics(vote.topics)
  const allowedVoters = parseAllowedVoters(vote.allowedVoters)
  const settings = {
    matchId: vote.matchId,
    allowedVoters,
    multipleChoice: vote.multipleChoice,
    deadline: vote.deadline,
    showResults: vote.showResults,
    source: 'topic_vote',
  }

  const existing = await findQuestionnaire(client, tournamentId, 'topic_vote', voteId)
  const questionnaire = existing
    ? await client.questionnaire.update({
        where: { id: existing.id },
        data: {
          title: vote.title,
          description: vote.description,
          status: vote.status,
          settings: toJson(settings),
          createdBy: existing.createdBy || createdBy || vote.createdBy || null,
        },
      })
    : await client.questionnaire.create({
        data: {
          tournamentId,
          sourceType: 'topic_vote',
          sourceId: voteId,
          title: vote.title,
          description: vote.description,
          status: vote.status,
          settings: toJson(settings),
          createdBy: createdBy || vote.createdBy || null,
        },
      })

  await client.questionnaireQuestion.deleteMany({
    where: { questionnaireId: questionnaire.id },
  })

  await client.questionnaireQuestion.create({
    data: {
      questionnaireId: questionnaire.id,
      fieldKey: 'topicIndices',
      title: '请选择你支持的辩题',
      questionType: vote.multipleChoice ? 'checkbox' : 'radio',
      options: toJson(topics.map((t) => topicDisplayText(t))),
      required: true,
      sortOrder: 0,
      visibilityRule: toJson({ allowedVoters }),
      meta: toJson({
        matchId: vote.matchId,
        showResults: vote.showResults,
      }),
    },
  })

  return questionnaire
}

// 删除某个业务来源对应的通用问卷。
export async function deleteQuestionnaireBySource(
  client: PrismaLike,
  tournamentId: string,
  sourceType: string,
  sourceId: string,
) {
  const questionnaire = await findQuestionnaire(client, tournamentId, sourceType, sourceId)
  if (!questionnaire) return
  await client.questionnaire.delete({ where: { id: questionnaire.id } })
}

/**
 * 写入报名问卷提交快照。
 * sourceId 使用 Registration.id。
 */
export async function recordRegistrationQuestionnaireSubmission(
  client: PrismaLike,
  tournamentId: string,
  registration: any,
  members: any[],
) {
  const questionnaire =
    (await findQuestionnaire(client, tournamentId, 'registration', tournamentId)) ||
    (await syncRegistrationQuestionnaire(client, tournamentId))

  if (!questionnaire) return null

  const customData = fromJson<Record<string, any>>(registration.customData, {})
  const answers = {
    type: registration.type,
    teamName: registration.teamName,
    submitterName: registration.submitterName,
    contactPhone: registration.contactPhone,
    contactEmail: registration.contactEmail,
    notes: registration.notes,
    members,
    customData,
  }

  return await client.questionnaireSubmission.create({
    data: {
      questionnaireId: questionnaire.id,
      sourceType: 'registration',
      sourceId: registration.id,
      respondentUserId: registration.userId,
      respondentName: registration.submitterName,
      answers: toJson(answers),
      meta: toJson({
        registrationType: registration.type,
        status: registration.status,
      }),
    },
  })
}

/**
 * 写入投票问卷提交快照。
 * sourceId 使用 TopicVoteRecord.id。
 */
export async function recordTopicVoteQuestionnaireSubmission(
  client: PrismaLike,
  tournamentId: string,
  vote: any,
  record: any,
  selectedIndices: number[],
) {
  const questionnaire =
    (await findQuestionnaire(client, tournamentId, 'topic_vote', vote.id)) ||
    (await syncTopicVoteQuestionnaire(client, tournamentId, vote.id))

  if (!questionnaire) return null

  const topics = parseTopics(vote.topics)
  const selectedTopics = selectedIndices
    .map((index) => topicDisplayText(topics[index]))
    .filter(Boolean)

  return await client.questionnaireSubmission.create({
    data: {
      questionnaireId: questionnaire.id,
      sourceType: 'topic_vote',
      sourceId: record.id,
      respondentUserId: record.userId,
      respondentName: record.voterName,
      answers: toJson({
        topicIndices: selectedIndices,
        selectedTopics,
      }),
      meta: toJson({
        voteId: vote.id,
        voterType: record.voterType,
        voterFingerprint: record.voterFingerprint,
      }),
    },
  })
}
