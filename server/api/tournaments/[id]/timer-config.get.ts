// 获取赛事的完整计时器配置（包括项目信息、环节、UI/皮肤/音频/队徽配置）
import { prisma } from '../../../lib/prisma'
import { requireReadTournament } from '../../../utils/tournament-auth'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: '缺少赛事ID' })

  // 权限：系统管理员 或 该赛事所属团队的管理员 / 子账号
  await requireReadTournament(event, prisma, id)

  // 1. 查找关联的计时器项目（通过 tournamentId）
  let project = await prisma.debateTimerProject.findUnique({
    where: { tournamentId: id },
    include: { stages: { orderBy: { orderIndex: 'asc' } } },
  })

  // 2. 如果不存在，尝试从 Tournament 数据创建默认配置
  if (!project) {
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: { teams: true },
    })
    if (!tournament) {
      throw createError({ statusCode: 404, message: '赛事不存在' })
    }

    // 创建默认配置（空项目，有基础信息）
    const defaultConfig = {
      id: 'new',
      tournamentId: id,
      name: tournament.name,
      title: tournament.name,
      positiveTopic: null,
      negativeTopic: null,
      teamPositiveName: null,
      teamNegativeName: null,
      uiConfig: null,     // 界面元素配置
      skinConfig: null,    // 背景配置
      audioConfig: null,   // 提示音配置
      teamLogoConfig: null,// 队徽配置
      stages: [],
      createdAt: null,
      updatedAt: null,
    }
    return { data: defaultConfig, isNew: true }
  }

  // 3. 解析 JSON 配置字段并返回完整数据
  return {
    data: {
      id: project.id,
      tournamentId: project.tournamentId,
      name: project.name,
      title: project.title,
      positiveTopic: project.positiveTopic,
      negativeTopic: project.negativeTopic,
      teamPositiveName: project.teamPositiveName,
      teamNegativeName: project.teamNegativeName,
      uiConfig: project.uiConfig ? JSON.parse(project.uiConfig) : null,
      skinConfig: project.skinConfig ? JSON.parse(project.skinConfig) : null,
      audioConfig: project.audioConfig ? JSON.parse(project.audioConfig) : null,
      teamLogoConfig: project.teamLogoConfig ? JSON.parse(project.teamLogoConfig) : null,
      stages: project.stages.map((s: any) => ({
        id: s.id,
        name: s.name,
        duration: s.duration,
        type: s.type,
        description: s.description,
        orderIndex: s.orderIndex,
        positiveDuration: s.positiveDuration,
        negativeDuration: s.negativeDuration,
        allowedRoles: s.allowedRoles ? JSON.parse(s.allowedRoles) : null,
        speaker: s.speaker,
        questioner: s.questioner,
        responder: s.responder,
        firstSpeaker: s.firstSpeaker,
        protectionTime: s.protectionTime,
        positiveSpeakers: s.positiveSpeakers ? JSON.parse(s.positiveSpeakers) : null,
        negativeSpeakers: s.negativeSpeakers ? JSON.parse(s.negativeSpeakers) : null,
        speakers: s.speakers ? JSON.parse(s.speakers) : null,
        questionDuration: s.questionDuration,
        answerDuration: s.answerDuration,
        enabled: s.enabled,
        pptImage: s.pptImage || null,
      })),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
    isNew: false,
  }
})
