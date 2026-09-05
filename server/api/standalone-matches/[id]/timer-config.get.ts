// 获取独立赛事的完整计时器配置（包括项目信息、环节、UI/皮肤/音频/队徽配置）
import { prisma } from '../../../lib/prisma'
import { getUserFromEventWithSession } from '../../../utils/auth'
import { serializeStage } from '../../../utils/syncStages'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: '缺少赛事ID' })

  // 权限校验：登录用户 + 是本人创建或系统管理员
  const user = await getUserFromEventWithSession(event, prisma)
  const match = await prisma.standaloneMatch.findUnique({ where: { id } })
  if (!match) throw createError({ statusCode: 404, message: '独立赛事不存在' })
  if (match.userId !== user.userId && user.role !== 'system_admin') {
    throw createError({ statusCode: 403, message: '权限不足' })
  }

  // 1. 查找关联的计时器项目（通过 standaloneMatchId）
  const project = await prisma.debateTimerProject.findUnique({
    where: { standaloneMatchId: id },
    include: { stages: { orderBy: { orderIndex: 'asc' } } },
  })

  // 2. 如果不存在，尝试从 StandaloneMatch 数据创建默认配置
  if (!project) {
    const match = await prisma.standaloneMatch.findUnique({
      where: { id },
    })
    if (!match) {
      throw createError({ statusCode: 404, message: '独立赛事不存在' })
    }

    // 创建默认配置（空项目，有基础信息）
    const defaultConfig = {
      id: 'new',
      standaloneMatchId: id,
      name: match.name,
      title: match.name,
      positiveTopic: null,
      negativeTopic: null,
      teamPositiveName: null,
      teamNegativeName: null,
      uiConfig: null, // 界面元素配置
      skinConfig: null, // 背景配置
      audioConfig: null, // 提示音配置
      teamLogoConfig: null, // 队徽配置
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
      standaloneMatchId: project.standaloneMatchId,
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
      stages: project.stages.map(serializeStage),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
    isNew: false,
  }
})
