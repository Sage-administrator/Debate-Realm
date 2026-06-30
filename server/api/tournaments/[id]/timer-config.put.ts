// 保存/更新赛事的完整计时器配置
import { prisma } from '../../../lib/prisma'
import { requireWriteTournament } from '../../../utils/tournament-auth'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: '缺少赛事ID' })

  const body = await readBody(event)
  if (!body) throw createError({ statusCode: 400, statusMessage: '缺少请求体' })

  // 权限：系统管理员 或 该赛事所属团队的管理员
  const { user } = await requireWriteTournament(event, prisma, id)
  const userId = user.userId

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
    where: { tournamentId: id },
  })

  // 构造配置数据对象（不包含 userId 和 tournamentId，这些在创建或更新时单独处理）
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
    // 使用从 token 中获取的真实 userId，确保外键约束满足
    project = await prisma.debateTimerProject.create({
      data: {
        ...projectData,
        userId: userId,  // 使用真实用户 ID
        tournamentId: id,
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
    // 4. 更新现有项目（不需要 userId 和 tournamentId，它们已经是正确的）
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
    throw createError({ statusCode: 500, statusMessage: '保存失败' })
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
      stages: updatedProject.stages.map((s: any) => ({
        id: s.id,
        name: s.name,
        duration: s.duration,
        type: s.type,
        description: s.description,
        orderIndex: s.orderIndex,
        positiveDuration: s.positiveDuration,
        negativeDuration: s.negativeDuration,
        allowedRoles: s.allowedRoles ? JSON.parse(s.allowedRoles) : null,
      })),
      createdAt: updatedProject.createdAt,
      updatedAt: updatedProject.updatedAt,
    },
  }
})
