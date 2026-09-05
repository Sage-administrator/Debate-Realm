// 保存/更新独立赛事的完整计时器配置
import { getRouterParam, readBody, createError } from 'h3'
import { prisma } from '../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../utils/auth'
import { syncStages, serializeStage } from '../../../utils/syncStages'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: '缺少赛事ID' })

  const body = await readBody(event)
  if (!body) throw createError({ statusCode: 400, message: '缺少请求体' })

  // 权限：系统管理员 或 该赛事的创建者
  const user = await getUserFromEventWithSession(event, prisma)
  const userId = user.userId

  const match = await prisma.standaloneMatch.findUnique({ where: { id } })
  if (!match) throw createError({ statusCode: 404, message: '独立赛事不存在' })
  if (match.userId !== userId && user.role !== 'system_admin') {
    throw createError({ statusCode: 403, message: '权限不足' })
  }

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

  const existing = await prisma.debateTimerProject.findUnique({
    where: { standaloneMatchId: id },
  })

  const projectData = {
    name: title || '辩论赛计时',
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

  // 事务：upsert project + syncStages
  const result = await prisma.$transaction(async (tx) => {
    let projectId: string

    if (!existing) {
      const created = await tx.debateTimerProject.create({
        data: {
          ...projectData,
          userId,
          standaloneMatchId: id,
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

    const incomingStages = Array.isArray(stages) ? stages : []
    const returnedStages = await syncStages(tx, projectId, incomingStages)

    return { projectId, returnedStages }
  })

  const updatedProject = await prisma.debateTimerProject.findUnique({
    where: { id: result.projectId },
  })

  if (!updatedProject) {
    throw createError({ statusCode: 500, message: '保存失败' })
  }

  return {
    data: {
      id: updatedProject.id,
      standaloneMatchId: updatedProject.standaloneMatchId,
      name: updatedProject.name,
      title: updatedProject.title,
      positiveTopic: updatedProject.positiveTopic,
      negativeTopic: updatedProject.negativeTopic,
      teamPositiveName: updatedProject.teamPositiveName,
      teamNegativeName: updatedProject.teamNegativeName,
      uiConfig: updatedProject.uiConfig ? JSON.parse(updatedProject.uiConfig) : null,
      skinConfig: updatedProject.skinConfig ? JSON.parse(updatedProject.skinConfig) : null,
      audioConfig: updatedProject.audioConfig ? JSON.parse(updatedProject.audioConfig) : null,
      teamLogoConfig: updatedProject.teamLogoConfig
        ? JSON.parse(updatedProject.teamLogoConfig)
        : null,
      stages: result.returnedStages.map(serializeStage),
      createdAt: updatedProject.createdAt,
      updatedAt: updatedProject.updatedAt,
    },
  }
})
