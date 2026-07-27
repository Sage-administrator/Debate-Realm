// 保存/更新赛事的完整计时器配置
import { getRouterParam, readBody, createError } from 'h3'
import { prisma } from '../../../lib/prisma'
import { requireWriteTournament } from '../../../utils/tournament-auth'
import { syncStages, serializeStage } from '../../../utils/syncStages'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: '缺少赛事ID' })

  const body = await readBody(event)
  if (!body) throw createError({ statusCode: 400, message: '缺少请求体' })

  // 权限：系统管理员 或 该赛事所属团队的管理员
  const { user } = await requireWriteTournament(event, prisma, id)
  const userId = user.userId

  const {
    title,
    positiveTopic,
    negativeTopic,
    teamPositiveName,
    teamNegativeName,
    uiConfig,
    skinConfig,
    audioConfig,
    teamLogoConfig,
    stages,
  } = body

  // 查找现有的计时器项目
  const existing = await prisma.debateTimerProject.findUnique({
    where: { tournamentId: id },
  })

  const projectData = {
    name: title || '辩论赛计时', // name 保留但不再由前端控制，与 title 同步
    title: title || '辩论赛计时',
    positiveTopic: positiveTopic || null,
    negativeTopic: negativeTopic || null,
    teamPositiveName: teamPositiveName || null,
    teamNegativeName: teamNegativeName || null,
    uiConfig: uiConfig ? JSON.stringify(uiConfig) : null,
    skinConfig: skinConfig ? JSON.stringify(skinConfig) : null,
    audioConfig: audioConfig ? JSON.stringify(audioConfig) : null,
    teamLogoConfig: teamLogoConfig ? JSON.stringify(teamLogoConfig) : null,
  }

  // 事务：upsert project + syncStages（diff + update + create + delete）
  const result = await prisma.$transaction(async (tx) => {
    let projectId: string

    if (!existing) {
      const created = await tx.debateTimerProject.create({
        data: {
          ...projectData,
          userId,
          tournamentId: id,
        },
      })
      projectId = created.id
    } else {
      await tx.debateTimerProject.update({
        where: { id: existing.id },
        data: projectData,
      })
      projectId = existing.id
    }

    // syncStages：识别 tmp_ 前缀走 create，其余走 update，删除被移除的
    const incomingStages = Array.isArray(stages) ? stages : []
    const returnedStages = await syncStages(tx, projectId, incomingStages)

    return { projectId, returnedStages }
  })

  // 返回更新后的完整配置（含 DB 生成的真实 id）
  const updatedProject = await prisma.debateTimerProject.findUnique({
    where: { id: result.projectId },
  })

  if (!updatedProject) {
    throw createError({ statusCode: 500, message: '保存失败' })
  }

  return {
    data: {
      id: updatedProject.id,
      tournamentId: updatedProject.tournamentId,
      name: updatedProject.name,
      title: updatedProject.title,
      positiveTopic: updatedProject.positiveTopic,
      negativeTopic: updatedProject.negativeTopic,
      teamPositiveName: updatedProject.teamPositiveName,
      teamNegativeName: updatedProject.teamNegativeName,
      uiConfig: updatedProject.uiConfig ? JSON.parse(updatedProject.uiConfig) : null,
      skinConfig: updatedProject.skinConfig ? JSON.parse(updatedProject.skinConfig) : null,
      audioConfig: updatedProject.audioConfig ? JSON.parse(updatedProject.audioConfig) : null,
      teamLogoConfig: updatedProject.teamLogoConfig ? JSON.parse(updatedProject.teamLogoConfig) : null,
      stages: result.returnedStages.map(serializeStage),
      createdAt: updatedProject.createdAt,
      updatedAt: updatedProject.updatedAt,
    },
  }
})
