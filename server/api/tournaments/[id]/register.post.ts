import { readBody } from 'h3'
import { prisma } from '../../../lib/prisma'
import { getUserFromEventWithSession, type JWTPayload } from '../../../utils/auth'
import {
  recordRegistrationQuestionnaireSubmission,
  syncRegistrationQuestionnaire,
} from '../../../utils/questionnaire'

// 赛事报名提交接口：同时支持个人报名与队伍报名
export default defineEventHandler(async (event) => {
  try {
    // 1. 解析路由参数中的赛事 ID
    const id = getRouterParam(event, 'id') as string

    // 2. 读取请求体
    const body = await readBody<{
      type: 'individual' | 'team'
      teamName?: string // 队伍报名时必填
      submitterName: string
      contactPhone: string
      contactEmail?: string
      notes?: string
      customData?: Record<string, string> // 自定义字段值
      members: { name: string; preferredPosition?: string; experience?: string }[]
    }>(event)

    const {
      type,
      teamName,
      submitterName,
      contactPhone,
      contactEmail,
      notes,
      customData,
      members,
    } = body

    // 3. 可选鉴权：尝试获取当前登录用户，未登录时 user 为 null（不抛错）
    // 修复：已登录用户使用 getUserFromEventWithSession 校验 tokenVersion，
    // 未登录用户可报名公开赛事（免登录模式）
    let user: JWTPayload | null = null
    try {
      user = await getUserFromEventWithSession(event, prisma)
    } catch {
      user = null
    }

    // 4. 校验：赛事必须存在
    const tournament = await prisma.tournament.findUnique({ where: { id } })
    if (!tournament) {
      throw createError({ statusCode: 404, message: '赛事不存在' })
    }

    // 5. 校验：赛事必须开放报名
    if (!tournament.registrationOpen) {
      throw createError({ statusCode: 400, message: '该赛事未开放报名' })
    }

    // 6. 校验：报名截止时间已过则拒绝
    if (tournament.registrationDeadline && new Date() > tournament.registrationDeadline) {
      throw createError({ statusCode: 400, message: '报名已截止' })
    }

    // 7. 校验：未登录用户仅允许报名公开赛事
    if (!user && !tournament.isPublic) {
      throw createError({ statusCode: 401, message: '未登录用户无权报名该赛事，请先登录' })
    }

    // 7.5 校验：报名类型是否被赛事允许（registrationType: individual | team | both）
    const allowedType = tournament.registrationType || 'both'
    if (allowedType !== 'both' && type !== allowedType) {
      const typeLabel = allowedType === 'individual' ? '仅个人' : '仅队伍'
      throw createError({
        statusCode: 400,
        message: `该赛事报名模式为「${typeLabel}」，不支持${type === 'individual' ? '队伍' : '个人'}报名`,
      })
    }

    // 8. 校验：队伍报名必须提供队伍名称
    if (type === 'team' && !teamName?.trim()) {
      throw createError({ statusCode: 400, message: '队伍报名必须填写队伍名称' })
    }

    // 9. 校验：至少需要 1 名报名成员
    if (!members || members.length === 0) {
      throw createError({ statusCode: 400, message: '至少需要 1 名报名成员' })
    }

    // 10. 校验：队伍报名时成员数不能超过赛事规定的队伍人数上限
    if (type === 'team' && tournament.teamSize && members.length > tournament.teamSize) {
      throw createError({
        statusCode: 400,
        message: `队伍成员数不能超过 ${tournament.teamSize} 人`,
      })
    }

    // 11. 校验：提交人姓名与联系电话必填
    if (!submitterName?.trim()) {
      throw createError({ statusCode: 400, message: '提交人姓名不能为空' })
    }
    if (!contactPhone?.trim()) {
      throw createError({ statusCode: 400, message: '联系电话不能为空' })
    }

    // 12. 防重复报名：已登录用户若已有待审核/已通过的报名记录则拒绝
    if (user) {
      const existing = await prisma.registration.findFirst({
        where: {
          tournamentId: id,
          userId: user.userId,
          status: { in: ['pending', 'approved'] },
        },
        select: { id: true },
      })
      if (existing) {
        throw createError({ statusCode: 409, message: '您已报名该赛事，请勿重复报名' })
      }
    }

    // 13. 事务：创建报名记录 + 报名成员记录
    const registration = await prisma.$transaction(async (tx) => {
      // 创建报名主记录
      const reg = await tx.registration.create({
        data: {
          tournamentId: id,
          type,
          status: 'pending',
          userId: user?.userId ?? null,
          teamName: type === 'team' ? teamName!.trim() : null,
          submitterName: submitterName.trim(),
          contactPhone: contactPhone.trim(),
          contactEmail: contactEmail?.trim() || null,
          notes: notes?.trim() || null,
          // 自定义字段数据以 JSON 字符串形式存储
          customData: customData ? JSON.stringify(customData) : null,
        },
      })

      // 批量创建报名成员记录
      await tx.registrationMember.createMany({
        data: members.map((m) => ({
          registrationId: reg.id,
          name: m.name.trim(),
          preferredPosition: m.preferredPosition?.trim() || null,
          experience: m.experience?.trim() || null,
        })),
      })

      return reg
    })

    // 14. 同步报名问卷定义并写入统一问卷提交快照。
    // 业务报名记录仍是权威数据；这里额外建立统一问卷索引，便于统一统计和导出。
    await syncRegistrationQuestionnaire(prisma, id, user?.userId ?? null)
    await recordRegistrationQuestionnaireSubmission(
      prisma,
      id,
      registration,
      members.map((m) => ({
        name: m.name.trim(),
        preferredPosition: m.preferredPosition?.trim() || null,
        experience: m.experience?.trim() || null,
      })),
    )

    // 返回创建成功的报名记录
    setResponseStatus(event, 201)
    return {
      code: 0,
      message: 'success',
      data: {
        id: registration.id,
        tournamentId: registration.tournamentId,
        type: registration.type,
        status: registration.status,
        userId: registration.userId,
        teamName: registration.teamName,
        submitterName: registration.submitterName,
        contactPhone: registration.contactPhone,
        contactEmail: registration.contactEmail,
        notes: registration.notes,
        customData: registration.customData,
        createdAt: registration.createdAt,
      },
    }
  } catch (error: any) {
    // 已知的业务错误直接抛出
    if (error.statusCode) throw error
    console.error('Create registration error:', error)
    throw createError({ statusCode: 500, message: '提交报名失败' })
  }
})
