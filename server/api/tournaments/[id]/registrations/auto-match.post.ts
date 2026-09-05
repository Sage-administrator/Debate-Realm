// =====================================================================
// 个人报名自动组队（预览） API
// POST /api/tournaments/{id}/registrations/auto-match
// 功能：
//   - 拉取本赛事所有已通过审核、尚未转换为参赛队伍的个人报名
//   - 按优先辩位进行均衡分组，生成建议队伍名单
//   - 仅返回建议分组，不写入数据库；管理员确认后通过 convert-teams 接口落地
// 请求体：
//   { teamSize?: number }  // 可选，默认取赛事 teamSize，再兜底 4
// 返回：
//   { teams: [{ suggestedName, members: [...] }], unmatched: [...] }
// =====================================================================

import { createError } from 'h3'
import { prisma } from '../../../../lib/prisma'
import { requireWriteTournament } from '../../../../utils/tournament-auth'

// 标准辩位顺序（与 schema 注释一致：一辩/二辩/三辩/四辩/不限）
const STANDARD_POSITIONS = ['一辩', '二辩', '三辩', '四辩']

export default defineEventHandler(async (event) => {
  try {
    // 1. 解析赛事 ID 并鉴权（系统管理员或赛事所属团队管理员）
    const id = getRouterParam(event, 'id') as string
    const { tournament } = await requireWriteTournament(event, prisma, id)

    // 2. 读取请求体：teamSize 可选
    const body = await readBody<{ teamSize?: number }>(event)
    // 队伍人数：优先请求体 → 赛事配置 → 默认 4
    const teamSize = body?.teamSize ?? tournament.teamSize ?? 4
    if (!Number.isInteger(teamSize) || teamSize < 1) {
      throw createError({ statusCode: 400, message: 'teamSize 必须为正整数' })
    }

    // 3. 拉取所有已通过审核、尚未转换为参赛队伍的个人报名记录（含成员）
    const individuals = await prisma.registration.findMany({
      where: {
        tournamentId: id,
        type: 'individual',
        status: 'approved',
        convertedTeamId: null,
      },
      include: { members: true },
      orderBy: { createdAt: 'asc' },
    })

    // 4. 收集所有个人报名成员（每条个人报名对应 1 名成员，此处防御性遍历）
    type MemberInfo = {
      registrationId: string
      memberId: string
      name: string
      preferredPosition: string | null
      experience: string | null
    }
    const allMembers: MemberInfo[] = []
    for (const reg of individuals) {
      for (const m of reg.members) {
        allMembers.push({
          registrationId: reg.id,
          memberId: m.id,
          name: m.name,
          preferredPosition: m.preferredPosition,
          experience: m.experience,
        })
      }
    }

    // 5. 按优先辩位分桶，尽量让每支队伍辩位不重复
    // 使用 Map 避免下标访问在 noUncheckedIndexedAccess 下产生 undefined 类型
    const positionBuckets = new Map<string, MemberInfo[]>(
      STANDARD_POSITIONS.map((p) => [p, [] as MemberInfo[]]),
    )
    positionBuckets.set('不限', [])
    const otherPositions: MemberInfo[] = [] // 不在标准辩位中的成员
    for (const m of allMembers) {
      const pos = m.preferredPosition?.trim() || '不限'
      const bucket = positionBuckets.get(pos)
      if (bucket) {
        bucket.push(m)
      } else {
        otherPositions.push(m)
      }
    }

    // 工具函数：从指定辩位池取出队首成员（池为空时返回 null）
    const shiftBucket = (pos: string): MemberInfo | null => {
      const bucket = positionBuckets.get(pos)
      return bucket && bucket.length > 0 ? bucket.shift()! : null
    }
    // 工具函数：查询指定辩位池当前长度
    const bucketLen = (pos: string): number => positionBuckets.get(pos)?.length ?? 0

    // 6. 组队：每轮从不同辩位各取 1 人，剩余用"不限"/其他辩位填充
    const teams: { suggestedName: string; members: MemberInfo[] }[] = []
    const unmatched: MemberInfo[] = []
    let teamIndex = 1

    while (true) {
      // 剩余可用人数不足以凑齐一支队伍则停止
      const remainingTotal =
        STANDARD_POSITIONS.reduce((s, p) => s + bucketLen(p), 0) +
        bucketLen('不限') +
        otherPositions.length
      if (remainingTotal < teamSize) break

      const team: MemberInfo[] = []
      const usedPositions = new Set<string>()

      // 6a. 优先从各标准辩位各取 1 人（避免同队辩位重复）
      for (const pos of STANDARD_POSITIONS) {
        if (team.length >= teamSize) break
        if (!usedPositions.has(pos)) {
          const m = shiftBucket(pos)
          if (m) {
            team.push(m)
            usedPositions.add(pos)
          }
        }
      }

      // 6b. 不足 teamSize 时，用"不限"池填充
      while (team.length < teamSize) {
        const m = shiftBucket('不限')
        if (!m) break
        team.push(m)
      }

      // 6c. 仍不足时，先从其他辩位取，再从任意标准辩位剩余人员中取（允许重复辩位）
      while (team.length < teamSize) {
        if (otherPositions.length > 0) {
          team.push(otherPositions.shift()!)
          continue
        }
        let picked = false
        for (const pos of STANDARD_POSITIONS) {
          const m = shiftBucket(pos)
          if (m) {
            team.push(m)
            picked = true
            break
          }
        }
        if (!picked) break
      }

      // 凑不齐则将已取出的人归入 unmatched 并结束组队（理论上前面已挡，这里做兜底）
      if (team.length < teamSize) {
        unmatched.push(...team)
        break
      }

      teams.push({
        suggestedName: `调剂队伍${teamIndex}`,
        members: team,
      })
      teamIndex++
    }

    // 7. 把所有池子里剩余的人也加入 unmatched
    for (const pos of STANDARD_POSITIONS) {
      const bucket = positionBuckets.get(pos)
      if (bucket) unmatched.push(...bucket)
    }
    const anyBucket = positionBuckets.get('不限')
    if (anyBucket) unmatched.push(...anyBucket)
    unmatched.push(...otherPositions)

    // 8. 返回建议分组（不写库），由管理员确认后调用 convert-teams 落地
    return {
      teams,
      unmatched,
    }
  } catch (error: any) {
    // 已知的业务错误（含鉴权 / 校验抛出的 createError）直接抛出
    if (error.statusCode) throw error
    console.error('Auto-match error:', error)
    throw createError({ statusCode: 500, message: '自动组队失败' })
  }
})
