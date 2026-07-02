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

// 管理员接口：为已通过审核的报名成员批量创建辩手子账号
export default defineEventHandler(async (event) => {
  try {
    // 1. 解析路由参数中的赛事 ID，并校验当前用户对该赛事的写权限
    const id = getRouterParam(event, 'id') as string
    const { tournament } = await requireWriteTournament(event, prisma, id)

    // 2. 读取请求体：registrationIds 可选，未提供则处理所有已通过且未建号的报名
    const body = await readBody<{ registrationIds?: string[] }>(event)
    const registrationIds = body?.registrationIds

    // 3. 查询已通过审核、尚未创建账号的报名记录（含成员），可按 registrationIds 过滤
    const registrations = await prisma.registration.findMany({
      where: {
        tournamentId: id,
        status: 'approved',
        accountCreated: false,
        // 若指定了 registrationIds，则仅处理这些报名记录
        ...(registrationIds && registrationIds.length > 0
          ? { id: { in: registrationIds } }
          : {}),
      },
      include: { members: true },
    })

    // 收集待创建账号的成员信息（预处理：在事务外生成用户名 + 密码哈希，避免事务长时间占用）
    type PendingAccount = {
      memberId: string
      memberName: string
      registrationId: string
      username: string
      password: string
      passwordHash: string
    }
    const pendingAccounts: PendingAccount[] = []

    // 4a. 预处理阶段：在事务外为每位成员生成唯一用户名 + 哈希密码
    //     （bcrypt 哈希是 CPU 密集型操作，放在事务内会拉长事务持锁时间，影响并发）
    for (const registration of registrations) {
      for (const member of registration.members) {
        // 若该成员已关联用户（如上次部分执行），跳过避免重复建号
        if (member.userId) continue

        // a. 生成唯一用户名：debater_<name>_<4chars>，重试直到不与现有用户名冲突
        const cleanName = member.name.trim().replace(/\s+/g, '')
        let username = ''
        for (let attempt = 0; attempt < 10; attempt++) {
          const candidate = `debater_${cleanName}_${randomString(4)}`
          const existing = await prisma.user.findUnique({
            where: { username: candidate },
            select: { id: true },
          })
          if (!existing) {
            username = candidate
            break
          }
        }
        // 兜底：10 次仍冲突则使用更长后缀
        if (!username) {
          username = `debater_${cleanName}_${randomString(8)}`
        }

        // b. 生成随机 8 位密码并哈希（CPU 密集操作放在事务外）
        const password = generatePassword()
        const passwordHash = await hashPassword(password)

        pendingAccounts.push({
          memberId: member.id,
          memberName: member.name,
          registrationId: registration.id,
          username,
          password,
          passwordHash,
        })
      }
    }

    // 收集新建账号的明文信息（含密码，仅此一次返回）
    const accounts: { username: string; password: string; name: string; registrationId: string }[] = []

    // 4b. 落库阶段：每条报名记录一个事务，仅做轻量 DB 写入
    for (const registration of registrations) {
      const pendingForReg = pendingAccounts.filter((p) => p.registrationId === registration.id)
      if (pendingForReg.length === 0) continue

      await prisma.$transaction(async (tx) => {
        for (const p of pendingForReg) {
          // d. 创建 User：角色 debater、模式 debater，归属赛事所在团队
          const newUser = await tx.user.create({
            data: {
              username: p.username,
              password: p.passwordHash,
              role: 'debater',
              mode: 'debater',
              teamId: tournament.teamId,
            },
          })

          // e. 创建 TeamMember，将新用户加入赛事所属团队
          await tx.teamMember.create({
            data: {
              teamId: tournament.teamId,
              userId: newUser.id,
            },
          })

          // f. 回填 RegistrationMember.userId，建立报名成员与系统用户的关联
          await tx.registrationMember.update({
            where: { id: p.memberId },
            data: { userId: newUser.id },
          })

          // 收集明文账号信息（仅此一次返回明文密码，供管理员分发给辩手）
          accounts.push({
            username: p.username,
            password: p.password,
            name: p.memberName,
            registrationId: p.registrationId,
          })
        }

        // 5. 标记该报名记录的账号已创建完毕
        await tx.registration.update({
          where: { id: registration.id },
          data: { accountCreated: true },
        })
      })
    }

    // 6. 返回创建结果（含明文密码，管理员可据此分发给辩手）
    return {
      success: true,
      created: accounts.length,
      accounts,
    }
  } catch (error: any) {
    // 已知的业务错误（含权限/校验错误）直接抛出
    if (error.statusCode) throw error
    console.error('Create debater accounts error:', error)
    throw createError({ statusCode: 500, statusMessage: '创建辩手账号失败' })
  }
})
