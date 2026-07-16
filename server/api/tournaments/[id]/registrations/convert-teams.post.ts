// =====================================================================
// 报名记录转参赛队伍 API
// POST /api/tournaments/{id}/registrations/convert-teams
// 功能：
//   - 将一批报名记录合并为 TournamentTeam（回填 Registration.convertedTeamId）
//   - 每支新队伍：
//       * 建一条 TournamentTeam 记录
//       * 建一间「队伍聊天房」(ChatRoom type='team', tournamentTeamId=队id)
//       * 为该队伍每一位队员创建一个子账号(User role='subaccount',
//         tournamentTeamId=队id, teamId=赛事所属全局Team)，供其登录后在
//         本队聊天房发言。子账号明文密码仅此一次返回，供管理员分发。
//   - 整个操作在事务内完成，保证原子性
// 请求体：
//   { items: [ { name: string, registrationIds: string[] } ] }
// 返回：
//   { success, created, accounts: [{ teamName, username, password, name }] }
// =====================================================================

import { createError } from 'h3'
import { prisma } from '../../../../lib/prisma'
import { requireWriteTournament } from '../../../../utils/tournament-auth'
import { hashPassword } from '../../../../lib/jwt'

// 生成指定长度的随机字母数字字符串（用于用户名后缀与密码）
function randomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// 生成 8 位随机字母数字密码（明文，仅此一次返回给管理员）
function generatePassword(): string {
  return randomString(8)
}

export default defineEventHandler(async (event) => {
  try {
    // 1. 解析赛事 ID 并鉴权（系统管理员或赛事所属团队管理员）
    const id = getRouterParam(event, 'id') as string
    const { tournament } = await requireWriteTournament(event, prisma, id)

    // 2. 读取请求体
    const body = await readBody<{
      items: { name: string; registrationIds: string[] }[]
    }>(event)

    if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
      throw createError({ statusCode: 400, message: '缺少 items 或 items 为空' })
    }
    for (const item of body.items) {
      if (!item.name || !item.name.trim()) {
        throw createError({ statusCode: 400, message: '队伍名称不能为空' })
      }
      if (!Array.isArray(item.registrationIds) || item.registrationIds.length === 0) {
        throw createError({ statusCode: 400, message: '每支队伍至少需要 1 条报名记录' })
      }
    }

    // 3. 归属校验：所有 registrationId 必须属于本赛事且尚未转换
    const allRegIds = body.items.flatMap((it) => it.registrationIds)
    const existingRegs = await prisma.registration.findMany({
      where: { id: { in: allRegIds } },
      select: { id: true, tournamentId: true, convertedTeamId: true },
    })
    const existingMap = new Map(existingRegs.map((r) => [r.id, r]))

    for (const regId of allRegIds) {
      const reg = existingMap.get(regId)
      if (!reg) {
        throw createError({ statusCode: 404, message: `报名记录不存在: ${regId}` })
      }
      if (reg.tournamentId !== id) {
        throw createError({ statusCode: 400, message: `报名记录不属于本赛事: ${regId}` })
      }
      if (reg.convertedTeamId) {
        throw createError({ statusCode: 400, message: `报名记录已转换为参赛队伍: ${regId}` })
      }
    }

    // 4. 预读取报名及其成员（事务外），并为每位尚无账号的队员预生成
    //    子账号用户名 + 密码哈希（bcrypt 哈希是 CPU 密集操作，放事务外）
    const registrations = await prisma.registration.findMany({
      where: { id: { in: allRegIds } },
      include: { members: true },
    })
    const regById = new Map(registrations.map((r) => [r.id, r]))

    type PendingAccount = {
      registrationId: string
      memberId: string
      memberName: string
      username: string
      password: string
      passwordHash: string
    }

    const planByItem: { item: { name: string; registrationIds: string[] }; accounts: PendingAccount[] }[] = []

    for (const item of body.items) {
      const accounts: PendingAccount[] = []
      for (const regId of item.registrationIds) {
        const reg = regById.get(regId)
        if (!reg) continue
        for (const member of reg.members) {
          if (member.userId) continue // 已有账号则跳过（幂等）

          const cleanName = member.name.trim().replace(/\s+/g, '')
          let username = ''
          for (let attempt = 0; attempt < 10; attempt++) {
            const candidate = `sub_${cleanName}_${randomString(4)}`
            const existing = await prisma.user.findUnique({
              where: { username: candidate },
              select: { id: true },
            })
            if (!existing) {
              username = candidate
              break
            }
          }
          if (!username) username = `sub_${cleanName}_${randomString(8)}`

          const password = generatePassword()
          const passwordHash = await hashPassword(password)
          accounts.push({
            registrationId: regId,
            memberId: member.id,
            memberName: member.name,
            username,
            password,
            passwordHash,
          })
        }
      }
      planByItem.push({ item, accounts })
    }

    // 明文账号信息（仅此一次返回）
    const createdAccounts: { teamName: string; username: string; password: string; name: string }[] = []

    // 5. 事务：建队伍 + 聊天房 + 子账号，全部原子完成
    const created = await prisma.$transaction(async (tx) => {
      let count = 0
      for (const { item, accounts } of planByItem) {
        const teamName = item.name.trim()

        // 5a. 创建参赛队伍
        const team = await tx.tournamentTeam.create({
          data: { tournamentId: id, name: teamName },
        })

        // 5b. 创建队伍聊天房（幂等 upsert）
        await tx.chatRoom.upsert({
          where: {
            tournamentId_type_tournamentTeamId: {
              tournamentId: id,
              type: 'team',
              tournamentTeamId: team.id,
            },
          },
          create: { tournamentId: id, type: 'team', tournamentTeamId: team.id, name: teamName },
          update: { name: teamName },
        })

        // 5c. 为该队伍每位队员创建子账号
        for (const acc of accounts) {
          const newUser = await tx.user.create({
            data: {
              username: acc.username,
              password: acc.passwordHash,
              nickname: acc.memberName,
              role: 'subaccount',
              mode: 'debater',
              teamId: tournament.teamId,
              tournamentTeamId: team.id,
            },
          })
          // 加入赛事所属全局团队（与既有辩手子账号一致）
          await tx.teamMember.create({
            data: { teamId: tournament.teamId, userId: newUser.id },
          })
          // 回填报名成员与系统用户的关联
          await tx.registrationMember.update({
            where: { id: acc.memberId },
            data: { userId: newUser.id },
          })
          createdAccounts.push({
            teamName,
            username: acc.username,
            password: acc.password,
            name: acc.memberName,
          })
        }

        // 5d. 回填报名记录：已转换 + 已建号
        await tx.registration.updateMany({
          where: { id: { in: item.registrationIds } },
          data: { convertedTeamId: team.id, accountCreated: true },
        })
        count++
      }
      return count
    })

    // 6. 返回结果（含明文密码，管理员据此分发给队员）
    return {
      success: true,
      created,
      accounts: createdAccounts,
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Convert teams error:', error)
    throw createError({ statusCode: 500, message: '转换为参赛队伍失败' })
  }
})
