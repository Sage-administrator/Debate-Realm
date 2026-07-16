// 保存/更新独立赛事的完整计时器配置
import { getRouterParam, readBody, createError } from 'h3'
import { prisma } from '../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: '缺少赛事ID' })

  const body = await readBody(event)
  if (!body) throw createError({ statusCode: 400, message: '缺少请求体' })

  // 权限：系统管理员 或 该赛事的创建者
  const user = await getUserFromEventWithSession(event, prisma)
  const userId = user.userId

  // 验证权限
  const match = await prisma.standaloneMatch.findUnique({ where: { id } })
  if (!match) throw createError({ statusCode: 404, message: '独立赛事不存在' })
  if (match.userId !== userId && user.role !== 'system_admin') {
    throw createError({ statusCode: 403, message: '权限不足' })
  }

  const {
    name,
    title,
    positiveTopic,
    negativeTopic,
    teamPositiveName,
    teamNegativeName,
    uiConfig,        // 对象
    skinConfig,      // 对象
    audioConfig,     // 对象
    teamLogoConfig,  // 对象
    stages,          // 环节数组
  } = body

  // 1. 查找现有的计时器项目
  let project = await prisma.debateTimerProject.findUnique({
    where: { standaloneMatchId: id },
  })

  // 构造配置数据对象
  const projectData = {
    name: name || '未命名配置',
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

  if (!project) {
    // 2. 创建新的计时器项目
    project = await prisma.debateTimerProject.create({
      data: {
        ...projectData,
        userId: userId,
        standaloneMatchId: id,
      },
    })

    // 3. 如果有环节数据，创建环节
    if (stages && Array.isArray(stages) && stages.length > 0) {
      await Promise.all(
        stages.map((stage: any, index: number) =>
          prisma.debateTimerStage.create({
            data: {
              projectId: project!.id,
              name: stage.name || '未命名环节',
              duration: stage.duration || 0,
              type: stage.type || 'speech',
              description: stage.description || null,
              orderIndex: typeof stage.orderIndex === 'number' ? stage.orderIndex : index,
              positiveDuration: stage.positiveDuration || null,
              negativeDuration: stage.negativeDuration || null,
              allowedRoles: stage.allowedRoles ? JSON.stringify(stage.allowedRoles) : null,
            },
          })
        )
      )
    }
  } else {
    // 4. 更新现有项目
    project = await prisma.debateTimerProject.update({
      where: { id: project.id },
      data: projectData,
    })

    // 5. 删除旧环节，重新创建
    if (stages && Array.isArray(stages)) {
      await prisma.debateTimerStage.deleteMany({
        where: { projectId: project.id },
      })
      if (stages.length > 0) {
        await Promise.all(
          stages.map((stage: any, index: number) =>
            prisma.debateTimerStage.create({
              data: {
                projectId: project!.id,
                name: stage.name || '未命名环节',
                duration: stage.duration || 0,
                type: stage.type || 'speech',
                description: stage.description || null,
                orderIndex: typeof stage.orderIndex === 'number' ? stage.orderIndex : index,
                positiveDuration: stage.positiveDuration || null,
                negativeDuration: stage.negativeDuration || null,
                allowedRoles: stage.allowedRoles ? JSON.stringify(stage.allowedRoles) : null,
              },
            })
          )
        )
      }
    }
  }

  // 6. 返回更新后的完整配置
  const updatedProject = await prisma.debateTimerProject.findUnique({
    where: { id: project.id },
    include: { stages: { orderBy: { orderIndex: 'asc' } } },
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
      teamLogoConfig: updatedProject.teamLogoConfig ? JSON.parse(updatedProject.teamLogoConfig) : null,
      stages: updatedProject.stages.map((s: any) => ({
        id: s.id,
        name: s.name,
        duration: s.duration,
        type: s.type,
        description: s.description,
        orderIndex: s.orderIndex,
        positiveDuration: s.positiveDuration,
        negativeDuration: s.negativeDuration,
        allowedRoles: s.allowedRoles ? JSON.stringify(s.allowedRoles) : null,
      })),
      createdAt: updatedProject.createdAt,
      updatedAt: updatedProject.updatedAt,
    },
  }
})